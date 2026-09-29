/**
 * `%term%` for a PostgREST `.ilike()` call, with the LIKE metacharacters
 * escaped so a typed "%" or "_" matches itself instead of everything.
 * Pass the result to `.ilike(column, …)` — never interpolate raw text into
 * an `.or()` filter string (commas and parentheses there are syntax).
 */
export function ilikeContains(term: string): string {
  return `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`
}
