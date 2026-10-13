'use server'

/**
 * Item search for the editor's item card (2026-10-12): the game's own value
 * catalog — Adopt Me pets, Steal a Brainrot brainrots, or the shared values_*
 * pipeline (MM2, Steal an Egg, …). Only items with a value page, so every
 * card's "See Value" link works. Admin only; read-only.
 */
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { createAnonClient } from '@/lib/supabase/anon'
import { getValueItems } from '@/lib/values/data'

export interface BlogItemHit {
  slug: string
  name: string
  imageUrl: string | null
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function rank(rows: BlogItemHit[], q: string): BlogItemHit[] {
  const needle = norm(q)
  if (!needle) return rows.slice(0, 12)
  return rows
    .map((r) => ({ r, n: norm(r.name) }))
    .filter(({ n }) => n.includes(needle))
    .sort((a, b) => Number(!a.n.startsWith(needle)) - Number(!b.n.startsWith(needle)) || a.n.length - b.n.length)
    .slice(0, 12)
    .map(({ r }) => r)
}

export async function searchBlogItems(gameSlug: string, q: string): Promise<BlogItemHit[]> {
  await requireAdmin()
  const supabase = createAnonClient() as any
  if (gameSlug === 'adopt-me') {
    const { data } = await supabase.from('adopt_me_pets').select('slug,name,image_url').eq('is_active', true).eq('has_page', true).ilike('name', `%${q.replace(/[%_]/g, '')}%`).limit(40)
    return rank(((data ?? []) as Array<{ slug: string; name: string; image_url: string | null }>).map((r) => ({ slug: r.slug, name: r.name, imageUrl: r.image_url })), q)
  }
  if (gameSlug === 'steal-a-brainrot') {
    const { data } = await supabase.from('sab_brainrot_market_catalog').select('slug,name,image_url').ilike('name', `%${q.replace(/[%_]/g, '')}%`).limit(40)
    return rank(((data ?? []) as Array<{ slug: string; name: string; image_url: string | null }>).map((r) => ({ slug: r.slug, name: r.name, imageUrl: r.image_url })), q)
  }
  const items = await getValueItems(gameSlug).catch(() => [])
  return rank(items.map((i) => ({ slug: i.slug, name: i.name, imageUrl: i.imageUrl })), q)
}
