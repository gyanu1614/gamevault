/**
 * V17y — Server actions for the per (game, category_type) config rows.
 *
 * Reads run with the public anon supabase client at request time
 * (used by buyer-side pages); writes go through the service-role
 * client and require admin (used by the admin detail tabs).
 */

'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { createClient as createAnonClient } from '@/lib/supabase/server'
import type {
  CategoryConfigByType,
  CategoryConfigType,
} from '@/lib/types/category-configs'

type Result<T> = { success: true; data: T } | { success: false; error: string }

function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Public read. Returns the config blob (typed) or null when there's
 * no row yet. Buyer-side pages should accept null and render a
 * generic empty state — admin hasn't curated this game's category
 * yet.
 */
export async function fetchCategoryConfig<T extends CategoryConfigType>(
  gameId: string,
  categoryType: T,
): Promise<CategoryConfigByType[T] | null> {
  const supabase = await createAnonClient()
  const { data } = await supabase
    .from('category_configs')
    .select('config')
    .eq('game_id', gameId)
    .eq('category_type', categoryType)
    .maybeSingle()
  if (!data) return null
  return (data as { config: CategoryConfigByType[T] }).config
}

/**
 * Convenience variant that resolves the game by slug. Useful for the
 * marketplace pages which receive slugs in the URL, not ids.
 */
export async function fetchCategoryConfigBySlug<T extends CategoryConfigType>(
  gameSlug: string,
  categoryType: T,
): Promise<CategoryConfigByType[T] | null> {
  const supabase = await createAnonClient()
  const { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('slug', gameSlug)
    .maybeSingle()
  if (!game) return null
  return fetchCategoryConfig((game as { id: string }).id, categoryType)
}

/**
 * Admin write. Upsert keyed on (game_id, category_type) — there's a
 * unique constraint so the same pair always has at most one row.
 * Callers pass the typed config; we store as JSON. No partial-update
 * semantics: the whole blob is replaced. Form should hydrate, edit,
 * and save the whole shape.
 */
export async function upsertCategoryConfig<T extends CategoryConfigType>(
  gameId: string,
  categoryType: T,
  config: CategoryConfigByType[T],
): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    const { data, error } = await (supabase
      .from('category_configs') as any)
      .upsert(
        {
          game_id: gameId,
          category_type: categoryType,
          config,
        },
        { onConflict: 'game_id,category_type' },
      )
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/games')
    revalidatePath(`/admin/games/${gameId}`)
    // Bust the marketplace page too — pricing/copy may have changed.
    revalidatePath('/', 'layout')

    return { success: true, data: { id: (data as { id: string }).id } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

/**
 * Admin read (mirrors fetchCategoryConfig but uses the service-role
 * client, which RLS bypasses). Useful from admin server components
 * when we want to be sure RLS won't quietly omit a row.
 */
export async function fetchCategoryConfigAdmin<T extends CategoryConfigType>(
  gameId: string,
  categoryType: T,
): Promise<CategoryConfigByType[T] | null> {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const { data } = await supabase
    .from('category_configs')
    .select('config')
    .eq('game_id', gameId)
    .eq('category_type', categoryType)
    .maybeSingle()
  if (!data) return null
  return (data as { config: CategoryConfigByType[T] }).config
}

/**
 * V19/P24 — Upload a currency icon or bundle thumbnail and return
 * its public URL. Caller (admin form) writes the URL into the config
 * blob via upsertCategoryConfig. Reuses the existing category-icons
 * bucket with a `currency/` prefix so we keep one bucket + one set
 * of public-access rules. 2MB cap, PNG/JPEG/SVG/WEBP.
 */
export async function uploadCurrencyImage(
  gameId: string,
  fileData: { name: string; type: string; size: number; base64: string },
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

    const base64Data = fileData.base64.split(',')[1] ?? fileData.base64
    const buffer = Buffer.from(base64Data, 'base64')
    const ext = (fileData.name.split('.').pop() ?? 'png').toLowerCase()
    // Stable-ish path includes the gameId + a timestamp so cache
    // busting works without piling up old files (upsert: true).
    const filePath = `currency/${gameId}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('category-icons')
      .upload(filePath, buffer, {
        contentType: fileData.type,
        cacheControl: '3600',
        upsert: true,
      })
    if (uploadError) return { success: false, error: uploadError.message }

    const { data: urlData } = supabase.storage
      .from('category-icons')
      .getPublicUrl(filePath)

    return { success: true, data: { url: urlData.publicUrl } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Upload failed' }
  }
}
