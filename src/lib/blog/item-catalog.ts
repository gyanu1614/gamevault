import 'server-only'

/**
 * A game's value items, for blog posts (Blog v2) — ONE place that knows where
 * each game's catalogue lives, shared by the editor's item search and the
 * article's table pictures, so both always agree:
 *   - Adopt Me: adopt_me_pets (only pets with a value page)
 *   - Steal a Brainrot: sab_brainrot_market_catalog
 *   - every other game: the shared values_* pipeline (getValueItems, cached)
 * A new game needs no code here once its items are in values_items.
 */
import { createAnonClient } from '@/lib/supabase/anon'
import { createValueListReadClient } from '@/lib/values/read-client'
import { getValueItems } from '@/lib/values/data'
import { itemKey } from '@/lib/blog/render/outline'

export interface CatalogItem {
  slug: string
  name: string
  imageUrl: string | null
}

export interface LinkedItem extends CatalogItem {
  /** The item's value page. */
  href: string
}

type Row = { slug: string; name: string; image_url: string | null }

/** Games whose catalogue is its own table (not values_items). */
const OWN_TABLE: Record<string, { table: string; narrow: (q: any) => any }> = {
  'adopt-me': { table: 'adopt_me_pets', narrow: (q) => q.eq('is_active', true).eq('has_page', true) },
  'steal-a-brainrot': { table: 'sab_brainrot_market_catalog', narrow: (q) => q },
}

const toItem = (r: Row): CatalogItem => ({ slug: r.slug, name: r.name, imageUrl: r.image_url })
/** A literal for an ILIKE inside PostgREST's or(): wildcards escaped, value quoted. */
const literal = (s: string) => `"${s.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/"/g, '\\"')}"`

/** Items whose name contains `q` (the editor's item search: admin-only, uncached by design — one query per keystroke). */
export async function searchCatalog(gameSlug: string, q: string): Promise<CatalogItem[]> {
  const own = OWN_TABLE[gameSlug]
  if (own) {
    const query = own.narrow((createAnonClient() as any).from(own.table).select('slug,name,image_url'))
    const { data } = await query.ilike('name', `%${q.replace(/[%_]/g, '')}%`).limit(40)
    return ((data ?? []) as Row[]).map(toItem)
  }
  const items = await getValueItems(gameSlug).catch(() => [])
  return items.map((i) => ({ slug: i.slug, name: i.name, imageUrl: i.imageUrl }))
}

/** The items named exactly (case and spacing aside) — keyed by itemKey(name). */
export async function findCatalogItems(gameSlug: string, names: readonly string[]): Promise<Map<string, LinkedItem>> {
  const out = new Map<string, LinkedItem>()
  if (names.length === 0) return out
  const wanted = new Set(names.map(itemKey))
  let rows: CatalogItem[]
  const own = OWN_TABLE[gameSlug]
  if (own) {
    // The article's read: under the game's values tags, so a values publish refreshes its table pictures.
    const query = own.narrow((createValueListReadClient(gameSlug) as any).from(own.table).select('slug,name,image_url'))
    const { data } = await query.or(names.map((n) => `name.ilike.${literal(n)}`).join(',')).limit(80)
    rows = ((data ?? []) as Row[]).map(toItem)
  } else {
    rows = (await getValueItems(gameSlug).catch(() => [])).map((i) => ({ slug: i.slug, name: i.name, imageUrl: i.imageUrl }))
  }
  for (const r of rows) {
    const k = itemKey(r.name)
    if (wanted.has(k) && !out.has(k)) out.set(k, { ...r, href: `/${gameSlug}/values/${r.slug}` })
  }
  return out
}
