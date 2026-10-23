import 'server-only'
import { createValueItemReadClient } from '@/lib/values/read-client'
import { parseHowToGet } from '@/lib/values/how-to-get'
import { getValueItemFacts } from '@/lib/values/data'
import { NO_FACTS, releasedLabel, type ItemFacts } from '@/lib/values/item-facts'

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * The games whose items live in their own table. Every other values game
 * reads values_items (getValueItemFacts). Same three facts, one row per item.
 */
const OWN_TABLES: Record<string, { table: string; columns: string; toFacts: (r: Record<string, unknown>) => ItemFacts }> = {
  'adopt-me': {
    table: 'adopt_me_pets',
    columns: 'released_at,origin_detail,how_to_get,created_at',
    toFacts: (r) => ({
      released: releasedLabel({ date: text(r.released_at) }),
      origin: text(r.origin_detail),
      howToGet: parseHowToGet(r.how_to_get),
      releasedAt: text(r.released_at),
      addedAt: text(r.created_at),
    }),
  },
  'steal-a-brainrot': {
    table: 'sab_brainrots',
    columns: 'released_at,origin,how_to_get,created_at',
    toFacts: (r) => ({
      released: releasedLabel({ date: text(r.released_at) }),
      origin: text(r.origin),
      howToGet: parseHowToGet(r.how_to_get),
      releasedAt: text(r.released_at),
      addedAt: text(r.created_at),
    }),
  },
}

/**
 * One item's shared facts (released, origin, How To Get) for its value page.
 * A separate one-row read under the item's tags, and failure-tolerant: a
 * missing row or a read error means no facts, never a broken page.
 */
export async function getItemFacts(gameSlug: string, itemSlug: string): Promise<ItemFacts> {
  const own = OWN_TABLES[gameSlug]
  if (!own) return getValueItemFacts(gameSlug, itemSlug)
  const supabase = createValueItemReadClient(gameSlug, itemSlug)
  const { data, error } = await (supabase as any).from(own.table).select(own.columns).eq('slug', itemSlug).maybeSingle()
  if (error) {
    console.error(`getItemFacts(${gameSlug}):`, error)
    return NO_FACTS
  }
  return data ? own.toFacts(data as Record<string, unknown>) : NO_FACTS
}
