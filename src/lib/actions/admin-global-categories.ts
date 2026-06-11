/**
 * Admin reads/writes for the 5 global categories. Used only by
 * /admin/categories-v2. Lives alongside the existing admin-categories.ts
 * (which manages the old game-scoped table) and never modifies it.
 */

'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { revalidatePath } from 'next/cache'

function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface GlobalCategoryAdminRow {
  id: string
  slug: string
  name: string
  description: string | null
  icon_emoji: string | null
  icon_url: string | null
  sort_order: number
  is_active: boolean
  seo_title: string | null
  seo_description: string | null
  /** count of game_categories rows pointing at this global category */
  game_count: number
}

export interface SaveGlobalCategoryInput {
  id: string
  name?: string
  description?: string | null
  icon_emoji?: string | null
  sort_order?: number
  is_active?: boolean
  seo_title?: string | null
  seo_description?: string | null
}

type Result<T> = { success: true; data: T } | { success: false; error: string }

export async function fetchAdminGlobalCategories(): Promise<GlobalCategoryAdminRow[]> {
  await requireAdmin()
  const supabase = getAdminSupabase()

  const [{ data: cats, error: catsErr }, { data: links, error: linksErr }] = await Promise.all([
    supabase
      .from('global_categories')
      .select('id, slug, name, description, icon_emoji, icon_url, sort_order, is_active, seo_title, seo_description')
      .order('sort_order', { ascending: true }),
    supabase
      .from('game_categories')
      .select('global_category_id, is_enabled'),
  ])

  if (catsErr || !cats) return []
  if (linksErr) {
    // non-fatal — just report game_count as 0
  }

  const counts = new Map<string, number>()
  for (const row of (links as any[]) ?? []) {
    if (!row.is_enabled) continue
    counts.set(row.global_category_id, (counts.get(row.global_category_id) ?? 0) + 1)
  }

  return (cats as any[]).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description ?? null,
    icon_emoji: c.icon_emoji ?? null,
    icon_url: c.icon_url ?? null,
    sort_order: c.sort_order ?? 0,
    is_active: !!c.is_active,
    seo_title: c.seo_title ?? null,
    seo_description: c.seo_description ?? null,
    game_count: counts.get(c.id) ?? 0,
  }))
}

export async function saveGlobalCategory(
  input: SaveGlobalCategoryInput
): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin()
    const supabase = getAdminSupabase()

    const payload: Record<string, unknown> = {}
    if (input.name !== undefined)             payload.name = input.name.trim()
    if (input.description !== undefined)      payload.description = input.description?.trim() || null
    if (input.icon_emoji !== undefined)       payload.icon_emoji = input.icon_emoji?.trim() || null
    if (input.sort_order !== undefined)       payload.sort_order = input.sort_order
    if (input.is_active !== undefined)        payload.is_active = input.is_active
    if (input.seo_title !== undefined)        payload.seo_title = input.seo_title?.trim() || null
    if (input.seo_description !== undefined)  payload.seo_description = input.seo_description?.trim() || null

    if (Object.keys(payload).length === 0) {
      return { success: true, data: { id: input.id } }
    }

    const { error } = await supabase.from('global_categories').update(payload).eq('id', input.id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/categories-v2')
    revalidatePath('/admin/games-v2')
    return { success: true, data: { id: input.id } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}
