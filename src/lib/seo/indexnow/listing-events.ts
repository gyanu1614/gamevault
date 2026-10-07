import { isMaterialValueChange } from './value-changes'
import { submitIndexNow, type SubmitFn } from './submit'
import { isCurrencyCategoryType } from '@/lib/listings/url'

/**
 * Listing changes are submitted when a listing is PUBLISHED, MATERIALLY EDITED or
 * REMOVED, never for housekeeping (stock count, delivery text, updated_at).
 *
 * One mechanism for every write path (wizard publish, moderation approval,
 * seller edit, bulk edit, delete): snapshot the listing by id before and after
 * the change, then let the pure classifier decide. A path therefore needs two
 * calls and no knowledge of which fields count.
 */
export interface ListingSnapshot {
  id: string
  status: string
  title: string | null
  description: string | null
  price: number | string | null
  images: unknown
  slug: string | null
  gameSlug: string | null
  categorySlug: string | null
  /** game_categories.type — a currency listing has no page of its own. */
  categoryType?: string | null
}

export type ListingEvent = 'published' | 'edited' | 'removed'

const text = (v: string | null) => (v ?? '').trim()
const price = (v: number | string | null) => (v == null || Number.isNaN(Number(v)) ? null : Number(v))

function materiallyEdited(before: ListingSnapshot, after: ListingSnapshot): boolean {
  return (
    text(before.title) !== text(after.title) ||
    text(before.description) !== text(after.description) ||
    JSON.stringify(before.images ?? null) !== JSON.stringify(after.images ?? null) ||
    isMaterialValueChange(price(before.price), price(after.price))
  )
}

/** What happened to a listing's public page between two snapshots (null: nothing worth submitting). */
export function classifyListingChange(
  before: ListingSnapshot | undefined,
  after: ListingSnapshot | undefined,
): ListingEvent | null {
  const wasLive = before?.status === 'active'
  const isLive = after?.status === 'active'
  if (!wasLive && isLive) return 'published'
  if (wasLive && !isLive) return 'removed'
  if (wasLive && isLive && before && after) return materiallyEdited(before, after) ? 'edited' : null
  return null
}

/** Paths a listing event touches. Pages whose address cannot be built yet are skipped. */
export function listingEventUrls(event: ListingEvent, s: ListingSnapshot): string[] {
  if (!s.gameSlug) return []
  const category = s.categorySlug ? `/${s.gameSlug}/${s.categorySlug}` : null
  // Currency listings have no page of their own (the URL 308s to the currency
  // page): submit the currency page, never the listing URL.
  const listing =
    s.categorySlug && s.slug && !isCurrencyCategoryType(s.categoryType)
      ? `/${s.gameSlug}/${s.categorySlug}/${s.slug}`
      : null
  const hub = `/${s.gameSlug}`
  // Listing pages are noindex (2026-10-06): only a REMOVED listing's URL is
  // submitted (so engines drop a stale copy); publish/edit refresh the
  // category page and hub that show it.
  const urls =
    event === 'removed' ? [listing, category, hub] : event === 'edited' ? [category] : [category, hub]
  return urls.filter((u): u is string => !!u)
}

type Db = any

/** Read the listings by id (service role). null on failure: the caller then skips, never guesses. */
export async function snapshotListings(db: Db, ids: string[]): Promise<Map<string, ListingSnapshot> | null> {
  if (ids.length === 0) return new Map()
  try {
    const { data, error } = await db
      .from('listings')
      .select(
        'id, slug, status, title, description, price, images, game:games!listings_game_id_fkey(slug), category:game_categories!listings_game_category_id_fkey(slug, type)',
      )
      .in('id', ids)
    if (error) return null
    const map = new Map<string, ListingSnapshot>()
    for (const row of (data ?? []) as any[]) {
      map.set(row.id, {
        id: row.id,
        status: row.status,
        title: row.title ?? null,
        description: row.description ?? null,
        price: row.price ?? null,
        images: row.images ?? null,
        slug: row.slug ?? null,
        gameSlug: row.game?.slug ?? null,
        categorySlug: row.category?.slug ?? null,
        categoryType: row.category?.type ?? null,
      })
    }
    return map
  } catch {
    return null
  }
}

/**
 * Submit what changed between two snapshots. `null` on either side (a failed
 * read) submits nothing: a missing "before" would make every edit look like a
 * publish. Never throws.
 */
export async function submitListingChanges(
  before: Map<string, ListingSnapshot> | null,
  after: Map<string, ListingSnapshot> | null,
  deps: { submit?: SubmitFn } = {},
): Promise<void> {
  if (!before || !after) return
  try {
    const submit = deps.submit ?? ((u, o) => submitIndexNow(u, o))
    const byEvent: Record<ListingEvent, string[]> = { published: [], edited: [], removed: [] }
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const b = before.get(id)
      const a = after.get(id)
      const event = classifyListingChange(b, a)
      if (!event) continue
      byEvent[event].push(...listingEventUrls(event, event === 'removed' ? b! : a!))
    }
    for (const event of ['published', 'edited', 'removed'] as const) {
      const urls = [...new Set(byEvent[event])]
      if (urls.length > 0) await submit(urls, { reason: `listing-${event}` })
    }
  } catch (e) {
    console.error('[indexnow] listing submission failed (non-fatal):', e)
  }
}
