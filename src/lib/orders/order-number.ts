/**
 * Order-number helpers (migration 20260921234649).
 *
 * The stored `orders.order_number` is the number: it is rendered as stored,
 * never rewritten at display time. New numbers are `DM-XXXX-XXXX`; numbers
 * issued earlier (`GV-123456`, `GV-XXXXXXXXXX`) stay valid and display as
 * they are.
 *
 * Lookups never compare the raw string. The DB keeps a generated column
 * `orders.order_number_search` = upper(order_number) with every
 * non-alphanumeric stripped, and this module applies the identical
 * normalisation to the typed query, so "dm abcd efgh", "DMABCDEFGH" and
 * "DM-ABCD-EFGH" all find the same order — and a GV- order is found the same
 * way.
 *
 * Plain module: imported by client components and server actions alike.
 */

/** 32 symbols, no 0/O/1/I — the DB generator's alphabet. */
export const ORDER_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** The shape generate_order_number() issues since migration 20260921234649. */
export const ORDER_NUMBER_RE = /^DM-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/

/**
 * What a reader shows for an order: the stored number, else the upper-cased
 * 8-character id prefix (the fallback every reader already used).
 */
export function displayOrderRef(orderNumber: string | null | undefined, id: string): string {
  return orderNumber || id.slice(0, 8).toUpperCase()
}

/**
 * Upper-case and strip everything that is not a letter or digit. Mirrors the
 * DB expression `upper(regexp_replace(order_number, '[^A-Za-z0-9]', '', 'g'))`
 * behind `orders.order_number_search`; keep the two in step.
 */
export function normalizeOrderNumber(input: string | null | undefined): string {
  return (input ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

/**
 * PostgREST `ilike` pattern over `orders.order_number_search` for a free-text
 * query. A query with nothing searchable ("---") yields a pattern that can
 * match no key — '-' is stripped from every key — so "search for X" never
 * degrades into "list everything". The key is alphanumeric, so no ilike
 * metacharacter or PostgREST filter separator can reach the query string.
 */
export function orderNumberSearchPattern(raw: string): string {
  const key = normalizeOrderNumber(raw)
  return key ? `%${key}%` : '%-%'
}
