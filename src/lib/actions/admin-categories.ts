'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryData {
  name: string
  slug: string
  description?: string | null
  icon_emoji?: string | null
  icon_url?: string | null
  icon_type?: 'emoji' | 'image' | 'svg'
  sort_order?: number
  is_active?: boolean
}

// Service-role client — bypasses RLS for admin mutations
function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function fetchAdminCategories() {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { data: categoriesData, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error || !categoriesData) return []

  // Count listings per category
  const { data: counts } = await supabase
    .from('listings')
    .select('category_id')
    .eq('status', 'active')

  const countMap: Record<string, number> = {}
  counts?.forEach((l: any) => {
    countMap[l.category_id] = (countMap[l.category_id] || 0) + 1
  })

  return categoriesData.map((c: any) => ({ ...c, listing_count: countMap[c.id] || 0 }))
}

export async function deleteCategory(id: string) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  // Check if category has listings
  const { count } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)

  if (count && count > 0) {
    return { success: false, error: `Cannot delete category with ${count} active listings` }
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/categories')
  return { success: true }
}

export async function updateCategory(id: string, data: CategoryData) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { error } = await supabase
    .from('categories')
    .update({
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      icon_emoji: data.icon_emoji || null,
      icon_url: data.icon_url || null,
      icon_type: data.icon_type || 'emoji',
      sort_order: data.sort_order ?? 99,
      is_active: data.is_active ?? true,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/categories')
  return { success: true }
}

export async function insertCategory(data: CategoryData) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { error } = await supabase.from('categories').insert({
    name: data.name,
    slug: data.slug,
    description: data.description || null,
    icon_emoji: data.icon_emoji || '📦',
    icon_url: data.icon_url || null,
    icon_type: data.icon_type || 'emoji',
    sort_order: data.sort_order ?? 99,
    is_active: data.is_active ?? true,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/categories')
  return { success: true }
}

export async function toggleCategoryActive(id: string, isActive: boolean) {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const { error } = await supabase
    .from('categories')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/categories')
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

    // Delete old icon if exists
    const { data: existingData } = await supabase
      .from('categories')
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
    const adminSupabase = getAdminSupabase()
    const { error: updateError } = await adminSupabase
      .from('categories')
      .update({
        icon_url: iconUrl,
        icon_type: file.type.includes('svg') ? 'svg' : 'image',
      })
      .eq('id', categoryId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath('/admin/categories')
    return { success: true, url: iconUrl }
  } catch (error: any) {
    return { success: false, error: error.message || 'Upload failed' }
  }
}

export async function deleteCategoryIcon(categoryId: string) {
  try {
    await requireAdmin()
    const supabase = await createClient()

    // Get current icon URL
    const adminSupabase = getAdminSupabase()
    const { data: categoryData } = await adminSupabase
      .from('categories')
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
      .from('categories')
      .update({
        icon_url: null,
        icon_type: 'emoji',
      })
      .eq('id', categoryId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/categories')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Delete failed' }
  }
}
