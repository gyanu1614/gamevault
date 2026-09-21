import { revalidateTag, unstable_cache } from 'next/cache'

/**
 * Event-driven revalidation for the listing surfaces (Step 7b).
 *
 * `/[gameSlug]/[categorySlug]` is prerendered for every enabled pair with a
 * 24 h TTL, so it only re-renders when told to. Every listing mutation —
 * publish, edit, price, delete, moderation verdict, store pause, order
 * completion (the DB trigger decrements stock), inventory changes — calls
 * revalidateListingSurfaces() with what it knows (category ids, listing ids
 * or seller ids); this resolves them to the game_categories rows involved and
 * revalidates one tag per row. The category page anchors its render to that
 * tag with bindCategoryListingsTag().
 *
 * The guard test `listing-mutations-revalidate.guard.test.ts` enumerates the
 * mutation sites, so a new one cannot land without calling this.
 *
 * Never throws: the mutation already happened; a failed revalidation is
 * reported (and covered by the nightly full revalidate), not surfaced as a
 * user-facing error.
 */

export function categoryListingsTag(gameCategoryId: string): string {
  return `listings:category:${gameCategoryId}`
}

/** Anchor the current render to a category's listings tag (no-op cached read). */
export function bindCategoryListingsTag(gameCategoryId: string): Promise<string> {
  return unstable_cache(async () => gameCategoryId, ['listings-category-tag', gameCategoryId], {
    tags: [categoryListingsTag(gameCategoryId)],
  })()
}

export interface ListingSurfaceTarget {
  gameCategoryIds?: readonly string[]
  listingIds?: readonly string[]
  sellerIds?: readonly string[]
}

export interface ListingSurfaceResult {
  tags: string[]
  error?: string
}

/** The slice of a Supabase client this needs — session or service role. */
export interface ListingsReader {
  from(table: 'listings'): {
    select(columns: string): {
      in(column: string, values: readonly string[]): PromiseLike<{ data: unknown; error: unknown }>
    }
  }
}

type CategoryRow = { game_category_id: string | null }

export async function revalidateListingSurfaces(
  client: ListingsReader,
  target: ListingSurfaceTarget,
): Promise<ListingSurfaceResult> {
  const ids = new Set<string>(target.gameCategoryIds ?? [])
  let error: string | undefined

  const lookups: Array<[string, readonly string[]]> = []
  if (target.listingIds?.length) lookups.push(['id', target.listingIds])
  if (target.sellerIds?.length) lookups.push(['seller_id', target.sellerIds])

  for (const [column, values] of lookups) {
    try {
      const { data, error: readError } = await client
        .from('listings')
        .select('game_category_id')
        .in(column, values)
      if (readError) throw readError
      for (const row of (data ?? []) as CategoryRow[]) {
        if (row.game_category_id) ids.add(row.game_category_id)
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  const tags: string[] = []
  for (const id of ids) {
    const tag = categoryListingsTag(id)
    try {
      revalidateTag(tag)
      tags.push(tag)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }
  if (error) console.error('[revalidateListingSurfaces]', error, { target, tags })
  return error ? { tags, error } : { tags }
}
