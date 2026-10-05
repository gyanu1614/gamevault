import { createTaggedAnonClient } from '@/lib/supabase/anon'
import { valueItemReadTags, valueListReadTags } from './revalidation'

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
