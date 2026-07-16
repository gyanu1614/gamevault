/**
 * Sell wizard server actions.
 *
 * Reads from the new schema (global_categories, game_categories,
 * attribute_templates, attributes, attribute_options, attribute_conditional_rules).
 *
 * Writes to the EXISTING `listings` table so marketplace browse, detail
 * pages, and the orders pipeline keep working without changes. The
 * template-driven field values land in listings.template_data as a flat
 * `{ attribute_slug: value }` object — same shape the old flow used.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getGlobalCategories, getGamesForGlobalCategory, getAttributeTemplateFull } from '@/lib/actions/new-schema'
import type { GlobalCategory, GameCategory, AttributeTemplateFull, Attribute } from '@/lib/actions/new-schema'
import { ensureLegacyCategoryRow, GLOBAL_SLUG_TO_LEGACY_TYPE } from '@/lib/actions/_category-bridge'
import { pingIndexNow } from '@/lib/seo/indexnow'

/** Service-role supabase client — bypasses RLS so we can self-heal a missing
 *  legacy categories row on the publish path. The user-bound client can't
 *  insert into the categories table because of admin-only RLS policies. */
function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Result helper ───────────────────────────────────────────────────────────

type Result<T> = { success: true; data: T } | { success: false; error: string }

// ─── D1: publish policy (moderation + caps) ──────────────────────────────────

/**
 * Shape returned by the `get_seller_publish_policy` Postgres RPC. Everything
 * the wizard UI needs to know about the seller's tier + moderation status in
 * one round-trip.
 */
export interface SellerPublishPolicy {
  tier: string
  is_verified: boolean
  listing_limit: number | null
  active_count: number
  bulk_daily_cap: number | null
  bulk_today_count: number
  auto_approve_single: boolean
  auto_approve_bulk: boolean
  approved_listings: number
  pre_moderation_listings: number
  needs_moderation: boolean
  at_listing_limit: boolean
}

// ─── D4: duplicate listing — fetch a listing's prefillable fields ────────────

/**
 * The shape the wizard needs to pre-fill itself from an existing listing.
 * We DON'T return images directly because they live in storage paths the
 * new listing should own; the seller can re-upload (or keep them, see below).
 *
 * Owner check: the action requires the listing belongs to the requester.
 * Cross-seller duplication isn't a feature and would leak ownership info.
 */
export interface DuplicatePrefill {
  category_slug: string
  game_id: string
  game_slug: string
  title: string
  description: string
  price: number
  original_price: number | null
  quantity: number
  min_quantity: number
  delivery_method: 'manual' | 'instant'
  delivery_time: string | null
  region: string | null
  platform: string | null
  template_data: Record<string, unknown>
  /** Carry images over verbatim — same URLs are still valid since they
   *  live in a public storage bucket. Seller can remove + re-add freely. */
  images: string[]
  /** Current moderation state — edit mode uses it to surface the
   *  Changes Requested banner + resubmit copy. */
  status: string
  /** What the review team asked to change (only meaningful while
   *  status === 'changes_requested'; internal notes otherwise). */
  moderation_notes: string | null
}

export async function fetchListingForDuplicate(
  listingId: string,
): Promise<Result<DuplicatePrefill>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { success: false, error: 'Not signed in' }

    const { data, error } = await (supabase
      .from('listings') as any)
      .select(`
        id, seller_id, title, description, price, original_price,
        quantity, min_quantity, delivery_method, delivery_time,
        images, template_data, region, platform, game_id,
        status, moderation_notes,
        game:games(slug),
        category:categories(metadata)
      `)
      .eq('id', listingId)
      .single()
    if (error) return { success: false, error: error.message }

    const row = data as {
      seller_id: string
      title: string
      description: string | null
      price: number
      original_price: number | null
      quantity: number
      min_quantity: number
      delivery_method: 'manual' | 'instant'
      delivery_time: string | null
      images: string[] | null
      template_data: Record<string, unknown> | null
      region: string | null
      platform: string | null
      game_id: string
      status: string
      moderation_notes: string | null
      game: { slug: string } | null
      category: { metadata: { type?: string } } | null
    }

    // Owner-only: don't leak fields from other sellers' listings.
    if (row.seller_id !== user.id) {
      return { success: false, error: 'You can only duplicate your own listings' }
    }

    // Map legacy category.metadata.type → global slug. Mirror of the bridge.
    const legacyType = row.category?.metadata?.type ?? ''
    const slug =
      legacyType === 'currency' ? 'currency'
      : legacyType === 'items'    ? 'items'
      : legacyType === 'account'  ? 'accounts'
      : legacyType === 'top_up'   ? 'top-up'
      : legacyType === 'service'  ? 'boosting'
      : ''
    if (!slug) {
      return { success: false, error: 'Could not map this listing to a category' }
    }

    return {
      success: true,
      data: {
        category_slug: slug,
        game_id: row.game_id,
        game_slug: row.game?.slug ?? '',
        title: row.title,
        description: row.description ?? '',
        price: row.price,
        original_price: row.original_price,
        quantity: row.quantity,
        min_quantity: row.min_quantity,
        delivery_method: row.delivery_method,
        delivery_time: row.delivery_time,
        region: row.region,
        platform: row.platform,
        template_data: row.template_data ?? {},
        images: Array.isArray(row.images) ? row.images : [],
        status: row.status,
        moderation_notes: row.moderation_notes ?? null,
      },
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

// ─── D2: price guidance ──────────────────────────────────────────────────────

export interface PriceGuidance {
  sample_size: number
  p25: number | null
  median: number | null
  p75: number | null
}

export async function fetchPriceGuidance(
  gameId: string,
  categorySlug: string,
): Promise<Result<PriceGuidance>> {
  try {
    const supabase = await createClient()
    const { data, error } = await (supabase.rpc as any)(
      'get_price_guidance',
      { p_game_id: gameId, p_category_slug: categorySlug },
    )
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as PriceGuidance }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

/**
 * V19/P9 — Pre-flight check used by SellWizard the moment a seller
 * picks a game in Step 2 for the currency category. Returns the id
 * of their existing currency listing for that game (if any), so the
 * wizard can redirect them straight into edit mode instead of
 * letting them advance to Step 3 only to fail on publish.
 *
 * Scope mirrors the publish-time guard in publishListing: any
 * non-archived status counts as "you already have one".
 */
export async function fetchExistingCurrencyListingId(
  gameId: string,
): Promise<{ id: string } | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // V19/P24/P5 — Bundle currencies allow many listings per game
    // (one per bundle, optionally per region). At Step 2 game-pick
    // time the seller hasn't chosen a bundle yet, so we CAN'T know
    // which existing listing to redirect them to. Skip the intercept
    // entirely for bundle-mode games; the publish-time guard catches
    // exact duplicates and redirects from there.
    const { data: configRow } = await supabase
      .from('category_configs')
      .select('config')
      .eq('game_id', gameId)
      .eq('category_type', 'currency')
      .maybeSingle() as any
    const bundles = configRow?.config?.bundles
    if (Array.isArray(bundles) && bundles.length > 0) return null

    // Resolve the legacy currency category for this game. Same path
    // used by publishListing and the buyer page; keeps "what counts
    // as currency for this game" centralised.
    const { data: catRow } = await supabase
      .from('categories')
      .select('id')
      .eq('game_id', gameId)
      .or('slug.eq.currency,metadata->>type.eq.currency')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle() as any
    const categoryId = catRow?.id
    if (!categoryId) return null

    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .eq('seller_id', user.id)
      .eq('game_id', gameId)
      .eq('category_id', categoryId)
      .in('status', ['active', 'draft', 'paused', 'pending_approval'])
      // Defensive: only intercept against flexible-mode listings.
      // Any bundle-tagged listing on a game whose config just lost
      // its bundles (admin removed them) shouldn't auto-redirect.
      .is('bundle_id', null)
      .limit(1)
      .maybeSingle() as any
    return existing?.id ? { id: existing.id } : null
  } catch {
    // Treat failures as "no existing listing" so the wizard never
    // hard-blocks; the server guard in publishListing is the real
    // safety net.
    return null
  }
}

/**
 * V19/P24/P6 — Bundle-aware variant of fetchExistingCurrencyListingId.
 * Used by the wizard the moment the seller picks a bundle (and a
 * region, if regions are enabled). Returns the listing id of an
 * existing match so the wizard can show "you already list this -
 * update it?" inline instead of letting the seller fill the form
 * and only learning at publish.
 *
 * Match scope mirrors the publish-time guard:
 *   (seller, game, currency-category, bundle_id, region, platform)
 * NULL region and NULL platform are their own slots. V19/P24/P7.d —
 * platform added to the key so 800 V-Bucks/PC and 800 V-Bucks/Xbox
 * are distinct listings.
 *
 * Falls back to null on any error (don't block the seller; the
 * publish guard is the safety net).
 */
export async function fetchExistingBundleListingId(
  gameId: string,
  bundleId: string,
  region: string | null,
  platform: string | null = null,
): Promise<{ id: string } | null> {
  try {
    if (!bundleId) return null
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: catRow } = await supabase
      .from('categories')
      .select('id')
      .eq('game_id', gameId)
      .or('slug.eq.currency,metadata->>type.eq.currency')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle() as any
    const categoryId = catRow?.id
    if (!categoryId) return null

    let query = supabase
      .from('listings')
      .select('id')
      .eq('seller_id', user.id)
      .eq('game_id', gameId)
      .eq('category_id', categoryId)
      .eq('bundle_id', bundleId)
      .in('status', ['active', 'draft', 'paused', 'pending_approval'])
    if (region) {
      query = query.eq('region', region)
    } else {
      query = query.is('region', null)
    }
    if (platform) {
      query = query.eq('platform', platform)
    } else {
      query = query.is('platform', null)
    }
    const { data: existing } = await query.limit(1).maybeSingle() as any
    return existing?.id ? { id: existing.id } : null
  } catch {
    return null
  }
}

export async function fetchPublishPolicy(): Promise<Result<SellerPublishPolicy>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { success: false, error: 'Not signed in' }

    const { data, error } = await (supabase.rpc as any)(
      'get_seller_publish_policy',
      { p_user_id: user.id },
    )
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as SellerPublishPolicy }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

// ─── READS (thin wrappers) ───────────────────────────────────────────────────

export async function fetchSellCategories(): Promise<Result<GlobalCategory[]>> {
  return getGlobalCategories({ includeDisabled: true })
}

/**
 * Games that have a given global category enabled. Joined with the games
 * table so we can show name, logo, cover.
 */
export interface SellGameOption {
  game_category_id: string
  game_id: string
  game_name: string
  game_slug: string
  game_logo_url: string | null
  game_cover_url: string | null
  game_emoji: string | null
  game_sort_order: number
  game_is_active: boolean
  requires_region: boolean
  available_regions: Array<{ code: string; name: string; currency?: string }>
  requires_platform: boolean
  available_platforms: string[]
  delivery_modes: string[]
}

export async function fetchSellGamesForCategory(categorySlug: string): Promise<Result<SellGameOption[]>> {
  try {
    const supabase = await createClient()

    // First get the (game, category) join rows for this category slug
    const gcRes = await getGamesForGlobalCategory(categorySlug)
    if (!gcRes.success) return gcRes
    const joins = gcRes.data
    if (joins.length === 0) return { success: true, data: [] }

    // Fetch all the matching games in one query
    const gameIds = joins.map((j) => j.game_id)
    const { data: games, error } = await supabase
      .from('games')
      .select('id, name, slug, image_url, cover_url, emoji, sort_order, is_active')
      .in('id', gameIds)
      .eq('is_active', true)
    if (error) return { success: false, error: error.message }

    const byGameId = new Map<string, any>()
    for (const g of (games ?? []) as any[]) byGameId.set(g.id, g)

    const data: SellGameOption[] = joins
      .map((j) => {
        const g = byGameId.get(j.game_id)
        if (!g) return null
        return {
          game_category_id: j.id,
          game_id: j.game_id,
          game_name: g.name,
          game_slug: g.slug,
          game_logo_url: g.image_url ?? null,
          game_cover_url: g.cover_url ?? null,
          game_emoji: g.emoji ?? null,
          game_sort_order: g.sort_order ?? 99,
          game_is_active: !!g.is_active,
          requires_region: j.requires_region,
          available_regions: j.available_regions ?? [],
          requires_platform: j.requires_platform,
          available_platforms: j.available_platforms ?? [],
          delivery_modes: j.delivery_modes ?? ['manual'],
        }
      })
      .filter((x): x is SellGameOption => !!x)
      .sort((a, b) => a.game_sort_order - b.game_sort_order || a.game_name.localeCompare(b.game_name))

    return { success: true, data }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

/**
 * Full attribute template for a (game, category) pair, used to render step 3.
 * Returns null if nothing has been authored yet (the wizard falls back to a
 * "no extra fields" message).
 */
export async function fetchSellTemplate(
  gameId: string,
  categorySlug: string,
): Promise<Result<AttributeTemplateFull | null>> {
  try {
    const supabase = await createClient()
    // Resolve game_category_id from (game, category) slug
    const { data: gc } = await supabase
      .from('global_categories')
      .select('id')
      .eq('slug', categorySlug)
      .maybeSingle()
    if (!gc) return { success: true, data: null }
    const { data: gameCat } = await supabase
      .from('game_categories')
      .select('id')
      .eq('game_id', gameId)
      .eq('global_category_id', (gc as { id: string }).id)
      .maybeSingle()
    if (!gameCat) return { success: true, data: null }
    return getAttributeTemplateFull((gameCat as { id: string }).id)
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

// ─── Visibility helper (mirrors LivePreview) ─────────────────────────────────

/**
 * Pure visibility check. Same logic as new-schema.ts/isAttributeVisible but
 * synchronous, for use in a render path. Values are keyed by attribute id.
 */
export async function shouldShowAttribute(
  attr: Attribute,
  valuesByAttrId: Record<string, unknown>,
): Promise<boolean> {
  const rules = attr.conditional_rules ?? []
  if (rules.length === 0) return true
  for (const r of rules) {
    const cur = valuesByAttrId[r.trigger_attribute_id]
    const trig = r.trigger_values ?? []
    let pass = false
    switch (r.operator) {
      case 'equals':     pass = trig.length > 0 && cur === trig[0]; break
      case 'not_equals': pass = trig.length > 0 && cur !== trig[0]; break
      case 'in':         pass = trig.includes(cur as string); break
      case 'not_in':     pass = !trig.includes(cur as string); break
    }
    if (!pass) return false
  }
  return true
}

// ─── PUBLISH ─────────────────────────────────────────────────────────────────

export interface PublishListingInput {
  game_id: string
  category_slug: string
  title: string
  description: string
  price: number
  original_price?: number | null
  quantity: number
  min_quantity: number
  delivery_method: 'instant' | 'manual'
  delivery_time?: string
  images: string[]
  /** Keyed by attribute SLUG (not id) so listing detail pages can read by name */
  template_data: Record<string, unknown>
  region?: string | null
  platform?: string | null
  /**
   * V19/P24 — Bundle id, only set for currency listings against an
   * admin-defined bundle. Free-text reference to
   * category_configs.config.bundles[].id. NULL for flexible
   * currency and every other category.
   */
  bundle_id?: string | null
  status: 'draft' | 'active'
}

/**
 * Publish (or save as draft) a listing. Writes to the EXISTING `listings`
 * table — the marketplace browse and detail pages keep reading the same
 * rows. We resolve the old game-scoped category_id from (game_id, type)
 * so marketplace filters like `category_id = X` keep matching.
 */
export async function publishListing(input: PublishListingInput): Promise<Result<{ id: string; status: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { success: false, error: 'Not signed in' }

    // Validate the slug is one we know about. (Boosting may legitimately
    // map to 'service' here but should be gated upstream — we still want a
    // legacy row if it gets through.)
    if (!GLOBAL_SLUG_TO_LEGACY_TYPE[input.category_slug]) {
      return { success: false, error: 'Unknown category' }
    }

    // ─── D1: tier-based cap + moderation gate ────────────────────────────
    // Fetch the publish policy in the same request so we can reject early
    // when the seller is at their listing cap and downgrade `active` to
    // `pending_approval` when their tier requires it. The DB trigger
    // (check_listing_moderation) also enforces moderation as a safety net,
    // but doing it here means the wizard sees the right status back
    // immediately and the seller gets a clear toast.
    const policyRes = await (supabase.rpc as any)(
      'get_seller_publish_policy',
      { p_user_id: user.id },
    )
    if (policyRes.error) {
      return { success: false, error: policyRes.error.message }
    }
    const policy = policyRes.data as SellerPublishPolicy

    if (input.status === 'active' && policy.at_listing_limit) {
      return {
        success: false,
        error: `You're at your active-listing cap (${policy.listing_limit}). Pause one before adding more, or level up your tier.`,
      }
    }

    // Self-healing: look up the legacy categories row for this (game, slug)
    // pair, creating it via the service-role client if missing. This handles
    // games enabled via the new admin (which only writes game_categories)
    // and any pair that slipped through the Phase A backfill.
    const legacyCatId = await ensureLegacyCategoryRow(
      getAdminSupabase(),
      input.game_id,
      input.category_slug,
    )
    if (!legacyCatId) {
      return { success: false, error: 'Couldn’t resolve a category for this game. Please contact support.' }
    }

    // D1: downgrade `active` → `pending_approval` when the tier requires it.
    // Draft / explicit pending_approval pass through unchanged.
    const finalStatus =
      input.status === 'active' && (policy.needs_moderation || !policy.auto_approve_single)
        ? 'pending_approval'
        : input.status

    // V19/P9 — One currency listing per (seller, game) in flexible
    // mode (Robux-style).
    // V19/P24/P5 — Bundle currencies extend the uniqueness key to
    // (seller, game, bundle_id, region). A V-Bucks seller can have
    // separate listings for 600/1200/6500 V-Bucks and for EU vs US,
    // but not two identical (bundle, region) rows.
    if (input.category_slug === 'currency') {
      let dupQuery = supabase
        .from('listings')
        .select('id')
        .eq('seller_id', user.id)
        .eq('game_id', input.game_id)
        .eq('category_id', legacyCatId)
        .in('status', ['active', 'draft', 'paused', 'pending_approval'])
      if (input.bundle_id) {
        // Bundle mode: match exact (bundle, region, platform). null
        // region/platform are their own slots (treated as "no
        // region" / "no platform"). V19/P24/P7.d — platform added so
        // 800 V-Bucks/PC and 800 V-Bucks/Xbox are distinct.
        dupQuery = dupQuery.eq('bundle_id', input.bundle_id)
        if (input.region) {
          dupQuery = dupQuery.eq('region', input.region)
        } else {
          dupQuery = dupQuery.is('region', null)
        }
        if (input.platform) {
          dupQuery = dupQuery.eq('platform', input.platform)
        } else {
          dupQuery = dupQuery.is('platform', null)
        }
      } else {
        // Flexible mode: any non-bundle currency listing is a dup.
        dupQuery = dupQuery.is('bundle_id', null)
      }
      const { data: existing } = await dupQuery.limit(1).maybeSingle() as any
      if (existing?.id) {
        return {
          success: false,
          error: input.bundle_id
            ? 'You already list this bundle on this platform/region. Editing it instead.'
            : 'You already have a currency listing for this game. Editing it instead.',
          // Cast lets the client narrow on `existingId` without breaking
          // the Result<T> contract for other call sites.
          ...({ existingId: existing.id as string } as any),
        }
      }
    }

    // V14 — Enforce minimum 100-unit order for currency listings. Mirrors
    // the wizard floor so the client and server agree.
    // V19/P24/P5 — Bundle listings sell whole-bundle-only, so the
    // 100-floor doesn't apply (a bundle of "600 V-Bucks" is one unit).
    let resolvedMinQuantity = input.min_quantity
    if (
      input.category_slug === 'currency' &&
      !input.bundle_id &&
      resolvedMinQuantity < 100
    ) {
      resolvedMinQuantity = 100
    }

    // V13 — Currency listings auto-fill title + image from the game record
    // so sellers don't have to. The wizard hides those fields in the UI.
    let resolvedTitle = input.title.trim()
    let resolvedImages = input.images
    if (input.category_slug === 'currency') {
      // V19/P9 — Pull title from the live category_configs row (admin
      // sets unit_label per game). Falls back to "{Game} currency" if
      // config hasn't been edited yet. Replaces the hardcoded
      // currencyUnit map that mirrored the old client-side map we
      // deleted in V19/P4.
      const [{ data: gameRow }, { data: cfgRow }] = await Promise.all([
        supabase
          .from('games')
          .select('name, slug, image_url')
          .eq('id', input.game_id)
          .single() as any,
        supabase
          .from('category_configs')
          .select('config')
          .eq('game_id', input.game_id)
          .eq('category_type', 'currency')
          .maybeSingle() as any,
      ])
      const gameName: string = gameRow?.name ?? 'Currency'
      const gameImage: string | null = gameRow?.image_url ?? null
      const unitLabel: string | undefined = cfgRow?.config?.unit_label
      const unit = unitLabel || `${gameName} currency`
      // V19/P24/P6 — Bundle listings auto-fill title with the bundle
      // name so the listing detail page reads "Fortnite 600 V-Bucks"
      // instead of "Fortnite V-Bucks", and the seller's My Listings
      // table can tell two bundles apart at a glance. Bundle's image
      // also overrides the game logo as the default listing image.
      const bundles: Array<{ id: string; name?: string; icon_url?: string }> =
        cfgRow?.config?.bundles ?? []
      const matchedBundle = input.bundle_id
        ? bundles.find((b) => b.id === input.bundle_id)
        : null
      if (!resolvedTitle) {
        resolvedTitle = matchedBundle?.name
          ? `${gameName} ${matchedBundle.name}`
          : `${gameName} ${unit}`
      }
      if (resolvedImages.length === 0) {
        const fallbackImage = matchedBundle?.icon_url || gameImage
        if (fallbackImage) resolvedImages = [fallbackImage]
      }
    }

    const insertPayload: Record<string, unknown> = {
      seller_id: user.id,
      game_id: input.game_id,
      category_id: legacyCatId,
      title: resolvedTitle || 'Untitled',
      // listings.description is NOT NULL in the legacy schema; default to ''
      description: input.description?.trim() || '',
      price: input.price,
      original_price: input.original_price ?? null,
      quantity: input.quantity,
      min_quantity: resolvedMinQuantity,
      delivery_method: input.delivery_method,
      delivery_time: input.delivery_time ?? null,
      images: resolvedImages,
      template_data: input.template_data,
      region: input.region ?? null,
      platform: input.platform ?? null,
      // V19/P24 — Bundle id for fixed-bundle currencies. NULL for
      // flexible currency listings and every non-currency listing.
      bundle_id: input.bundle_id ?? null,
      status: finalStatus,
    }

    const { data, error } = await (supabase
      .from('listings') as any)
      .insert(insertPayload)
      // slug is DB-generated (set_listing_slug trigger) — read it back
      // so we can ping IndexNow with the live listing URL.
      .select('id, slug')
      .single()
    if (error) return { success: false, error: error.message }

    revalidatePath('/account/listings')

    // SEO — IndexNow ping for the freshly published listing + the pages
    // it appears on. Only 'active' listings are publicly crawlable;
    // pending_approval/draft get picked up by the sitemap once live.
    // NOTE: later client-side status changes (pause/activate/price edits
    // in the seller offers table) are deliberately NOT wired to IndexNow
    // — the sitemap's lastmod (max listing updated_at) covers those.
    if (finalStatus === 'active') {
      const [{ data: pingGame }, { data: pingCat }] = await Promise.all([
        supabase.from('games').select('slug').eq('id', input.game_id).maybeSingle() as any,
        supabase.from('categories').select('slug').eq('id', legacyCatId).maybeSingle() as any,
      ])
      if (pingGame?.slug && pingCat?.slug) {
        const listingSlug = (data as { id: string; slug?: string | null }).slug
        await pingIndexNow([
          ...(listingSlug ? [`/${pingGame.slug}/${pingCat.slug}/${listingSlug}`] : []),
          `/${pingGame.slug}`,
          `/${pingGame.slug}/${pingCat.slug}`,
        ])
      }
    }

    return { success: true, data: { id: (data as { id: string }).id, status: finalStatus } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

// ─── V14k: Edit existing listing via wizard ─────────────────────────────────
/**
 * V14k — Update an existing listing using the same wizard payload. Edit-mode
 * skips the publish-policy gate (the listing was already approved) and the
 * legacy-category resolution (the row already has a category_id), but keeps
 * the currency floor + auto-fill so behaviour stays identical to publish.
 *
 * Ownership check: rejects the update if the listing belongs to someone else.
 */
export async function updateListingFromWizard(
  listingId: string,
  input: PublishListingInput,
): Promise<Result<{ id: string; status: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { success: false, error: 'Not signed in' }

    // Ownership guard.
    const { data: existing, error: lookupErr } = await (supabase
      .from('listings') as any)
      .select('seller_id, status')
      .eq('id', listingId)
      .single()
    if (lookupErr || !existing) return { success: false, error: 'Listing not found' }
    if ((existing as { seller_id: string }).seller_id !== user.id) {
      return { success: false, error: 'You can only edit your own listings' }
    }

    // V14k — Same currency-floor enforcement as publish.
    // V19/P24/P5 — Bundle listings skip the 100-floor (each bundle
    // is its own atomic unit).
    let resolvedMinQuantity = input.min_quantity
    if (
      input.category_slug === 'currency' &&
      !input.bundle_id &&
      resolvedMinQuantity < 100
    ) {
      resolvedMinQuantity = 100
    }

    // V14k — Same currency title/image auto-fill as publish.
    // V19/P24/P6 — Pulled the hardcoded currencyUnit Record out and
    // wired the edit path to read the same category_configs row +
    // bundle list that publishListing uses. Bundle listings get a
    // "{Game} {bundle.name}" title so edits don't regress to a
    // bundle-less generic name.
    let resolvedTitle = input.title.trim()
    let resolvedImages = input.images
    if (input.category_slug === 'currency') {
      const [{ data: gameRow }, { data: cfgRow }] = await Promise.all([
        supabase
          .from('games')
          .select('name, image_url')
          .eq('id', input.game_id)
          .single() as any,
        supabase
          .from('category_configs')
          .select('config')
          .eq('game_id', input.game_id)
          .eq('category_type', 'currency')
          .maybeSingle() as any,
      ])
      const gameName: string = gameRow?.name ?? 'Currency'
      const gameImage: string | null = gameRow?.image_url ?? null
      const unitLabel: string | undefined = cfgRow?.config?.unit_label
      const unit = unitLabel || `${gameName} currency`
      const bundles: Array<{ id: string; name?: string; icon_url?: string }> =
        cfgRow?.config?.bundles ?? []
      const matchedBundle = input.bundle_id
        ? bundles.find((b) => b.id === input.bundle_id)
        : null
      if (!resolvedTitle) {
        resolvedTitle = matchedBundle?.name
          ? `${gameName} ${matchedBundle.name}`
          : `${gameName} ${unit}`
      }
      if (resolvedImages.length === 0) {
        const fallbackImage = matchedBundle?.icon_url || gameImage
        if (fallbackImage) resolvedImages = [fallbackImage]
      }
    }

    // Resubmit loop: a listing the review team bounced back
    // (changes_requested) or rejected re-enters the review queue when
    // the seller saves a non-draft edit. Explicit status flip — the
    // check_listing_moderation trigger only intervenes on transitions
    // to 'active', so we can't rely on it here.
    const existingStatus = (existing as { status: string }).status
    const isResubmit =
      (existingStatus === 'changes_requested' || existingStatus === 'rejected') &&
      input.status !== 'draft'

    const updatePayload: Record<string, unknown> = {
      title: resolvedTitle || 'Untitled',
      description: input.description?.trim() || '',
      price: input.price,
      original_price: input.original_price ?? null,
      quantity: input.quantity,
      min_quantity: resolvedMinQuantity,
      delivery_method: input.delivery_method,
      delivery_time: input.delivery_time ?? null,
      images: resolvedImages,
      template_data: input.template_data,
      region: input.region ?? null,
      platform: input.platform ?? null,
      // V19/P24 — Bundle id propagated on edit too so the seller can
      // re-target a different bundle from the wizard.
      bundle_id: input.bundle_id ?? null,
      // Only let the seller flip between draft ↔ active here; don't let an
      // edit accidentally reset moderation state — EXCEPT the resubmit
      // loop, which moves changes_requested/rejected back into review.
      ...(input.status === 'draft'
        ? { status: 'draft' }
        : isResubmit
          ? { status: 'pending_approval' }
          : {}),
    }

    const { error } = await (supabase
      .from('listings') as any)
      .update(updatePayload)
      .eq('id', listingId)
    if (error) return { success: false, error: error.message }

    // Resubmit comms — tell the moderation team the listing is back in
    // the queue. AWAITED but wrapped so it can never fail the edit;
    // service-role client because a seller session can't read admin
    // role rows or insert notifications for other users under RLS.
    if (isResubmit) {
      await (async () => {
        const { createServiceRoleClient } = await import('@/lib/supabase/service')
        const service = createServiceRoleClient()

        const { data: rolesWithPermission } = await service
          .from('role_permissions')
          .select('role')
          .eq('permission', 'listings.moderate') as any
        const roles = (rolesWithPermission || []).map((r: any) => r.role)
        if (roles.length === 0) return

        const { data: admins } = await service
          .from('admin_roles')
          .select('user_id')
          .in('role', roles)
          .eq('is_active', true) as any
        const adminIds: string[] = (admins || []).map((a: any) => a.user_id)
        if (adminIds.length === 0) return

        await (service.from('notifications').insert as any)(
          adminIds.map((adminId) => ({
            user_id: adminId,
            type: 'listing_resubmitted',
            title: 'Listing Resubmitted',
            message: `"${resolvedTitle || 'Untitled'}" was updated and resubmitted for review.`,
            link: '/admin/moderation',
            is_read: false,
          }))
        )
      })().catch((err) => console.error('[SellWizard] Resubmit admin comms failed:', err))
    }

    revalidatePath('/account/listings')
    revalidatePath('/admin/moderation')
    // V19/P11 — Canonical edit URL is /sell/edit/[id]; the old
    // /account/listings/[id]/edit is now a permanent redirect, so we
    // revalidate the new path. Keeping the old revalidate as a
    // belt-and-braces measure costs nothing.
    revalidatePath(`/sell/edit/${listingId}`)
    revalidatePath(`/account/listings/${listingId}/edit`)
    return {
      success: true,
      data: {
        id: listingId,
        status: input.status === 'draft' ? 'draft' : isResubmit ? 'pending_approval' : existingStatus,
      },
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

// ─── D5: Bulk CSV upload ────────────────────────────────────────────────────

/**
 * Returns the CSV header + a comment row + a single example row for the
 * given (game, category). Columns:
 *   - title, description, price, original_price, quantity, min_quantity,
 *     delivery_method, delivery_time, region, platform
 *   - one column per attribute in the template (using attribute.slug)
 *
 * The seller downloads this, fills it in, and uploads it. The example row
 * uses placeholders matching each column's expected type.
 */
export async function fetchBulkCsvTemplate(
  gameId: string,
  categorySlug: string,
): Promise<Result<{ filename: string; csv: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { success: false, error: 'Not signed in' }

    const tplRes = await fetchSellTemplate(gameId, categorySlug)
    if (!tplRes.success) return { success: false, error: tplRes.error }
    const template = tplRes.data

    const baseCols = [
      'title', 'description', 'price', 'original_price',
      'quantity', 'min_quantity', 'delivery_method', 'delivery_time',
      'region', 'platform',
    ]
    const attrCols = template ? template.attributes.map((a) => a.slug) : []
    const header = [...baseCols, ...attrCols]

    const example: Record<string, string> = {
      title: 'Example offer title',
      description: 'Optional notes',
      price: '4.99',
      original_price: '',
      quantity: '1',
      min_quantity: '1',
      delivery_method: 'manual',
      delivery_time: '1hr',
      region: '',
      platform: '',
    }
    if (template) {
      for (const a of template.attributes) {
        example[a.slug] =
          a.type === 'select' || a.type === 'multiselect'
            ? a.options?.[0]?.value ?? ''
            : a.type === 'boolean'
              ? 'true'
              : a.type === 'number'
                ? '1'
                : ''
      }
    }

    const escape = (v: string) =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
    const lines = [
      header.join(','),
      header.map((c) => escape(example[c] ?? '')).join(','),
    ]

    return {
      success: true,
      data: {
        filename: `dropmarket-bulk-${categorySlug}.csv`,
        csv: lines.join('\n'),
      },
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

export interface BulkRow {
  /** Original 1-based line number from the seller's CSV (for error reporting) */
  line: number
  title: string
  description: string
  price: number
  original_price: number | null
  quantity: number
  min_quantity: number
  delivery_method: 'manual' | 'instant'
  delivery_time: string | null
  region: string | null
  platform: string | null
  template_data: Record<string, unknown>
  /** Optional carry-over image URLs; bulk CSV can include image URLs
   *  comma-separated. Stored under `images` column in the CSV. */
  images: string[]
}

export interface BulkPublishResult {
  ok: number
  failed: Array<{ line: number; error: string }>
}

/**
 * Bulk publish flow. Reads policy, checks `auto_approve_bulk` + daily cap,
 * then inserts each row in turn. Stops early if the daily cap would be
 * exceeded; rows that fail validation are reported per-line.
 *
 * Status:
 *   - auto_approve_bulk = true  → status = 'active' (subject to the
 *     existing moderation trigger; same as the single-listing flow)
 *   - auto_approve_bulk = false → status = 'pending_approval' even when
 *     the seller's auto_approve_single is true. Bulk is treated as a
 *     coarser surface and reviewed by default.
 */
export async function bulkPublishListings(
  gameId: string,
  categorySlug: string,
  rows: BulkRow[],
): Promise<Result<BulkPublishResult>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { success: false, error: 'Not signed in' }

    const policyRes = await (supabase.rpc as any)(
      'get_seller_publish_policy',
      { p_user_id: user.id },
    )
    if (policyRes.error) return { success: false, error: policyRes.error.message }
    const policy = policyRes.data as SellerPublishPolicy

    const remainingDaily =
      policy.bulk_daily_cap == null
        ? Number.POSITIVE_INFINITY
        : Math.max(0, policy.bulk_daily_cap - policy.bulk_today_count)
    if (remainingDaily === 0) {
      return {
        success: false,
        error: `Bulk daily cap reached (${policy.bulk_daily_cap}). Try again in 24h or level up your tier.`,
      }
    }
    if (rows.length > remainingDaily) {
      return {
        success: false,
        error: `You can only bulk-upload ${remainingDaily} more today (cap ${policy.bulk_daily_cap}). Trim your CSV and try again.`,
      }
    }

    // Resolve legacy category once.
    const legacyCatId = await ensureLegacyCategoryRow(
      getAdminSupabase(),
      gameId,
      categorySlug,
    )
    if (!legacyCatId) {
      return { success: false, error: 'Couldn’t resolve a category for this game.' }
    }

    const status =
      policy.auto_approve_bulk && !policy.needs_moderation ? 'active' : 'pending_approval'

    const failed: Array<{ line: number; error: string }> = []
    let ok = 0

    for (const r of rows) {
      try {
        if (!r.title?.trim()) {
          failed.push({ line: r.line, error: 'title is required' })
          continue
        }
        if (!Number.isFinite(r.price) || r.price <= 0) {
          failed.push({ line: r.line, error: 'price must be > 0' })
          continue
        }
        if (!Number.isFinite(r.quantity) || r.quantity < 1) {
          failed.push({ line: r.line, error: 'quantity must be >= 1' })
          continue
        }
        const payload: Record<string, unknown> = {
          seller_id: user.id,
          game_id: gameId,
          category_id: legacyCatId,
          title: r.title.trim(),
          description: r.description?.trim() || '',
          price: r.price,
          original_price: r.original_price,
          quantity: r.quantity,
          min_quantity: r.min_quantity || 1,
          delivery_method: r.delivery_method,
          delivery_time: r.delivery_time,
          images: r.images,
          template_data: r.template_data,
          region: r.region,
          platform: r.platform,
          status,
          metadata: { source: 'bulk' },
        }
        const { error } = await (supabase.from('listings') as any).insert(payload)
        if (error) {
          failed.push({ line: r.line, error: error.message })
          continue
        }
        ok++
      } catch (e: any) {
        failed.push({ line: r.line, error: e?.message ?? 'Unknown error' })
      }
    }

    revalidatePath('/account/listings')

    // SEO — one IndexNow ping for the game hub + category page when bulk
    // rows went live. Individual listing URLs are skipped here (slugs
    // are DB-generated and not selected back in the loop); the sitemap
    // picks them up on the next crawl.
    if (ok > 0 && status === 'active') {
      const [{ data: pingGame }, { data: pingCat }] = await Promise.all([
        supabase.from('games').select('slug').eq('id', gameId).maybeSingle() as any,
        supabase.from('categories').select('slug').eq('id', legacyCatId).maybeSingle() as any,
      ])
      if (pingGame?.slug && pingCat?.slug) {
        await pingIndexNow([`/${pingGame.slug}`, `/${pingGame.slug}/${pingCat.slug}`])
      }
    }

    return { success: true, data: { ok, failed } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

// ─── IMAGE UPLOAD (same bucket as old flow) ──────────────────────────────────

export async function uploadSellImage(
  formData: FormData
): Promise<Result<{ url: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { success: false, error: 'Not signed in' }

    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'No file provided' }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return { success: false, error: 'JPG, PNG, or WebP only' }
    }
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'Each image must be under 5 MB' }
    }

    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { data, error } = await supabase.storage
      .from('listing-images')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (error) return { success: false, error: error.message }
    const { data: urlData } = supabase.storage.from('listing-images').getPublicUrl(data.path)
    return { success: true, data: { url: urlData.publicUrl } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Upload failed' }
  }
}
