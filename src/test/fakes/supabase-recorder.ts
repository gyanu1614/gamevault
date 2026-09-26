/**
 * A recording stand-in for a Supabase client, for tests that need to know
 * WHICH tables a code path touched (and in what order) without a database.
 *
 * Every builder method is chainable; awaiting the builder resolves to
 * `{ data, error }` from the seeded rows for that table. `.single()` yields
 * the first row or a PGRST116-style error; `.maybeSingle()` the first row or
 * null. Filters are not evaluated — seed exactly the rows the path should see.
 */
export interface RecordedQuery {
  table: string
  calls: string[]
}

export interface SupabaseRecorder {
  client: any
  queries: RecordedQuery[]
  tables: () => string[]
}

export function createSupabaseRecorder(seed: Record<string, any[]> = {}): SupabaseRecorder {
  const queries: RecordedQuery[] = []

  const from = (table: string) => {
    const rec: RecordedQuery = { table, calls: [] }
    queries.push(rec)
    const rows = seed[table] ?? []
    const builder: any = {}
    const chain = (name: string) => (..._args: unknown[]) => {
      rec.calls.push(name)
      return builder
    }
    for (const name of [
      'select', 'eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'in', 'not', 'or', 'ilike',
      'like', 'is', 'order', 'limit', 'range', 'match', 'filter', 'contains',
    ]) builder[name] = chain(name)
    builder.single = async () => {
      rec.calls.push('single')
      return rows[0]
        ? { data: rows[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    }
    builder.maybeSingle = async () => {
      rec.calls.push('maybeSingle')
      return { data: rows[0] ?? null, error: null }
    }
    builder.then = (resolve: (v: any) => unknown, reject?: (e: any) => unknown) =>
      Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve, reject)
    return builder
  }

  const client = {
    from,
    auth: {
      getUser: async () => {
        queries.push({ table: '<auth.getUser>', calls: [] })
        return { data: { user: null }, error: null }
      },
    },
  }

  return {
    client,
    queries,
    tables: () => queries.map((q) => q.table),
  }
}
