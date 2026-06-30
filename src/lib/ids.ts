/**
 * Id generators for the money layer.
 *
 * The repo already standardizes on `crypto.randomUUID()` (works in the
 * browser and Node 19+ — see src/lib/utils/idempotency.ts), so we use that
 * rather than add a `uuid`/`ulid` dependency. UUIDv4 is random (not sortable);
 * the DB supplies `created_at` for ordering, which is sufficient for our needs.
 */

/** Generate a fresh UUIDv4. The base id factory for all money-layer rows. */
export function newId(): string {
  return crypto.randomUUID()
}

/** Order id. */
export const newOrderId = (): string => newId()

/** Ledger transaction (journal) id — groups a balanced set of entries. */
export const newLedgerTxId = (): string => newId()

/** Provider/webhook event id used when we mint our own (vs. provider-supplied). */
export const newEventId = (): string => newId()

/**
 * deterministicRef — a stable, collision-resistant string for idempotency
 * keys built from the parts that define "the same money event".
 *
 * Example: `deterministicRef('coingate', chargeId, 'paid')` →
 * `"coingate:abc123:paid"`. Re-deriving it from the same inputs yields the
 * same key, so a replayed webhook maps to the same ledger transaction and
 * no-ops. Parts are joined with ':' and must not themselves contain ':'.
 */
export function deterministicRef(...parts: Array<string | number>): string {
  return parts.map((p) => String(p)).join(':')
}

/** UUIDv4 shape check — reject malformed ids before they reach the DB. */
export function isUuid(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
