/**
 * Every row of a PostgREST query, page by page.
 *
 * One response is capped at max_rows (1000) and the cut is silent — a list
 * or a total that just awaited the query lost everything past row 1000.
 * `page(from, to)` must build the query fresh each call and end its ORDER BY
 * on a unique column (e.g. created_at, then id) so pages never overlap or
 * skip. Returns the PostgREST `{ data, error }` shape: the first page error
 * stops the walk.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<{ data: T[] | null; error: unknown }> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) return { data: null, error }
    const got = data ?? []
    rows.push(...got)
    if (got.length < pageSize) return { data: rows, error: null }
  }
}

/** Split ids for `.in()` filters so a long list never overflows the URL. */
export function chunk<T>(items: readonly T[], size = 100): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
