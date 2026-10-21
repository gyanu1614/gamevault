/**
 * Read a whole (filtered) table in pages, by KEYSET, never by OFFSET.
 *
 * OFFSET paging (`.range(from, to)`) makes Postgres walk past every earlier row
 * on every page, so reading N rows costs ~N²/pageSize row visits: the SAB
 * reprice read 34 pages of a 300 MB table that way each day, the same shape
 * the expire job measured at 1,677 s before it moved to keyset
 * (2026-10-20 usage audit, C1). Keyset asks for "rows after the last key I
 * saw", which an index serves directly: each page costs only its own rows.
 *
 * `key` must be unique: one column (`'id'`), or two (`['a', 'b']`) for a
 * composite primary key. Transient read failures (statement timeout, network)
 * are retried with linear backoff; anything else throws at once, naming the
 * table.
 */

export const KEYSET_PAGE_SIZE = 1000
const MAX_ATTEMPTS = 4

type ReadError = { message?: string; code?: string }

/** Transient classes worth retrying: statement timeout + network/upstream. */
export function isRetryableReadError(error: ReadError): boolean {
  const code = error.code ?? ''
  const message = error.message ?? ''
  return (
    code === '57014' ||
    message.includes('57014') ||
    /statement timeout/i.test(message) ||
    /timeout|fetch failed|socket|ECONNRESET|EAI_AGAIN/i.test(message)
  )
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

// The PostgREST builder is typed per table; callers pass the generic client.
type Query = any
type Client = { from: (table: string) => any }
// `client` is typed `unknown` on purpose: asking TypeScript whether the fully
// typed SupabaseClient<Database> fits `Client` compares its generic `from`
// overloads against the whole schema type and exhausts tsc's heap.

export interface SelectAllByKeyOptions {
  table: string
  /** PostgREST select list. The key column(s) are added if missing. */
  columns: string
  /** Unique key: one column, or two for a composite primary key. */
  key: string | [string, string]
  /** Extra filters (eq, in, gte, ...) applied to every page. */
  filter?: (query: Query) => Query
  pageSize?: number
  /** Backoff before retry `attempt` (1-based). Tests pass () => 0. */
  retryDelayMs?: (attempt: number) => number
}

function withKeyColumns(columns: string, keys: string[]): string {
  const listed = new Set(columns.split(',').map((c) => c.trim().split(':').pop()))
  const missing = keys.filter((k) => !listed.has(k))
  return missing.length ? `${columns},${missing.join(',')}` : columns
}

/** "Rows after `last`" for a one- or two-column key. Key values are ids
 *  (uuid / slug), so they are safe inside a PostgREST filter string. */
function afterKey(query: Query, keys: string[], last: Record<string, unknown>): Query {
  if (keys.length === 1) return query.gt(keys[0], String(last[keys[0]]))
  const [a, b] = keys
  const va = String(last[a])
  return query.or(`${a}.gt.${va},and(${a}.eq.${va},${b}.gt.${String(last[b])})`)
}

export async function selectAllByKey<T>(client: unknown, options: SelectAllByKeyOptions): Promise<T[]> {
  const db = client as Client
  const { table, filter, retryDelayMs = (attempt) => 1000 * attempt } = options
  const keys = Array.isArray(options.key) ? options.key : [options.key]
  const pageSize = options.pageSize ?? KEYSET_PAGE_SIZE
  const columns = withKeyColumns(options.columns, keys)

  const rows: T[] = []
  let last: Record<string, unknown> | null = null

  for (;;) {
    let page: T[] | null = null
    let lastError: ReadError | null = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let query = db.from(table).select(columns)
      if (filter) query = filter(query)
      if (last) query = afterKey(query, keys, last)
      for (const k of keys) query = query.order(k, { ascending: true })
      const { data, error } = await query.limit(pageSize)

      if (!error) {
        page = (data ?? []) as T[]
        break
      }
      lastError = error
      if (!isRetryableReadError(error) || attempt === MAX_ATTEMPTS) break
      console.warn(`${table}: page after ${last ? JSON.stringify(last) : 'start'} failed (attempt ${attempt}/${MAX_ATTEMPTS}: ${error.message}), retrying…`)
      await sleep(retryDelayMs(attempt))
    }

    if (page === null) throw new Error(`${table}: ${lastError?.message ?? 'unknown read error'}`)

    rows.push(...page)
    if (page.length < pageSize) return rows
    last = page[page.length - 1] as Record<string, unknown>
  }
}
