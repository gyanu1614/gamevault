/**
 * PostgREST truncates every read at 1,000 rows (supabase `max_rows`) without an
 * error, so a table that grows past it would quietly drop its tail from the
 * sitemap. Read page by page with `.range()` until a short page comes back.
 * Every query using this MUST have a stable, unique `.order()`.
 */
const PAGE_SIZE = 1000

export async function fetchAllRows<T>(
  readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  opts: { maxPages?: number } = {},
): Promise<T[]> {
  const maxPages = opts.maxPages ?? 200
  const rows: T[] = []
  for (let page = 0; page < maxPages; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await readPage(from, from + PAGE_SIZE - 1)
    // A failed page must fail the read: a silently shortened sitemap looks like
    // a mass de-listing to Google.
    if (error) throw new Error(`paged read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
  throw new Error(`paged read gave more than ${maxPages} pages of ${PAGE_SIZE} rows`)
}
