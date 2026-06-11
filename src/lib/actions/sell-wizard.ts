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
import { revalidatePath } from 'next/cache'
import { getGlobalCategories, getGamesForGlobalCategory, getAttributeTemplateFull } from '@/lib/actions/new-schema'
import type { GlobalCategory, GameCategory, AttributeTemplateFull, Attribute } from '@/lib/actions/new-schema'

// ─── Result helper ───────────────────────────────────────────────────────────

type Result<T> = { success: true; data: T } | { success: false; error: string }

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
  status: 'draft' | 'active'
}

/**
 * Publish (or save as draft) a listing. Writes to the EXISTING `listings`
 * table — the marketplace browse and detail pages keep reading the same
 * rows. We resolve the old game-scoped category_id from (game_id, type)
 * so marketplace filters like `category_id = X` keep matching.
 */
export async function publishListing(input: PublishListingInput): Promise<Result<{ id: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { success: false, error: 'Not signed in' }

    // Map global category slug -> 'type' metadata value on the legacy
    // game-scoped categories table, so we can find the matching old row.
    const slugToType: Record<string, string> = {
      'currency': 'currency',
      'items':    'items',
      'accounts': 'account',
      'top-up':   'top_up',
      'boosting': 'service',
    }
    const legacyType = slugToType[input.category_slug]
    if (!legacyType) return { success: false, error: 'Unknown category' }

    const { data: legacyCat } = await supabase
      .from('categories')
      .select('id')
      .eq('game_id', input.game_id)
      .eq('is_active', true)
      .filter('metadata->>type', 'eq', legacyType)
      .maybeSingle()

    if (!legacyCat) {
      return { success: false, error: 'This category isn’t enabled for this game yet.' }
    }

    const insertPayload: Record<string, unknown> = {
      seller_id: user.id,
      game_id: input.game_id,
      category_id: (legacyCat as { id: string }).id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      price: input.price,
      original_price: input.original_price ?? null,
      quantity: input.quantity,
      min_quantity: input.min_quantity,
      delivery_method: input.delivery_method,
      delivery_time: input.delivery_time ?? null,
      images: input.images,
      template_data: input.template_data,
      region: input.region ?? null,
      platform: input.platform ?? null,
      status: input.status,
    }

    const { data, error } = await (supabase
      .from('listings') as any)
      .insert(insertPayload)
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }

    revalidatePath('/account/listings')
    return { success: true, data: { id: (data as { id: string }).id } }
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
