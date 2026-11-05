/**
 * Where people give up on /founding. `founding_step_viewed` and
 * `founding_step_completed` show that a step lost someone; this says they left
 * the page, how far they got and how long they tried. It is the "before" number
 * for the signup redesign, so collect it before anything changes.
 *
 * Sent only while the store is not open yet. One event per visit to the page.
 * Missed on purpose: a phone that kills the tab without firing pagehide, and a
 * bounce before PostHog has loaded, so read it as a floor, not an exact count.
 */
export interface FoundingExitState {
  /** The next unfinished step, 1 to 4. */
  step: number
  signedIn: boolean
  finished: boolean
}

export function createFoundingExit(
  read: () => FoundingExitState,
  send: (props: { step: number; signed_in: boolean; seconds: number }) => void,
  now: () => number = Date.now,
) {
  const openedAt = now()
  let reported = false
  return {
    left() {
      const { step, signedIn, finished } = read()
      if (reported || finished) return
      reported = true
      send({ step, signed_in: signedIn, seconds: Math.round((now() - openedAt) / 1000) })
    },
    /** Back on the page from the browser's back button: the next exit counts too. */
    returned() {
      reported = false
    },
  }
}
