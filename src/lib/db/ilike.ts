/**
 * `%term%` for a PostgREST `.ilike()` call, with the LIKE metacharacters
 * escaped so a typed "%" or "_" matches itself instead of everything.
 * Pass the result to `.ilike(column, …)` — never interpolate raw text into
 * an `.or()` filter string (commas and parentheses there are syntax); use
 * `orIlike` for that.
 */
export function ilikeContains(term: string): string {
  return `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`
}

/**
 * `column.ilike."%term%"` clauses for a PostgREST `.or()`. The quoting keeps a
 * typed comma, parenthesis or quote inside the value, so text in a search box
 * can never add a filter of its own.
 */
export function ilikeClause(column: string, term: string): string {
  const quoted = ilikeContains(term).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `${column}.ilike."${quoted}"`
}

export function orIlike(columns: string[], term: string): string {
  return columns.map((column) => ilikeClause(column, term)).join(',')
}
