/**
 * values_items helpers shared by the generic-table adapters (MM2, Steal an
 * Egg): the game's id, the items it already has, the next sort position, and
 * the insert-only write. Not an adapter itself, so adapters may import it.
 */
import type { Db, KnownItem } from '../types'

const PAGE = 1000

export async function gameIdBySlug(db: Db, slug: string): Promise<string> {
  const { data, error } = await db.from('games').select('id').eq('slug', slug).maybeSingle()
  if (error) throw new Error(`games ${slug}: ${error.message}`)
  if (!data) throw new Error(`game '${slug}' not found`)
  return data.id as string
}

/** Every item the game holds (enabled or not), as the matcher needs it. */
export async function loadValuesKnown(db: Db, gameId: string): Promise<KnownItem[]> {
  const out: KnownItem[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('values_items').select('slug,name').eq('game_id', gameId).order('slug').range(from, from + PAGE - 1)
    if (error) throw new Error(`values_items: ${error.message}`)
    for (const r of data ?? []) out.push({ slug: r.slug, name: r.name, pageId: null })
    if (!data || data.length < PAGE) return out
  }
}

/** New rows go after every existing one (an admin's ordering is never disturbed). */
export async function nextSortOrder(db: Db, gameId: string): Promise<number> {
  const { data, error } = await db.from('values_items').select('sort_order').eq('game_id', gameId).order('sort_order', { ascending: false, nullsFirst: false }).limit(1)
  if (error) throw new Error(`values_items sort_order: ${error.message}`)
  return ((data?.[0]?.sort_order as number | null) ?? -1) + 1
}

/** ON CONFLICT (game_id, slug) DO NOTHING; returns only the rows actually inserted. */
export async function insertValuesItems(db: Db, rows: Record<string, unknown>[]): Promise<{ id: string; slug: string }[]> {
  if (!rows.length) return []
  const { data, error } = await db.from('values_items').upsert(rows, { onConflict: 'game_id,slug', ignoreDuplicates: true }).select('id,slug')
  if (error) throw new Error(`values_items insert: ${error.message}`)
  return (data ?? []) as { id: string; slug: string }[]
}

/** The public URL of a stored image (no request: supabase-js builds it). */
export const publicImageUrl = (db: Db, bucket: string, path: string) => db.storage.from(bucket).getPublicUrl(path).data.publicUrl
