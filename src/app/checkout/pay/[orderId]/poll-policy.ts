/**
 * Pay page polling policy — round B Part 4 (PAY-019).
 *
 * The page used to poll Greenfield every 4 s forever, in every view,
 * overlapping when a call was slow. Now:
 *   · `paid` is terminal — no more polling;
 *   · live views (waiting / seen / confirming / partial) poll at the base
 *     rate: a payment can land any second;
 *   · `expired` / `unreachable` back off ×2 per tick to a 60 s cap — the
 *     page still recovers on its own when the instance comes back, without
 *     hammering a dead endpoint;
 *   · a live view after a backed-off one snaps back to the base rate.
 * Pure so the schedule is unit-tested; the component chains setTimeout
 * from it with an in-flight guard.
 */

export type PollView = 'waiting' | 'seen' | 'confirming' | 'paid' | 'partial' | 'expired' | 'unreachable'

export const POLL_BASE_MS = 4000
export const POLL_MAX_MS = 60_000

/** Delay before the next poll given the current view and the last delay; null = stop. */
export function nextPollDelayMs(view: PollView, previousMs: number): number | null {
  if (view === 'paid') return null
  if (view === 'expired' || view === 'unreachable') {
    const base = Math.max(POLL_BASE_MS, previousMs || POLL_BASE_MS)
    return Math.min(POLL_MAX_MS, base * 2)
  }
  return POLL_BASE_MS
}

/** The countdown ticks while time is left; at zero it stops (no negative ticks). */
export function countdownShouldContinue(remainingMs: number): boolean {
  return remainingMs > 0
}
