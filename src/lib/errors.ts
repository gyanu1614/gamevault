/**
 * Typed domain errors for the money layer.
 *
 * Every money/escrow/ledger failure mode gets a named class so callers can
 * branch on `instanceof` instead of string-matching messages, and so logs
 * carry a stable `code`. These are thrown by the pure domain layer
 * (money.ts, the ledger/escrow seams) and surfaced at the action edge.
 *
 * Keep this list small and meaningful — one class per genuinely distinct
 * failure, not one per call site.
 */

/** Base class for all money-layer domain errors. */
export class DomainError extends Error {
  /** Stable machine-readable code (the class name by default). */
  readonly code: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = new.target.name
    this.code = code ?? new.target.name
    // Restore prototype chain (TS targeting ES5/ES2015 transpiles `extends`
    // in a way that can break `instanceof`; bundler/esnext is fine, but this
    // is the cheap, universally-correct guard).
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** Two `Money` values of different currencies were combined or compared. */
export class CurrencyMismatchError extends DomainError {
  constructor(a: string, b: string) {
    super(`Currency mismatch: cannot operate on ${a} and ${b}`)
  }
}

/** A money amount was negative where the operation forbids it. */
export class NegativeAmountError extends DomainError {
  constructor(context: string) {
    super(`Negative amount not allowed: ${context}`)
  }
}

/** A decimal string could not be parsed into integer minor units. */
export class InvalidMoneyError extends DomainError {
  constructor(value: string, reason: string) {
    super(`Invalid money value "${value}": ${reason}`)
  }
}

/** A ledger journal's debits did not equal its credits (per currency). */
export class LedgerImbalanceError extends DomainError {
  constructor(detail: string) {
    super(`Ledger journal does not balance: ${detail}`)
  }
}

/** An order/escrow transition that the state machine does not permit. */
export class InvalidTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`Invalid transition: ${from} → ${to}`)
  }
}

/** A webhook/event id was seen before (idempotent replay). */
export class DuplicateEventError extends DomainError {
  constructor(eventRef: string) {
    super(`Duplicate event: ${eventRef}`)
  }
}
