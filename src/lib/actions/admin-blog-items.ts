'use server'

/**
 * Item search for the editor's item card (2026-10-12): the game's own value
 * catalog — Adopt Me pets, Steal a Brainrot brainrots, or the shared values_*
 * pipeline (MM2, Steal an Egg, …). Only items with a value page, so every
 * card's "See Value" link works. Admin only; read-only.
 */
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { searchCatalog } from '@/lib/blog/item-catalog'

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
  // The game's catalogue (Adopt Me pets, SAB brainrots, or values_items): src/lib/blog/item-catalog.ts.
  return rank(await searchCatalog(gameSlug, q), q)
}
