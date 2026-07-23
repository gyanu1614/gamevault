'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GameData {
  name: string
  slug: string
  emoji?: string | null
  image_url?: string | null
  display_name?: string | null
  sort_order?: number
}

// Service-role client — bypasses RLS for admin mutations
function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function fetchAdminGames() {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { data: gamesData, error } = await supabase
    .from('games')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error || !gamesData) return []

  const { data: counts } = await supabase
    .from('listings')
    .select('game_id')
    .eq('status', 'active')

  const countMap: Record<string, number> = {}
  counts?.forEach((l: any) => {
    countMap[l.game_id] = (countMap[l.game_id] || 0) + 1
  })

  return gamesData.map((g: any) => ({ ...g, listing_count: countMap[g.id] || 0 }))
}

export async function deleteGame(id: string) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { error } = await supabase.from('games').delete().eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/games')
  return { success: true }
}

export async function updateGame(id: string, data: GameData) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { error } = await supabase
    .from('games')
    .update({
      name: data.name,
      slug: data.slug,
      emoji: data.emoji || null,
      image_url: data.image_url || null,
      display_name: data.display_name || null,
      sort_order: data.sort_order ?? 99,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/games')
  return { success: true }
}

export async function insertGame(data: GameData) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { error } = await supabase.from('games').insert({
    name: data.name,
    slug: data.slug,
    emoji: data.emoji || null,
    image_url: data.image_url || null,
    display_name: data.display_name || null,
    sort_order: data.sort_order ?? 99,
    is_active: true,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/games')
  return { success: true }
}

export async function toggleGameActive(id: string, isActive: boolean) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { error } = await supabase
    .from('games')
    .update({ is_active: !isActive })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/games')
  return { success: true }
}

/**
 * V17s — Flip games.is_popular so the homepage Popular Games shelf
 * picks up / drops the game. Pair input matches toggleGameActive:
 * pass the CURRENT flag and the action flips it.
 */
export async function toggleGamePopular(id: string, isPopular: boolean) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { error } = await (supabase
    .from('games') as any)
    .update({ is_popular: !isPopular })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/games')
  // Also bust the homepage's cache. The hook keys are 'popular-games'.
  revalidatePath('/')
  return { success: true }
}

/**
 * Flip games.is_spotlight so the mobile hamburger "Spotlight" games grid
 * features / drops the game. Independent of is_popular. Same
 * current-flag-in, action-flips pattern as toggleGamePopular.
 */
export async function toggleGameSpotlight(id: string, isSpotlight: boolean) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { error } = await (supabase
    .from('games') as any)
    .update({ is_spotlight: !isSpotlight })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/games')
  // Bust the marketplace-menu spotlight query on the client side too.
  revalidatePath('/')
  return { success: true }
}

// ─── SEO overrides ────────────────────────────────────────────────────────────

export interface GameSeoData {
  seo_title?: string | null
  seo_description?: string | null
  seo_h1?: string | null
  seo_intro?: string | null
  ecosystem?: string | null
  /** true = force index, false = force noindex, null = auto by content. */
  seo_indexable?: boolean | null
  seo_noindex_reason?: string | null
}

/** Read a game's SEO override fields for the admin SEO tab. */
export async function fetchGameSeo(id: string): Promise<GameSeoData & { name: string; slug: string } | null> {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const { data, error } = await (supabase
    .from('games') as any)
    .select('name, slug, seo_title, seo_description, seo_h1, seo_intro, ecosystem, seo_indexable, seo_noindex_reason')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as any
}

/**
 * Save a game's SEO override fields. Blank strings are stored as NULL so the
 * template layer falls back to auto-generation (empty override = use template).
 */
export async function updateGameSeo(id: string, data: GameSeoData) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const nn = (v: string | null | undefined) => {
    const t = (v ?? '').trim()
    return t.length > 0 ? t : null
  }

  const { error } = await (supabase.from('games') as any)
    .update({
      seo_title: nn(data.seo_title),
      seo_description: nn(data.seo_description),
      seo_h1: nn(data.seo_h1),
      seo_intro: nn(data.seo_intro),
      ecosystem: nn(data.ecosystem),
      seo_indexable: data.seo_indexable ?? null,
      seo_noindex_reason: nn(data.seo_noindex_reason),
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/games')
  revalidatePath('/') // public pages read the templates
  return { success: true }
}

// ─── Game Icon Upload ─────────────────────────────────────────────────────────

export async function uploadGameIcon(
  gameId: string,
  fileData: { name: string; type: string; size: number; base64: string }
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(fileData.type)) {
      return { success: false, error: 'Invalid file type. Allowed: PNG, JPEG, SVG, WebP' }
    }

    // Validate file size (2MB limit)
    if (fileData.size > 2097152) {
      return { success: false, error: 'File too large. Maximum size: 2MB' }
    }

    // Convert base64 to buffer
    const base64Data = fileData.base64.split(',')[1]
    const buffer = Buffer.from(base64Data, 'base64')

    // Generate unique filename with 'games/' prefix to separate from categories
    const fileExt = fileData.name.split('.').pop()
    const fileName = `games/${gameId}-${Date.now()}.${fileExt}`
    const filePath = `${fileName}`

    // Delete old icon if exists
    const { data: existingData } = await supabase
      .from('games')
      .select('image_url')
      .eq('id', gameId)
      .single() as { data: { image_url: string | null } | null }

    if (existingData?.image_url) {
      const oldFileName = existingData.image_url.split('/').pop()
      if (oldFileName && oldFileName.startsWith('games/')) {
        await supabase.storage.from('category-icons').remove([oldFileName])
      }
    }

    // Upload new icon (using category-icons bucket)
    const { error: uploadError } = await supabase.storage
      .from('category-icons')
      .upload(filePath, buffer, {
        contentType: fileData.type,
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('category-icons')
      .getPublicUrl(filePath)

    const iconUrl = urlData.publicUrl

    // Update game with new icon URL
    const adminSupabase = getAdminSupabase()
    const { error: updateError } = await adminSupabase
      .from('games')
      .update({
        image_url: iconUrl,
      })
      .eq('id', gameId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath('/admin/games')
    return { success: true, url: iconUrl }
  } catch (error: any) {
    return { success: false, error: error.message || 'Upload failed' }
  }
}

export async function deleteGameIcon(gameId: string) {
  try {
    await requireAdmin()
    const supabase = await createClient()

    // Get current icon URL
    const adminSupabase = getAdminSupabase()
    const { data: gameData } = await adminSupabase
      .from('games')
      .select('image_url')
      .eq('id', gameId)
      .single() as { data: { image_url: string | null } | null }

    if (gameData?.image_url) {
      // Extract the full path including 'games/' prefix
      const urlParts = gameData.image_url.split('/category-icons/')
      if (urlParts.length > 1) {
        const filePath = urlParts[1]
        await supabase.storage.from('category-icons').remove([filePath])
      }
    }

    // Reset game to emoji icon
    const { error } = await adminSupabase
      .from('games')
      .update({
        image_url: null,
      })
      .eq('id', gameId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/games')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Delete failed' }
  }
}
