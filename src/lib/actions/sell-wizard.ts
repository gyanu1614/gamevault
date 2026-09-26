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
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
import { getGlobalCategories, getGamesForGlobalCategory, getAttributeTemplateFull } from '@/lib/actions/new-schema'
import type { GlobalCategory, GameCategory, AttributeTemplateFull, Attribute } from '@/lib/actions/new-schema'
import { findEnabledGameCategory } from '@/lib/categories'
import { pingIndexNow } from '@/lib/seo/indexnow'
import { validateListingWrite, type ListingWrite } from '@/lib/listings/validate'
import { publishDenialMessage, sellAccessKind, canUseSellSurface } from '@/lib/listings/access'
import { decidePublishStatus } from '@/lib/listings/publish-status'
import { APPLICANT_DRAFT_KEY } from '@/lib/listings/submit-applicant-drafts'
import { checkListingImage, listingImagePathFor, LISTING_IMAGE_BUCKET } from '@/lib/listings/images'
import { loadListingRuleContext } from '@/lib/listings/rule-context'
import type { CurrencyConfig } from '@/lib/types/category-configs'

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
        category:game_categories!listings_game_category_id_fkey(global_category:global_categories!game_categories_global_category_id_fkey(slug))
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
      category: { global_category: { slug: string } | null } | null
    }

    // Owner-only: don't leak fields from other sellers' listings.
    if (row.seller_id !== user.id) {
      return { success: false, error: 'You can only duplicate your own listings' }
    }

    // The wizard is keyed by global slug (currency / items / accounts / …).
    const slug = row.category?.global_category?.slug ?? ''
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
      .from('game_categories')
      .select('id')
      .eq('game_id', gameId)
      .eq('type', 'currency')
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle() as any
    const categoryId = catRow?.id
    if (!categoryId) return null

    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .eq('seller_id', user.id)
      .eq('game_id', gameId)
      .eq('game_category_id', categoryId)
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
      .from('game_categories')
      .select('id')
      .eq('game_id', gameId)
      .eq('type', 'currency')
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle() as any
    const categoryId = catRow?.id
    if (!categoryId) return null

    let query = supabase
      .from('listings')
      .select('id')
      .eq('seller_id', user.id)
      .eq('game_id', gameId)
      .eq('game_category_id', categoryId)
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

// ─── Currency auto-fill (shared by publish + wizard edit) ───────────────────

/**
 * V13 / V19/P9 / V19/P24/P6 — currency listings take their title and default
 * image from the game + category config (unit_label, bundle name/icon); the
 * wizard hides those fields. Non-currency categories pass through untouched.
 */
async function resolveCurrencyTitleAndImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gameId: string,
  categoryType: string,
  currencyConfig: Partial<CurrencyConfig> | null | undefined,
  v: Pick<ListingWrite, 'title' | 'images' | 'bundle_id'>,
): Promise<{ title: string; images: string[] }> {
  if (categoryType !== 'currency') return { title: v.title, images: v.images }
  const { data: gameRow } = await supabase
    .from('games')
    .select('name, image_url')
    .eq('id', gameId)
    .maybeSingle() as any
  const gameName: string = gameRow?.name ?? 'Currency'
  const gameImage: string | null = gameRow?.image_url ?? null
  const unit = currencyConfig?.unit_label || `${gameName} currency`
  const bundles = currencyConfig?.bundles ?? []
  const matchedBundle = v.bundle_id ? bundles.find((b) => b.id === v.bundle_id) : null
  let title = v.title
  if (!title) {
    title = matchedBundle?.name ? `${gameName} ${matchedBundle.name}` : `${gameName} ${unit}`
  }
  let images = v.images
  if (images.length === 0) {
    const fallbackImage = matchedBundle?.icon_url || gameImage
    if (fallbackImage) images = [fallbackImage]
  }
  return { title, images }
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

    // AUTH-009 / ACC-01 — seller gate before anything else runs. GRO-08: an
    // applicant (application in the pipeline) may use the wizard, but every
    // save lands as a DRAFT — the DB (INSERT policy + trigger) refuses any
    // other status for them, whoever writes.
    const kind = await sellAccessKind(supabase, user.id)
    const isApplicant = kind === 'applicant'
    const denied = publishDenialMessage(kind)
    if (denied && !isApplicant) return { success: false, error: denied }

    // ─── D1: tier-based cap + moderation gate ────────────────────────────
    // Fetch the publish policy in the same request so we can reject early
    // when the seller is at their listing cap and downgrade `active` to
    // `pending_approval` when their tier requires it. The DB trigger
    // (check_listing_moderation) also enforces moderation as a safety net,
    // but doing it here means the wizard sees the right status back
    // immediately and the seller gets a clear toast. An applicant has no
    // policy yet: drafts only, submitted on approval.
    let policy: SellerPublishPolicy | null = null
    if (!isApplicant) {
      const policyRes = await (supabase.rpc as any)(
        'get_seller_publish_policy',
        { p_user_id: user.id },
      )
      if (policyRes.error) {
        return { success: false, error: policyRes.error.message }
      }
      policy = policyRes.data as SellerPublishPolicy

      if (input.status === 'active' && policy.at_listing_limit) {
        return {
          success: false,
          error: `You're at your active-listing cap (${policy.listing_limit}). Pause one before adding more, or level up your tier.`,
        }
      }
    }

    // AUTH-010 — resolved with the SESSION client: only a (game, category)
    // pair an admin has enabled in game_categories can be published into.
    // The row itself is the listing's category; nothing is created here.
    const gameCategory = await findEnabledGameCategory(supabase, input.game_id, input.category_slug)
    if (!gameCategory) {
      return { success: false, error: 'This category is not enabled for this game.' }
    }

    // ACC-03/05/06/11 — ONE validator for every write path. Runs after the
    // pair gate (the rules depend on the pair's type and config) and before
    // any write; the payload below is built from its output, never from the
    // raw input.
    const rules = await loadListingRuleContext(supabase, input.game_id, gameCategory.type)
    const validated = validateListingWrite(input, rules)
    if (!validated.ok) return { success: false, error: validated.error }
    const v = validated.value

    // D1: downgrade `active` → `pending_approval` when the tier requires it
    // (one rule with the drafts submitted on approval: decidePublishStatus).
    // GRO-08: an applicant's save is always a draft.
    const finalStatus = isApplicant || !policy ? 'draft' : decidePublishStatus(policy, v.status)

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
        .eq('game_category_id', gameCategory.id)
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

    // V13 — Currency listings auto-fill title + image from the game record
    // so sellers don't have to. The wizard hides those fields in the UI.
    const { title: resolvedTitle, images: resolvedImages } =
      await resolveCurrencyTitleAndImages(supabase, input.game_id, gameCategory.type, rules.currencyConfig, v)

    const insertPayload: Record<string, unknown> = {
      seller_id: user.id,
      game_id: input.game_id,
      game_category_id: gameCategory.id,
      // Phase A: listings.category_id is still NOT NULL and points at the
      // mirrored legacy row (trg_listings_category_sync would derive it too).
      category_id: gameCategory.legacy_category_id,
      title: resolvedTitle || 'Untitled',
      // listings.description is NOT NULL in the legacy schema; default to ''
      description: v.description,
      price: v.price,
      original_price: v.original_price,
      quantity: v.quantity,
      // ACC-05 — the validator resolved this from category_configs
      // (min_quantity floor, bundle → 1, capped at stock).
      min_quantity: v.min_quantity,
      delivery_method: v.delivery_method,
      delivery_time: v.delivery_time,
      images: resolvedImages,
      template_data: v.template_data,
      region: v.region,
      platform: v.platform,
      // V19/P24 — Bundle id for fixed-bundle currencies. NULL for
      // flexible currency listings and every non-currency listing.
      bundle_id: v.bundle_id,
      status: finalStatus,
      // GRO-08 — marks the drafts to submit automatically on approval.
      ...(isApplicant ? { metadata: { [APPLICANT_DRAFT_KEY]: true } } : {}),
    }

    // AUTH-031 — the DB coerces every non-guarded listings INSERT to
    // pending_approval with NULL moderation columns (so a raw PostgREST insert
    // can never go live). This path has already passed the seller gate and
    // the publish-policy decision above, so it inserts as the backend;
    // seller_id is pinned to the session user and the payload carries no
    // moderation columns.
    const { data, error } = await (getAdminSupabase()
      .from('listings') as any)
      .insert(insertPayload)
      // slug is DB-generated (set_listing_slug trigger) — read it back
      // so we can ping IndexNow with the live listing URL.
      .select('id, slug')
      .single()
    if (error) return { success: false, error: error.message }

    revalidatePath('/account/listings')
    // Step 7b — the category page is prerendered (24 h TTL); tell it.
    await revalidateListingSurfaces(getAdminSupabase() as never, {
      gameCategoryIds: [gameCategory.id],
    })

    // SEO — IndexNow ping for the freshly published listing + the pages
    // it appears on. Only 'active' listings are publicly crawlable;
    // pending_approval/draft get picked up by the sitemap once live.
    // NOTE: later client-side status changes (pause/activate/price edits
    // in the seller offers table) are deliberately NOT wired to IndexNow
    // — the sitemap's lastmod (max listing updated_at) covers those.
    if (finalStatus === 'active') {
      const { data: pingGame } = await supabase.from('games').select('slug').eq('id', input.game_id).maybeSingle() as any
      if (pingGame?.slug) {
        const listingSlug = (data as { id: string; slug?: string | null }).slug
        await pingIndexNow([
          ...(listingSlug ? [`/${pingGame.slug}/${gameCategory.slug}/${listingSlug}`] : []),
          `/${pingGame.slug}`,
          `/${pingGame.slug}/${gameCategory.slug}`,
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
 * legacy-category resolution (the row already has a category_id), but runs
 * the SAME validator as publish (ACC-03) and the same currency auto-fill.
 *
 * The listing's game / category are fixed: the row's own pair decides the
 * rules and the payload never carries game_id / game_category_id (BUG-03
 * server side; the DB trigger freezes them for JWT callers too).
 *
 * Ownership check: rejects the update if the listing belongs to someone else.
 * The write itself is a service-role write — UPDATE on listings is revoked
 * for JWT callers (migration 20260925204757) — after that check.
 */
export async function updateListingFromWizard(
  listingId: string,
  input: PublishListingInput,
): Promise<Result<{ id: string; status: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { success: false, error: 'Not signed in' }

    // Ownership guard + the row's fixed pair (session client: RLS lets a
    // seller read their own rows in any status).
    const { data: existingRaw, error: lookupErr } = await (supabase
      .from('listings') as any)
      .select('seller_id, status, game_id, game_category_id, pair:game_categories!listings_game_category_id_fkey (type)')
      .eq('id', listingId)
      .single()
    const existing = existingRaw as {
      seller_id: string
      status: string
      game_id: string
      game_category_id: string | null
      pair: { type: string } | null
    } | null
    if (lookupErr || !existing) return { success: false, error: 'Listing not found' }
    if (existing.seller_id !== user.id) {
      return { success: false, error: 'You can only edit your own listings' }
    }

    // ACC-01 / BUG-16 — the same seller gate as publish: a restricted or
    // banned seller can neither edit nor resubmit. GRO-08: an applicant may
    // keep editing their own drafts — as drafts.
    const kind = await sellAccessKind(supabase, user.id)
    const isApplicant = kind === 'applicant'
    const denied = publishDenialMessage(kind)
    if (denied && !isApplicant) return { success: false, error: denied }
    if (isApplicant && existing.status !== 'draft') {
      return { success: false, error: 'Only drafts can be edited while your application is under review' }
    }

    const categoryType = existing.pair?.type ?? input.category_slug
    const rules = await loadListingRuleContext(supabase, existing.game_id, categoryType)
    const validated = validateListingWrite(input, rules)
    if (!validated.ok) return { success: false, error: validated.error }
    const v = validated.value

    const { title: resolvedTitle, images: resolvedImages } =
      await resolveCurrencyTitleAndImages(supabase, existing.game_id, categoryType, rules.currencyConfig, v)

    // Resubmit loop: a listing the review team bounced back
    // (changes_requested) or rejected re-enters the review queue when
    // the seller saves a non-draft edit. Explicit status flip — the
    // check_listing_moderation trigger only intervenes on transitions
    // to 'active', so we can't rely on it here.
    const existingStatus = existing.status
    const isResubmit =
      (existingStatus === 'changes_requested' || existingStatus === 'rejected') &&
      v.status !== 'draft'
    const requestedStatus: 'draft' | 'active' = isApplicant ? 'draft' : v.status

    const updatePayload: Record<string, unknown> = {
      title: resolvedTitle || 'Untitled',
      description: v.description,
      price: v.price,
      original_price: v.original_price,
      quantity: v.quantity,
      min_quantity: v.min_quantity,
      delivery_method: v.delivery_method,
      delivery_time: v.delivery_time,
      images: resolvedImages,
      template_data: v.template_data,
      region: v.region,
      platform: v.platform,
      // V19/P24 — Bundle id propagated on edit too so the seller can
      // re-target a different bundle from the wizard.
      bundle_id: v.bundle_id,
      // Only let the seller flip between draft ↔ active here; don't let an
      // edit accidentally reset moderation state — EXCEPT the resubmit
      // loop, which moves changes_requested/rejected back into review.
      ...(requestedStatus === 'draft'
        ? { status: 'draft' }
        : isResubmit
          ? { status: 'pending_approval' }
          : {}),
    }

    // Service-role write after the ownership check above; the row id AND
    // seller_id are both pinned so a race on ownership cannot widen it. The
    // status is read back: the DB may bounce a moderated seller's content
    // edit into review (ACC-04).
    const { data: written, error } = await (getAdminSupabase()
      .from('listings') as any)
      .update(updatePayload)
      .eq('id', listingId)
      .eq('seller_id', user.id)
      .select('status')
      .single()
    if (error) return { success: false, error: error.message }
    const finalStatus: string = (written as { status?: string } | null)?.status
      ?? (requestedStatus === 'draft' ? 'draft' : isResubmit ? 'pending_approval' : existingStatus)

    // Moderation comms — the listing (re-)entered the review queue.
    if (finalStatus === 'pending_approval' && existingStatus !== 'pending_approval') {
      await notifyModeratorsListingResubmitted(resolvedTitle || 'Untitled')
    }

    revalidatePath('/account/listings')
    revalidatePath('/admin/moderation')
    // Step 7b — an edit may move the listing between categories; resolve by id.
    await revalidateListingSurfaces(supabase as never, { listingIds: [listingId] })
    // V19/P11 — Canonical edit URL is /sell/edit/[id]; the old
    // /account/listings/[id]/edit is now a permanent redirect, so we
    // revalidate the new path. Keeping the old revalidate as a
    // belt-and-braces measure costs nothing.
    revalidatePath(`/sell/edit/${listingId}`)
    revalidatePath(`/account/listings/${listingId}/edit`)
    return { success: true, data: { id: listingId, status: finalStatus } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

/**
 * Tell the moderation team a listing is back in the queue. AWAITED but
 * wrapped so it can never fail the edit; service-role client because a
 * seller session can't read admin role rows or insert notifications for
 * other users under RLS.
 */
async function notifyModeratorsListingResubmitted(title: string): Promise<void> {
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
        message: `"${title}" was updated and resubmitted for review.`,
        link: '/admin/moderation',
        is_read: false,
      }))
    )
  })().catch((err) => console.error('[SellWizard] Resubmit admin comms failed:', err))
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

    // AUTH-009 — seller gate before anything else runs (bulk is sellers only).
    const denied = publishDenialMessage(await sellAccessKind(supabase, user.id))
    if (denied) return { success: false, error: denied }

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

    // AUTH-010 — same gate as publishListing: admin-enabled pair or nothing.
    const gameCategory = await findEnabledGameCategory(supabase, gameId, categorySlug)
    if (!gameCategory) {
      return { success: false, error: 'This category is not enabled for this game.' }
    }

    const status =
      policy.auto_approve_bulk && !policy.needs_moderation ? 'active' : 'pending_approval'

    const failed: Array<{ line: number; error: string }> = []
    let ok = 0

    // ACC-03 / BUG-13 — every row goes through the same validator as the
    // wizard: delivery windows, price, minimum order size, stock.
    const rules = await loadListingRuleContext(supabase, gameId, gameCategory.type)

    // AUTH-031 — see publishListing: rows insert as the backend after the
    // gate + policy decision; seller_id is pinned to the session user.
    const listingsWriter = getAdminSupabase()
    const touchedCategoryIds = new Set<string>()

    for (const r of rows) {
      try {
        if (!Number.isFinite(r.quantity) || r.quantity < 1) {
          failed.push({ line: r.line, error: 'quantity must be >= 1' })
          continue
        }
        const validated = validateListingWrite(
          {
            title: r.title ?? '',
            description: r.description ?? '',
            price: r.price,
            original_price: r.original_price ?? null,
            quantity: r.quantity,
            min_quantity: r.min_quantity || 1,
            delivery_method: r.delivery_method,
            delivery_time: r.delivery_time,
            images: r.images ?? [],
            template_data: r.template_data ?? {},
            region: r.region ?? null,
            platform: r.platform ?? null,
            bundle_id: null,
            status: 'active',
          },
          rules,
        )
        if (!validated.ok) {
          failed.push({ line: r.line, error: validated.error })
          continue
        }
        const v = validated.value
        const payload: Record<string, unknown> = {
          seller_id: user.id,
          game_id: gameId,
          game_category_id: gameCategory.id,
          category_id: gameCategory.legacy_category_id,
          title: v.title,
          description: v.description,
          price: v.price,
          original_price: v.original_price,
          quantity: v.quantity,
          min_quantity: v.min_quantity,
          delivery_method: v.delivery_method,
          delivery_time: v.delivery_time,
          images: v.images,
          template_data: v.template_data,
          region: v.region,
          platform: v.platform,
          status,
          metadata: { source: 'bulk' },
        }
        const { error } = await (listingsWriter.from('listings') as any).insert(payload)
        if (error) {
          failed.push({ line: r.line, error: error.message })
          continue
        }
        ok++
        touchedCategoryIds.add(gameCategory.id)
      } catch (e: any) {
        failed.push({ line: r.line, error: e?.message ?? 'Unknown error' })
      }
    }

    revalidatePath('/account/listings')
    // Step 7b — one revalidation per category the batch touched.
    if (touchedCategoryIds.size > 0) {
      await revalidateListingSurfaces(listingsWriter as never, {
        gameCategoryIds: [...touchedCategoryIds],
      })
    }

    // SEO — one IndexNow ping for the game hub + category page when bulk
    // rows went live. Individual listing URLs are skipped here (slugs
    // are DB-generated and not selected back in the loop); the sitemap
    // picks them up on the next crawl.
    if (ok > 0 && status === 'active') {
      const { data: pingGame } = await supabase.from('games').select('slug').eq('id', gameId).maybeSingle() as any
      if (pingGame?.slug) {
        await pingIndexNow([`/${pingGame.slug}`, `/${pingGame.slug}/${gameCategory.slug}`])
      }
    }

    return { success: true, data: { ok, failed } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

// ─── IMAGE UPLOAD (same bucket as old flow) ──────────────────────────────────

/**
 * ACC-08 — only an account that may use the sell surface (active seller,
 * admin, or an applicant building drafts) can put files in listing-images;
 * the type and extension come from the bytes, the size cap is server-side,
 * and the object lands under the caller's own prefix (which the storage
 * policy `listing_images_seller_write` re-checks as the caller).
 */
export async function uploadSellImage(
  formData: FormData
): Promise<Result<{ url: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { success: false, error: 'Not signed in' }

    const kind = await sellAccessKind(supabase, user.id)
    if (!canUseSellSurface(kind)) {
      return { success: false, error: 'Only sellers and seller applicants can upload listing images' }
    }

    const file = formData.get('file')
    if (!(file instanceof File)) return { success: false, error: 'No file provided' }
    const checked = await checkListingImage(file)
    if (!checked.ok) return { success: false, error: checked.error }

    const path = listingImagePathFor(user.id, checked.image.ext)
    const { data, error } = await supabase.storage
      .from(LISTING_IMAGE_BUCKET)
      .upload(path, checked.bytes, { cacheControl: '3600', upsert: false, contentType: checked.image.mime })
    if (error) return { success: false, error: error.message }
    const { data: urlData } = supabase.storage.from(LISTING_IMAGE_BUCKET).getPublicUrl(data.path)
    return { success: true, data: { url: urlData.publicUrl } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Upload failed' }
  }
}
