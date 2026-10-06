import { revalidateTag, unstable_cache } from 'next/cache'
import { valueItemStockTag } from '@/lib/value-listings/tags'
import { HOME_LISTINGS_TAG } from './tags'

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
 * Listings linked to a value item (`listings.value_item_slug`, Bundle 2) also
 * revalidate that item's stock tag, so the item's value page (buy button,
 * "Available Now") follows the listing — that page alone, not every value
 * page of the game (T1, 2026-10-04). Resolved from listing or seller ids;
 * a call with category ids only cannot name items and leaves them to the
 * nightly reconcile (/api/cron/value-listing-refs).
 *
 * Any call that touches a category also revalidates HOME_LISTINGS_TAG: the
 * homepage rails list listings of every game, so that one page follows too.
 *
 * The tags refresh the DATA, not just the page shell, only because every
 * listing read on those pages is cached under them (lib/listings/read-client,
 * guarded by listings-data-tags.guard.test.ts): an untagged supabase-js read
 * survives a revalidateTag in Next 14's Data Cache.
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

type CategoryRow = {
  game_category_id: string | null
  value_item_slug?: string | null
  game?: { slug: string | null } | Array<{ slug: string | null }> | null
}

/** One read resolves both: the category page and the linked value item. */
const SURFACE_COLUMNS = 'game_category_id, value_item_slug, game:games!listings_game_id_fkey(slug)'

export async function revalidateListingSurfaces(
  client: ListingsReader,
  target: ListingSurfaceTarget,
): Promise<ListingSurfaceResult> {
  const ids = new Set<string>(target.gameCategoryIds ?? [])
  const valueItemTags = new Set<string>()
  let error: string | undefined

  const lookups: Array<[string, readonly string[]]> = []
  if (target.listingIds?.length) lookups.push(['id', target.listingIds])
  if (target.sellerIds?.length) lookups.push(['seller_id', target.sellerIds])

  for (const [column, values] of lookups) {
    try {
      let { data, error: readError } = await client
        .from('listings')
        .select(SURFACE_COLUMNS)
        .in(column, values)
      if (readError) {
        // The value-item half is an addition; never let it cost the category
        // pages their refresh. Retry the plain read and report the miss.
        console.error('[revalidateListingSurfaces] value-item lookup failed', readError)
        ;({ data, error: readError } = await client
          .from('listings')
          .select('game_category_id')
          .in(column, values))
      }
      if (readError) throw readError
      for (const row of (data ?? []) as CategoryRow[]) {
        if (row.game_category_id) ids.add(row.game_category_id)
        const game = Array.isArray(row.game) ? row.game[0] : row.game
        if (row.value_item_slug && game?.slug) {
          valueItemTags.add(valueItemStockTag(game.slug, row.value_item_slug))
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  const tags: string[] = []
  const homeTags = ids.size > 0 ? [HOME_LISTINGS_TAG] : []
  for (const tag of [...[...ids].map(categoryListingsTag), ...valueItemTags, ...homeTags]) {
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

/** The slice of a Supabase client the storefront helper needs. */
export interface SellerProfileReader extends ListingsReader {
  from(table: 'profiles'): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> }
    }
  }
  from(table: 'listings'): ReturnType<ListingsReader['from']>
}

/**
 * Revalidate the surfaces that render ONE seller's identity — their public
 * storefront and the category pages carrying their offers.
 *
 * Used by the admin paths that flip a badge-bearing profile column
 * (`founding_seller`, restrictions). Those used to call `revalidatePath('/')`,
 * which invalidated all ~950 prerendered pages to refresh one badge
 * (build audit 2026-09-22, §4).
 *
 * Never throws — the write already happened.
 */
export async function revalidateSellerStorefront(
  client: SellerProfileReader,
  sellerId: string,
): Promise<ListingSurfaceResult> {
  const { revalidatePath } = await import('next/cache')
  const result = await revalidateListingSurfaces(client, { sellerIds: [sellerId] })

  try {
    const { data, error } = await (client as SellerProfileReader)
      .from('profiles')
      .select('shop_slug')
      .eq('id', sellerId)
      .maybeSingle()
    if (error) throw error
    const slug = (data as { shop_slug: string | null } | null)?.shop_slug
    // /shop/[slug] is prerendered per seller (revalidate = 60) — a concrete
    // path matches it, unlike a route pattern.
    if (slug) revalidatePath(`/shop/${slug}`)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[revalidateSellerStorefront]', message, { sellerId })
    return { tags: result.tags, error: result.error ?? message }
  }

  return result
}

/** The slice of a Supabase client the game-category helper needs. */
export interface GameCategoryReader {
  from(table: 'game_categories'): {
    select(columns: string): {
      eq(column: string, value: string): PromiseLike<{ data: unknown; error: unknown }>
    }
  }
}

/**
 * Revalidate every category surface of ONE game.
 *
 * For admin edits that change category copy/config for a whole game: the
 * affected pages are that game's enabled `(game, category)` pairs, which the
 * category page already anchors to via `bindCategoryListingsTag`. This used
 * to be `revalidatePath('/', 'layout')` — all ~950 pages for a handful
 * (build audit 2026-09-22, §4).
 *
 * Never throws — the write already happened.
 */
export async function revalidateGameCategorySurfaces(
  client: GameCategoryReader,
  gameId: string,
): Promise<ListingSurfaceResult> {
  const { revalidatePath } = await import('next/cache')
  try {
    const { data, error } = await client
      .from('game_categories')
      .select('id, slug, game:game_id (slug)')
      .eq('game_id', gameId)
    if (error) throw error

    const rows = (data ?? []) as Array<{
      id: string
      slug: string | null
      game: { slug: string | null } | Array<{ slug: string | null }> | null
    }>

    const tags: string[] = []
    for (const row of rows) {
      const tag = categoryListingsTag(row.id)
      revalidateTag(tag)
      tags.push(tag)
      // The pair page is prerendered at a concrete path, so name it directly:
      // the tag covers its listing data, the path covers the category copy.
      const game = Array.isArray(row.game) ? row.game[0] : row.game
      if (game?.slug && row.slug) revalidatePath(`/${game.slug}/${row.slug}`)
    }
    return { tags }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[revalidateGameCategorySurfaces]', message, { gameId })
    return { tags: [], error: message }
  }
}
