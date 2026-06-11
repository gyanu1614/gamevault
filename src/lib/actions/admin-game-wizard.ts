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
  cover_url: string | null   // portrait cover (added in 20260611_games_cover_url.sql)
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
    .select('id, name, slug, emoji, image_url, cover_url, display_name, sort_order, is_active')
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

// ─── WRITES — logo upload (service-role bucket write) ────────────────────────

/**
 * Upload a game logo using the SERVICE ROLE supabase client, so we don't
 * depend on the category-icons bucket's profiles-based RLS policy (which
 * doesn't see admins whose role is recorded in admin_roles, not profiles.role).
 *
 * Authorization is still gated by requireAdmin() at the top of this action.
 */
export async function uploadGameLogoV2(
  gameId: string,
  fileData: { name: string; type: string; size: number; base64: string }
): Promise<Result<{ url: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(fileData.type)) {
      return { success: false, error: 'Invalid file type. Allowed: PNG, JPEG, SVG, WebP' }
    }
    if (fileData.size > 2_097_152) {
      return { success: false, error: 'File too large. Maximum size: 2MB' }
    }

    // base64 may or may not include a "data:...;base64," prefix
    const commaIdx = fileData.base64.indexOf(',')
    const base64Data = commaIdx >= 0 ? fileData.base64.slice(commaIdx + 1) : fileData.base64
    const buffer = Buffer.from(base64Data, 'base64')

    const fileExt = (fileData.name.split('.').pop() || 'png').toLowerCase()
    const filePath = `games/${gameId}-${Date.now()}.${fileExt}`

    // Try to clean up the previous logo, but don't fail the upload if cleanup misses.
    const { data: existing } = await supabase
      .from('games')
      .select('image_url')
      .eq('id', gameId)
      .maybeSingle()
    const existingUrl = (existing as { image_url: string | null } | null)?.image_url
    if (existingUrl) {
      const marker = '/category-icons/'
      const idx = existingUrl.indexOf(marker)
      if (idx >= 0) {
        const oldPath = existingUrl.slice(idx + marker.length)
        if (oldPath.startsWith('games/')) {
          await supabase.storage.from('category-icons').remove([oldPath])
        }
      }
    }

    const { error: upErr } = await supabase.storage
      .from('category-icons')
      .upload(filePath, buffer, {
        contentType: fileData.type,
        cacheControl: '3600',
        upsert: true,
      })
    if (upErr) return { success: false, error: upErr.message }

    const { data: urlData } = supabase.storage.from('category-icons').getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl

    const { error: updErr } = await supabase
      .from('games')
      .update({ image_url: publicUrl })
      .eq('id', gameId)
    if (updErr) return { success: false, error: updErr.message }

    revalidatePath('/admin/games')
    revalidatePath('/admin/games-v2')
    revalidatePath(`/admin/games-v2/${gameId}/edit`)
    return { success: true, data: { url: publicUrl } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Upload failed' }
  }
}

/**
 * Upload a portrait cover (Popular Games shelf). Writes to game-covers
 * bucket (4 MB) and games.cover_url. Service-role client.
 */
export async function uploadGameCoverV2(
  gameId: string,
  fileData: { name: string; type: string; size: number; base64: string }
): Promise<Result<{ url: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!validTypes.includes(fileData.type)) {
      return { success: false, error: 'Invalid file type. Allowed: PNG, JPEG, WebP' }
    }
    if (fileData.size > 4_194_304) {
      return { success: false, error: 'Cover must be 4 MB or smaller' }
    }

    const commaIdx = fileData.base64.indexOf(',')
    const base64Data = commaIdx >= 0 ? fileData.base64.slice(commaIdx + 1) : fileData.base64
    const buffer = Buffer.from(base64Data, 'base64')

    const ext = (fileData.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `covers/${gameId}-${Date.now()}.${ext}`

    const { data: existing } = await supabase
      .from('games')
      .select('cover_url')
      .eq('id', gameId)
      .maybeSingle()
    const oldUrl = (existing as { cover_url: string | null } | null)?.cover_url
    if (oldUrl) {
      const marker = '/game-covers/'
      const idx = oldUrl.indexOf(marker)
      if (idx >= 0) {
        const oldPath = oldUrl.slice(idx + marker.length)
        if (oldPath.startsWith('covers/')) {
          await supabase.storage.from('game-covers').remove([oldPath])
        }
      }
    }

    const { error: upErr } = await supabase.storage
      .from('game-covers')
      .upload(path, buffer, { contentType: fileData.type, cacheControl: '3600', upsert: true })
    if (upErr) return { success: false, error: upErr.message }

    const { data: urlData } = supabase.storage.from('game-covers').getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    const { error: updErr } = await supabase
      .from('games')
      .update({ cover_url: publicUrl })
      .eq('id', gameId)
    if (updErr) return { success: false, error: updErr.message }

    revalidatePath('/admin/games-v2')
    revalidatePath(`/admin/games-v2/${gameId}/edit`)
    return { success: true, data: { url: publicUrl } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Upload failed' }
  }
}

export async function deleteGameCoverV2(gameId: string): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    const { data: existing } = await supabase
      .from('games')
      .select('cover_url')
      .eq('id', gameId)
      .maybeSingle()
    const oldUrl = (existing as { cover_url: string | null } | null)?.cover_url
    if (oldUrl) {
      const marker = '/game-covers/'
      const idx = oldUrl.indexOf(marker)
      if (idx >= 0) {
        const oldPath = oldUrl.slice(idx + marker.length)
        if (oldPath.startsWith('covers/')) {
          await supabase.storage.from('game-covers').remove([oldPath])
        }
      }
    }

    const { error } = await supabase
      .from('games')
      .update({ cover_url: null })
      .eq('id', gameId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/games-v2')
    revalidatePath(`/admin/games-v2/${gameId}/edit`)
    return { success: true, data: { id: gameId } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Delete failed' }
  }
}

export async function deleteGameLogoV2(gameId: string): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    const { data: existing } = await supabase
      .from('games')
      .select('image_url')
      .eq('id', gameId)
      .maybeSingle()
    const existingUrl = (existing as { image_url: string | null } | null)?.image_url
    if (existingUrl) {
      const marker = '/category-icons/'
      const idx = existingUrl.indexOf(marker)
      if (idx >= 0) {
        const oldPath = existingUrl.slice(idx + marker.length)
        if (oldPath.startsWith('games/')) {
          await supabase.storage.from('category-icons').remove([oldPath])
        }
      }
    }

    const { error } = await supabase
      .from('games')
      .update({ image_url: null })
      .eq('id', gameId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/games')
    revalidatePath('/admin/games-v2')
    revalidatePath(`/admin/games-v2/${gameId}/edit`)
    return { success: true, data: { id: gameId } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Delete failed' }
  }
}

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
