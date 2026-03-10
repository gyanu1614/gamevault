'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
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
