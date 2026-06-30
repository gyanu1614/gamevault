/**
 * SafeDrop order state machine (pure).
 *
 * This is the TypeScript source of truth for which order-status transitions are
 * legal. It MUST agree exactly with the SQL trigger `is_valid_order_transition`
 * (supabase/migrations/20260628_fix_refunded_transition.sql) — a unit test
 * cross-checks the two maps so they can never drift.
 *
 * The DB trigger is the authoritative enforcement (illegal moves are physically
 * impossible at the DB layer); this pure copy lets the app reason about, and
 * test, the matrix without a database, and drives an explicit `(state, event)`
 * → next mapping for the transition RPC layer (Phase 2 cont.).
 *
 * NOTE on axes: `OrderStatus` is the order lifecycle. It is distinct from
 * `escrow_status` (held/released/frozen/refunded) and from `dispute` statuses
 * (open/under_review/escalated/resolved_*). This file models ONLY the order
 * lifecycle — the one the trigger guards.
 */

import { InvalidTransitionError } from '@/lib/errors'

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'delivering'
  | 'delivered'
  | 'disputed'
  | 'completed' // terminal
  | 'cancelled' // terminal
  | 'refunded' // terminal

/** Terminal states allow no outgoing transitions. */
export const TERMINAL_STATES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'completed',
  'cancelled',
  'refunded',
])

/**
 * Allowed transitions — the single source of truth, mirroring the SQL map.
 * Keep this byte-for-byte in step with is_valid_order_transition().
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending: ['paid', 'cancelled'],
  paid: ['delivering', 'delivered', 'disputed', 'cancelled', 'refunded'],
  delivering: ['delivered', 'disputed', 'cancelled', 'refunded'],
  delivered: ['completed', 'disputed', 'refunded'],
  disputed: ['completed', 'cancelled', 'refunded'],
  completed: [],
  cancelled: [],
  refunded: [],
}

/**
 * isValidTransition — mirrors the SQL function exactly, including the
 * "same status is allowed (idempotent column updates)" rule.
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (TERMINAL_STATES.has(from)) return false
  if (from === to) return true // idempotent same-status update
  return ALLOWED_TRANSITIONS[from].includes(to)
}

/** assertTransition — throws InvalidTransitionError on an illegal move. */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!isValidTransition(from, to)) {
    throw new InvalidTransitionError(from, to)
  }
}

// ─── Event → target mapping ───────────────────────────────────────
// The domain operations the rest of the system speaks, mapped to the target
// status each drives. The transition RPC will look up the target, then the
// trigger enforces legality. Keeping events explicit (vs. raw status writes)
// is what lets webhooks and user actions share one vocabulary.

export type OrderEvent =
  | 'CHARGE_CONFIRMED' // -> paid
  | 'SELLER_DELIVERING' // -> delivering
  | 'SELLER_DELIVERED' // -> delivered
  | 'BUYER_CONFIRMED' // -> completed
  | 'AUTO_RELEASED' // -> completed
  | 'BUYER_DISPUTED' // -> disputed
  | 'DISPUTE_RESOLVED_SELLER' // -> completed
  | 'DISPUTE_RESOLVED_BUYER' // -> refunded
  | 'REFUNDED' // -> refunded
  | 'CANCELLED' // -> cancelled

export const EVENT_TARGET: Readonly<Record<OrderEvent, OrderStatus>> = {
  CHARGE_CONFIRMED: 'paid',
  SELLER_DELIVERING: 'delivering',
  SELLER_DELIVERED: 'delivered',
  BUYER_CONFIRMED: 'completed',
  AUTO_RELEASED: 'completed',
  BUYER_DISPUTED: 'disputed',
  DISPUTE_RESOLVED_SELLER: 'completed',
  DISPUTE_RESOLVED_BUYER: 'refunded',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
}

/** Resolve the target status for an event. */
export function targetFor(event: OrderEvent): OrderStatus {
  return EVENT_TARGET[event]
}
