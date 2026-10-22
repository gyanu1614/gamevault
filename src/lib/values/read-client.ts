import { createTaggedAnonClient } from '@/lib/supabase/anon'
import { valueItemReadTags, valueListReadTags, valuesTag } from './revalidation'

/**
 * The ONLY clients for values-hub data reads (the rule is in the header of
 * ./revalidation.ts). Cookie-free, so pages stay static; every query response
 * is cached under the read's tags, so the publish step's revalidateTag
 * refreshes the data and not just the page shell.
 */

/** Reads for ONE item's value page: [price:<game>:<item>, values:<game>]. */
export function createValueItemReadClient(gameSlug: string, itemSlug: string) {
  return createTaggedAnonClient({ tags: valueItemReadTags(gameSlug, itemSlug) })
}

/** Reads for a game's list pages: [price:<game>, values:<game>]. */
export function createValueListReadClient(gameSlug: string) {
  return createTaggedAnonClient({ tags: valueListReadTags(gameSlug) })
}

/**
 * A read that is IDENTICAL on every item page of a game (the catalogue behind
 * the rails and comparisons): one Data Cache entry for all of them, under
 * `values:<game>` only — a tag every item page already carries, refreshed by a
 * full publish — plus a daily window. Never the item tag (the tags are part of
 * the cache key: 500 item pages would be 500 entries and 500 reads) and never
 * the list tag `price:<game>` (that would rebuild every item page on each list
 * refresh). The page's OWN item is read separately under its item tags.
 */
export function createValueGameSharedReadClient(gameSlug: string) {
  return createTaggedAnonClient({ tags: [valuesTag(gameSlug)], revalidate: 86400 })
}

/** Where a shared loader is being read from — picks the tag set. */
export interface ValuesReadScope {
  gameSlug: string
  /** Set on an item page; omitted on list pages. */
  itemSlug?: string | null
}

export function createValuesReadClient({ gameSlug, itemSlug }: ValuesReadScope) {
  return itemSlug
    ? createValueItemReadClient(gameSlug, itemSlug)
    : createValueListReadClient(gameSlug)
}
