'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { revalidatePath, revalidateTag } from 'next/cache'
import { GAME_DIRECTORY_TAG } from '@/lib/marketplace/gameDirectoryCache'

/**
 * /admin/categories — flat list of every per-game category row
 * (game_categories) with edit / pause / disable / icon upload.
 *
 * Step 1b: creation is NOT here. A (game, category) pair is created from the
 * game wizard (or the seeder) through ensureGameCategory; this page edits
 * what exists. "Delete" disables the row (is_enabled = false) — never a row
 * delete, listings may reference it.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryData {
  name: string
  slug: string
  description?: string | null
  icon_emoji?: string | null
  icon_url?: string | null
  sort_order?: number
  is_enabled?: boolean
}

export interface AdminCategoryRow {
  id: string
  game_id: string
  game_name: string
  game_slug: string
  global_slug: string
  name: string
  slug: string
  type: string
  description: string | null
  icon_emoji: string | null
  icon_url: string | null
  icon_type: 'emoji' | 'image' | 'svg'
  sort_order: number
  is_enabled: boolean
  listing_count: number
}

// Service-role client — bypasses RLS for admin mutations
function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function iconTypeOf(iconUrl: string | null): AdminCategoryRow['icon_type'] {
  if (!iconUrl) return 'emoji'
  return iconUrl.toLowerCase().endsWith('.svg') ? 'svg' : 'image'
}

function revalidateCategorySurfaces() {
  revalidatePath('/admin/categories')
  revalidatePath('/admin/games')
  // Footer game directory renders on every route (unstable_cache).
  revalidateTag(GAME_DIRECTORY_TAG)
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function fetchAdminCategories(gameId?: string): Promise<AdminCategoryRow[]> {
  await requireAdmin()
  const supabase = getAdminSupabase()

  let query = supabase
    .from('game_categories')
    .select(`
      id, game_id, name, slug, type, description, icon_emoji, icon_url, sort_order, is_enabled,
      game:games!game_categories_game_id_fkey(name, slug),
      global_category:global_categories!game_categories_global_category_id_fkey(slug)
    `)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (gameId) query = query.eq('game_id', gameId)

  const { data, error } = await query
  if (error || !data) return []

  // Count active listings per category
  const { data: counts } = await supabase
    .from('listings')
    .select('game_category_id')
    .eq('status', 'active')

  const countMap: Record<string, number> = {}
  counts?.forEach((l: any) => {
    if (l.game_category_id) countMap[l.game_category_id] = (countMap[l.game_category_id] || 0) + 1
  })

  return (data as any[]).map((c) => ({
    id: c.id,
    game_id: c.game_id,
    game_name: c.game?.name ?? '',
    game_slug: c.game?.slug ?? '',
    global_slug: c.global_category?.slug ?? '',
    name: c.name,
    slug: c.slug,
    type: c.type,
    description: c.description ?? null,
    icon_emoji: c.icon_emoji ?? null,
    icon_url: c.icon_url ?? null,
    icon_type: iconTypeOf(c.icon_url ?? null),
    sort_order: c.sort_order ?? 0,
    is_enabled: !!c.is_enabled,
    listing_count: countMap[c.id] || 0,
  }))
}

/** "Delete" from the admin UI = disable. The row (and its listings) stay. */
export async function deleteCategory(id: string) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { error } = await supabase.from('game_categories').update({ is_enabled: false }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidateCategorySurfaces()
  return { success: true }
}

export async function updateCategory(id: string, data: CategoryData) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { error } = await supabase
    .from('game_categories')
    .update({
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      icon_emoji: data.icon_emoji || null,
      icon_url: data.icon_url || null,
      sort_order: data.sort_order ?? 99,
      is_enabled: data.is_enabled ?? true,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidateCategorySurfaces()
  return { success: true }
}

export async function toggleCategoryActive(id: string, isEnabled: boolean) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { error } = await supabase
    .from('game_categories')
    .update({ is_enabled: isEnabled })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidateCategorySurfaces()
  return { success: true }
}

// ─── Icon Upload ──────────────────────────────────────────────────────────────

export async function uploadCategoryIcon(
  categoryId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return { success: false, error: 'Invalid file type. Allowed: PNG, JPEG, SVG, WebP' }
    }

    // Validate file size (2MB limit)
    if (file.size > 2097152) {
      return { success: false, error: 'File too large. Maximum size: 2MB' }
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${categoryId}-${Date.now()}.${fileExt}`
    const filePath = `${fileName}`

    const adminSupabase = getAdminSupabase()

    // Delete old icon if exists
    const { data: existingData } = await adminSupabase
      .from('game_categories')
      .select('icon_url')
      .eq('id', categoryId)
      .single() as { data: { icon_url: string | null } | null }

    if (existingData?.icon_url) {
      const oldFileName = existingData.icon_url.split('/').pop()
      if (oldFileName) {
        await supabase.storage.from('category-icons').remove([oldFileName])
      }
    }

    // Upload new icon
    const { error: uploadError } = await supabase.storage
      .from('category-icons')
      .upload(filePath, file, {
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

    // Update category with new icon URL
    const { error: updateError } = await adminSupabase
      .from('game_categories')
      .update({ icon_url: iconUrl })
      .eq('id', categoryId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidateCategorySurfaces()
    return { success: true, url: iconUrl }
  } catch (error: any) {
    return { success: false, error: error.message || 'Upload failed' }
  }
}

export async function deleteCategoryIcon(categoryId: string) {
  try {
    await requireAdmin()
    const supabase = await createClient()
    const adminSupabase = getAdminSupabase()

    // Get current icon URL
    const { data: categoryData } = await adminSupabase
      .from('game_categories')
      .select('icon_url')
      .eq('id', categoryId)
      .single() as { data: { icon_url: string | null } | null }

    if (categoryData?.icon_url) {
      const fileName = categoryData.icon_url.split('/').pop()
      if (fileName) {
        await supabase.storage.from('category-icons').remove([fileName])
      }
    }

    // Reset category to emoji icon
    const { error } = await adminSupabase
      .from('game_categories')
      .update({ icon_url: null })
      .eq('id', categoryId)

    if (error) return { success: false, error: error.message }
    revalidateCategorySurfaces()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Delete failed' }
  }
}
