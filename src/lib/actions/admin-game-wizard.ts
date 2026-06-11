/**
 * Admin write actions for the redesigned game wizard (Phase B).
 *
 * Used ONLY by /admin/games-v2/new and /admin/games-v2/[id]/edit.
 * Nothing in the live app calls these — they sit alongside the existing
 * admin-games.ts actions and write to:
 *   - public.games          (existing — shared with classic admin)
 *   - public.game_categories (new — Phase A table)
 *
 * Hard rule: never modify `categories` (the old game-scoped table) here.
 * The classic admin still owns that. We only touch the new join.
 */

'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { revalidatePath } from 'next/cache'

// ─── Service-role client (matches admin-games.ts) ─────────────────────────────

function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GameDetail {
  id: string
  name: string
  slug: string
  emoji: string | null
  image_url: string | null   // logo URL (existing column)
  display_name: string | null
  sort_order: number
  is_active: boolean
}

export interface GameCategoryRow {
  id: string
  game_id: string
  global_category_id: string
  is_enabled: boolean
  requires_region: boolean
  available_regions: Array<{ code: string; name: string; currency?: string }>
  requires_platform: boolean
  available_platforms: string[]
  delivery_modes: string[]
  sort_order: number
  seo_title: string | null
  seo_description: string | null
  // joined for convenience
  global_category_slug?: string
  global_category_name?: string
  global_category_emoji?: string | null
  global_category_active?: boolean
}

export interface UpsertGameCategoryInput {
  game_id: string
  global_category_id: string
  is_enabled: boolean
  requires_region?: boolean
  available_regions?: Array<{ code: string; name: string; currency?: string }>
  requires_platform?: boolean
  available_platforms?: string[]
  delivery_modes?: string[]
  sort_order?: number
  seo_title?: string | null
  seo_description?: string | null
}

export interface SaveGameIdentityInput {
  id?: string                // omit for create
  name: string
  slug: string
  display_name?: string | null
  emoji?: string | null
  sort_order?: number
  is_active?: boolean
}

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── READS ────────────────────────────────────────────────────────────────────

/** Fetch a single game by id. */
export async function fetchGameById(id: string): Promise<GameDetail | null> {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const { data, error } = await supabase
    .from('games')
    .select('id, name, slug, emoji, image_url, display_name, sort_order, is_active')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return data as GameDetail
}

/** All game_categories rows for one game, joined with global_categories for display. */
export async function fetchGameCategoryRows(gameId: string): Promise<GameCategoryRow[]> {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const { data, error } = await supabase
    .from('game_categories')
    .select(`
      id,
      game_id,
      global_category_id,
      is_enabled,
      requires_region,
      available_regions,
      requires_platform,
      available_platforms,
      delivery_modes,
      sort_order,
      seo_title,
      seo_description,
      global_category:global_categories!game_categories_global_category_id_fkey(slug, name, icon_emoji, is_active)
    `)
    .eq('game_id', gameId)

  if (error || !data) return []
  return (data as any[]).map((r) => ({
    id: r.id,
    game_id: r.game_id,
    global_category_id: r.global_category_id,
    is_enabled: !!r.is_enabled,
    requires_region: !!r.requires_region,
    available_regions: Array.isArray(r.available_regions) ? r.available_regions : [],
    requires_platform: !!r.requires_platform,
    available_platforms: Array.isArray(r.available_platforms) ? r.available_platforms : [],
    delivery_modes: Array.isArray(r.delivery_modes) ? r.delivery_modes : ['manual'],
    sort_order: r.sort_order ?? 0,
    seo_title: r.seo_title ?? null,
    seo_description: r.seo_description ?? null,
    global_category_slug:   r.global_category?.slug   ?? '',
    global_category_name:   r.global_category?.name   ?? '',
    global_category_emoji:  r.global_category?.icon_emoji ?? null,
    global_category_active: !!r.global_category?.is_active,
  }))
}

/** All global categories (active + inactive) — used by the wizard's toggle list. */
export async function fetchGlobalCategoriesForWizard(): Promise<
  Array<{ id: string; slug: string; name: string; icon_emoji: string | null; is_active: boolean; sort_order: number }>
> {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const { data, error } = await supabase
    .from('global_categories')
    .select('id, slug, name, icon_emoji, is_active, sort_order')
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as any
}

// ─── WRITES — game identity ───────────────────────────────────────────────────

/**
 * Create or update the game's identity (name/slug/etc). Mirrors the existing
 * insertGame/updateGame actions but returns the id so the wizard can continue.
 */
export async function saveGameIdentity(
  input: SaveGameIdentityInput
): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    // Validate
    const name = input.name.trim()
    const slug = input.slug.trim().toLowerCase()
    if (name.length < 2)  return { success: false, error: 'Name must be at least 2 characters' }
    if (!/^[a-z0-9-]+$/.test(slug)) return { success: false, error: 'Slug must be lowercase letters, numbers, and dashes only' }

    const payload = {
      name,
      slug,
      display_name: input.display_name?.trim() || null,
      emoji: input.emoji?.trim() || null,
      sort_order: input.sort_order ?? 99,
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
    }

    if (input.id) {
      // Update
      const { error } = await supabase.from('games').update(payload).eq('id', input.id)
      if (error) return { success: false, error: error.message }
      revalidatePath('/admin/games')
      revalidatePath('/admin/games-v2')
      revalidatePath(`/admin/games-v2/${input.id}/edit`)
      return { success: true, data: { id: input.id } }
    } else {
      // Insert — slug uniqueness will throw a 23505 error from Postgres
      const { data, error } = await supabase
        .from('games')
        .insert({ ...payload, is_active: input.is_active ?? true })
        .select('id')
        .single()
      if (error) {
        if ((error as any).code === '23505') {
          return { success: false, error: `Slug "${slug}" is already taken` }
        }
        return { success: false, error: error.message }
      }
      revalidatePath('/admin/games')
      revalidatePath('/admin/games-v2')
      return { success: true, data: { id: (data as any).id } }
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

// ─── WRITES — game_categories ────────────────────────────────────────────────

/**
 * Upsert a single (game_id, global_category_id) pair. Used when the admin
 * toggles a category on or edits its per-pair settings.
 */
export async function upsertGameCategory(
  input: UpsertGameCategoryInput
): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    // Look for existing row
    const { data: existing } = await supabase
      .from('game_categories')
      .select('id')
      .eq('game_id', input.game_id)
      .eq('global_category_id', input.global_category_id)
      .maybeSingle()

    const payload: any = {
      game_id: input.game_id,
      global_category_id: input.global_category_id,
      is_enabled: input.is_enabled,
    }
    if (input.requires_region     !== undefined) payload.requires_region     = input.requires_region
    if (input.available_regions   !== undefined) payload.available_regions   = input.available_regions
    if (input.requires_platform   !== undefined) payload.requires_platform   = input.requires_platform
    if (input.available_platforms !== undefined) payload.available_platforms = input.available_platforms
    if (input.delivery_modes      !== undefined) payload.delivery_modes      = input.delivery_modes
    if (input.sort_order          !== undefined) payload.sort_order          = input.sort_order
    if (input.seo_title           !== undefined) payload.seo_title           = input.seo_title
    if (input.seo_description     !== undefined) payload.seo_description     = input.seo_description

    if (existing) {
      const { error } = await supabase
        .from('game_categories')
        .update(payload)
        .eq('id', (existing as any).id)
      if (error) return { success: false, error: error.message }
      revalidatePath('/admin/games-v2')
      return { success: true, data: { id: (existing as any).id } }
    } else {
      const { data, error } = await supabase
        .from('game_categories')
        .insert(payload)
        .select('id')
        .single()
      if (error) return { success: false, error: error.message }
      revalidatePath('/admin/games-v2')
      return { success: true, data: { id: (data as any).id } }
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}
