/**
 * Pending-order INSERT policy — how createCheckout reads a unique violation.
 *
 * `orders` carries three unique keys the INSERT can hit, and they mean
 * different things:
 *
 *   one_pending_order_per_buyer_listing  the buyer double-submitted (or two
 *                                        tabs raced): the racing order is the
 *                                        answer — reuse it.
 *   orders_order_number_key              generate_order_number() produced a
 *                                        number that already exists. Nothing
 *                                        about the buyer's request is wrong:
 *                                        retry the INSERT exactly once (the
 *                                        trigger draws a fresh number).
 *   anything else                        a real conflict we do not expect on
 *                                        this path: surface it as its own typed
 *                                        error, never as a "double submit".
 *
 * Before 2026-09-22 every 23505 was read as the first case; an order_number
 * collision therefore ended in "Could not open checkout — please try again"
 * with no order row (docs/handoff/fee-pr3.md, addendum).
 *
 * Plain module (no 'use server'): server-action files may only export async
 * functions, and this policy needs a class and a pure classifier so it can be
 * unit-tested without a database.
 */

export type UniqueViolationKind = 'duplicate_submit' | 'order_number_collision' | 'other'

export interface PostgrestLikeError {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

export const ORDER_INSERT_CONFLICT_USER_MESSAGE = 'Could not create the order — please try again'

export const BUYER_LISTING_INDEX = 'one_pending_order_per_buyer_listing'
export const ORDER_NUMBER_KEY = 'orders_order_number_key'

/** A 23505 we could not resolve: the constraint is recorded for the log, the message is buyer-safe. */
export class OrderInsertConflictError extends Error {
  readonly constraint: string
  readonly attempts: number
  constructor(constraint: string, attempts: number) {
    super(ORDER_INSERT_CONFLICT_USER_MESSAGE)
    this.name = 'OrderInsertConflictError'
    this.constraint = constraint
    this.attempts = attempts
  }
}

/** The constraint named in a PostgREST/PostgreSQL 23505 error, from message or details. */
export function uniqueViolationConstraint(error: PostgrestLikeError | null | undefined): string | null {
  if (!error || error.code !== '23505') return null
  const text = `${error.message ?? ''}\n${error.details ?? ''}`
  const m = text.match(/constraint "([^"]+)"/)
  return m ? m[1] : 'unknown'
}

export function classifyUniqueViolation(error: PostgrestLikeError | null | undefined): UniqueViolationKind | null {
  const constraint = uniqueViolationConstraint(error)
  if (constraint === null) return null
  if (constraint === BUYER_LISTING_INDEX) return 'duplicate_submit'
  if (constraint === ORDER_NUMBER_KEY) return 'order_number_collision'
  return 'other'
}

export type OrderInsertAttempt = () => Promise<{ data: { id: string } | null; error: PostgrestLikeError | null }>
export type OrderInsertResult = { orderId: string } | { duplicate: true } | { error: string }

/**
 * Run the INSERT under the policy above. Resolves to the id, to `duplicate`
 * (reuse the racing order), or to a plain error message for non-unique
 * failures; throws OrderInsertConflictError for a 23505 that is neither the
 * double-submit nor a first-time order_number collision.
 */
export async function runOrderInsert(attempt: OrderInsertAttempt): Promise<OrderInsertResult> {
  const MAX_ORDER_NUMBER_RETRIES = 1
  let orderNumberRetries = 0
  for (let attempts = 1; ; attempts++) {
    const { data, error } = await attempt()
    if (data?.id) return { orderId: data.id }
    const kind = classifyUniqueViolation(error)
    if (kind === null) return { error: error?.message ?? 'insert failed' }
    if (kind === 'duplicate_submit') return { duplicate: true }
    if (kind === 'order_number_collision' && orderNumberRetries < MAX_ORDER_NUMBER_RETRIES) {
      orderNumberRetries++
      continue
    }
    throw new OrderInsertConflictError(uniqueViolationConstraint(error) ?? 'unknown', attempts)
  }
}
