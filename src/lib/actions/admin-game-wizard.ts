/**
 * Admin write actions for the redesigned game wizard (Phase B).
 *
 * Used ONLY by /admin/games/new and /admin/games/[id]/edit.
 * Nothing in the live app calls these — they sit alongside the existing
 * admin-games.ts actions and write to:
 *   - public.games          (existing — shared with classic admin)
 *   - public.game_categories (new — Phase A table)
 *
 * Step 1b — game_categories is the only category table the app writes.
 * Toggle ON  -> ensureGameCategory (creates the pair if missing, enables it)
 * Toggle OFF -> is_enabled = false (never a row delete; listings may
 *               reference it). The legacy public.categories mirror is a DB
 *               trigger during Phase A, not app code.
 */

'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { revalidatePath, revalidateTag } from 'next/cache'
import { ensureGameCategory } from '@/lib/categories'
import { GAME_DIRECTORY_TAG } from '@/lib/marketplace/gameDirectoryCache'
import {
  validateGameIdentity,
  type GameContentTier,
  type GameEcosystem,
} from '@/lib/games/validate-game'

// ─── Service-role client (matches admin-games.ts) ─────────────────────────────

function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GameDetail {
  /** Wide banner behind the blog CTA. Present once the migration is applied. */
  blog_cta_image_url?: string | null
  id: string
  name: string
  slug: string
  /** listed = marketplace-only; data = carries a values/content hub. */
  content_tier: string
  /** roblox | pc | console | mobile | mmo | sports | other */
  ecosystem: string | null
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
  // per-game row (Step 1b)
  slug?: string
  name?: string
  type?: string
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
  /** listed = marketplace-only; data = carries a values/content hub. */
  content_tier?: GameContentTier
  /** Platform bucket; drives SEO templates and seed category defaults. */
  ecosystem?: GameEcosystem | null
}

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── READS ────────────────────────────────────────────────────────────────────

/** Fetch a single game by id. */
export async function fetchGameById(id: string): Promise<GameDetail | null> {
  await requireAdmin()
  const supabase = getAdminSupabase()

  // content_tier/ecosystem come from 20260915100000. Kept in `base` (not the
  // optional tail) because that migration is part of this change set; if it is
  // ever un-applied the same fallback below still keeps the editor up.
  const base =
    'id, name, slug, emoji, image_url, cover_url, display_name, sort_order, is_active, content_tier, ecosystem'

  // blog_cta_image_url arrives in a hand-applied migration. Selecting a column
  // that doesn't exist fails the WHOLE query, which would take the game editor
  // down rather than just hiding one field — so ask for it, and fall back.
  const withBanner = await supabase
    .from('games')
    .select(`${base}, blog_cta_image_url`)
    .eq('id', id)
    .maybeSingle()
  if (!withBanner.error && withBanner.data) return withBanner.data as GameDetail

  const { data, error } = await supabase
    .from('games')
    .select(base)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return data as GameDetail
}

/**
 * All game_categories rows for one game, joined with global_categories
 * for display.
 */
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
      slug,
      name,
      type,
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
    .order('sort_order', { ascending: true })

  if (error || !data) return []
  return (data as any[]).map((r) => ({
    id: r.id,
    game_id: r.game_id,
    global_category_id: r.global_category_id,
    is_enabled: !!r.is_enabled,
    slug: r.slug ?? '',
    name: r.name ?? '',
    type: r.type ?? '',
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

/**
 * Primary global categories (active + inactive) — the wizard's toggle list.
 * Sub-categories (parent_id set: limiteds, skins, …) are not pickers; their
 * per-game rows are preserved but managed elsewhere.
 */
export async function fetchGlobalCategoriesForWizard(): Promise<
  Array<{ id: string; slug: string; name: string; icon_emoji: string | null; is_active: boolean; sort_order: number }>
> {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const { data, error } = await supabase
    .from('global_categories')
    .select('id, slug, name, icon_emoji, is_active, sort_order')
    .is('parent_id', null)
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

    // Validate through the SHARED validator (lib/games/validate-game.ts) so the
    // wizard and the bulk seeder (scripts/seed-games.mjs) can never disagree
    // about what a valid game is. It also rejects slugs that would be shadowed
    // by a top-level route, which this action never used to check.
    //
    // `categories` is not part of the identity step — category enablement is a
    // separate wizard step (upsertGameCategory) — so a single placeholder is
    // passed to satisfy the shared "at least one category" rule.
    const validated = validateGameIdentity({
      name: input.name,
      slug: input.slug,
      ecosystem: input.ecosystem ?? null,
      content_tier: input.content_tier ?? 'listed',
      categories: ['items'],
    })
    if (!validated.ok) return { success: false, error: validated.error }
    const { name, slug } = validated.value

    const payload = {
      name,
      slug,
      display_name: input.display_name?.trim() || null,
      emoji: input.emoji?.trim() || null,
      sort_order: input.sort_order ?? 99,
      ...(input.content_tier !== undefined ? { content_tier: validated.value.content_tier } : {}),
      ...(input.ecosystem !== undefined ? { ecosystem: validated.value.ecosystem } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
    }

    if (input.id) {
      // Update
      const { error } = await supabase.from('games').update(payload).eq('id', input.id)
      if (error) return { success: false, error: error.message }
      revalidatePath('/admin/games')
      revalidatePath('/admin/games')
      revalidatePath(`/admin/games/${input.id}/edit`)
      // Footer game directory renders on every route (unstable_cache).
      revalidateTag(GAME_DIRECTORY_TAG)
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
      revalidatePath('/admin/games')
      // Footer game directory renders on every route (unstable_cache).
      revalidateTag(GAME_DIRECTORY_TAG)
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
    revalidatePath('/admin/games')
    revalidatePath(`/admin/games/${gameId}/edit`)
    // Footer game directory renders on every route (unstable_cache).
    revalidateTag(GAME_DIRECTORY_TAG)
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

    revalidatePath('/admin/games')
    revalidatePath(`/admin/games/${gameId}/edit`)
    // Footer game directory renders on every route (unstable_cache).
    revalidateTag(GAME_DIRECTORY_TAG)
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

    revalidatePath('/admin/games')
    revalidatePath(`/admin/games/${gameId}/edit`)
    // Footer game directory renders on every route (unstable_cache).
    revalidateTag(GAME_DIRECTORY_TAG)
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
    revalidatePath('/admin/games')
    revalidatePath(`/admin/games/${gameId}/edit`)
    // Footer game directory renders on every route (unstable_cache).
    revalidateTag(GAME_DIRECTORY_TAG)
    return { success: true, data: { id: gameId } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Delete failed' }
  }
}

/**
 * Upsert a single (game_id, global_category_id) pair. Used when the admin
 * toggles a category on or edits its per-pair settings.
 *
 * Creation goes through ensureGameCategory (the same path the seeder and
 * scripts use); the per-pair settings are applied on the returned row.
 */
export async function upsertGameCategory(
  input: UpsertGameCategoryInput
): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    const { data: gc } = await supabase
      .from('global_categories')
      .select('slug')
      .eq('id', input.global_category_id)
      .maybeSingle()
    const globalSlug = (gc as { slug: string } | null)?.slug
    if (!globalSlug) return { success: false, error: 'Unknown global category' }

    const ensured = await ensureGameCategory(supabase, {
      gameId: input.game_id,
      globalSlug,
      enabled: input.is_enabled,
    })
    const gameCategoryRowId = ensured.id

    const payload: any = {}
    if (input.requires_region     !== undefined) payload.requires_region     = input.requires_region
    if (input.available_regions   !== undefined) payload.available_regions   = input.available_regions
    if (input.requires_platform   !== undefined) payload.requires_platform   = input.requires_platform
    if (input.available_platforms !== undefined) payload.available_platforms = input.available_platforms
    if (input.delivery_modes      !== undefined) payload.delivery_modes      = input.delivery_modes
    if (input.sort_order          !== undefined) payload.sort_order          = input.sort_order
    if (input.seo_title           !== undefined) payload.seo_title           = input.seo_title
    if (input.seo_description     !== undefined) payload.seo_description     = input.seo_description
    if (Object.keys(payload).length > 0) {
      const { error } = await supabase
        .from('game_categories')
        .update(payload)
        .eq('id', gameCategoryRowId)
      if (error) return { success: false, error: error.message }
    }

    revalidatePath('/admin/games')
    // Footer game directory renders on every route (unstable_cache).
    revalidateTag(GAME_DIRECTORY_TAG)
    return { success: true, data: { id: gameCategoryRowId } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

/**
 * Upload the per-game banner behind the end-of-article CTA on
 * /[game]/blog/[slug].
 *
 * Deliberately separate from uploadGameCoverV2: cover_url is the game's CARD
 * art (portrait-ish, cropped for a tile, used across the marketplace), while
 * this is a wide banner that copy sits on top of. Sharing one column would
 * mean a card crop change silently reflows every article CTA.
 *
 * Recommended asset: 2560 x 640 (4:1), JPG/WebP, under 400 KB. It renders up
 * to 1280px wide and ~260px tall, so 2560 covers 2x displays. Keep the focal
 * point off-centre-left — the copy occupies the left third under a scrim.
 *
 * Reuses the existing `game-covers` bucket under a `blog-cta/` prefix, so no
 * new bucket or storage policy is required.
 */
export async function uploadGameBlogCtaImage(
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
      return { success: false, error: 'Banner must be 4 MB or smaller' }
    }

    const commaIdx = fileData.base64.indexOf(',')
    const base64Data = commaIdx >= 0 ? fileData.base64.slice(commaIdx + 1) : fileData.base64
    const buffer = Buffer.from(base64Data, 'base64')

    const ext = (fileData.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `blog-cta/${gameId}-${Date.now()}.${ext}`

    // Clear the previous banner so the bucket doesn't accumulate orphans.
    const { data: existing } = await supabase
      .from('games')
      .select('blog_cta_image_url')
      .eq('id', gameId)
      .maybeSingle()
    const oldUrl = (existing as { blog_cta_image_url: string | null } | null)
      ?.blog_cta_image_url
    if (oldUrl) {
      const marker = '/game-covers/'
      const idx = oldUrl.indexOf(marker)
      if (idx >= 0) {
        const oldPath = oldUrl.slice(idx + marker.length)
        if (oldPath.startsWith('blog-cta/')) {
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
      .update({ blog_cta_image_url: publicUrl })
      .eq('id', gameId)
    if (updErr) {
      // The column ships in a migration that is applied by hand; say so plainly
      // rather than surfacing a raw Postgres error.
      if (/blog_cta_image_url/.test(updErr.message)) {
        return {
          success: false,
          error:
            'The blog_cta_image_url column is missing — apply migration ' +
            '20260730120000_games_blog_cta_image.sql, then try again.',
        }
      }
      return { success: false, error: updErr.message }
    }

    revalidatePath('/admin/games')
    revalidatePath(`/admin/games/${gameId}/edit`)
    // Footer game directory renders on every route (unstable_cache).
    revalidateTag(GAME_DIRECTORY_TAG)
    return { success: true, data: { url: publicUrl } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Upload failed' }
  }
}
