/**
 * The seller funnel's "completed" steps, sent from the server where each step
 * is saved, keyed by the Supabase user id (the same id the browser's
 * `identify` uses). Fired in the browser they broke: visitors are cookieless
 * until they accept the cookie bar, and an email-confirmed sign-up comes back
 * on a fresh page, so step 1 never fired and the funnel read 0 (2026-10-11).
 *
 *   1  signed up (email sign-up to /founding, or the OAuth return to it)
 *   2  details saved   3  store set up   4  agreement signed (store open)
 *
 * A re-save sends the step again; funnels count people, so that is harmless.
 * Bounded and never throws (captureServerEvent).
 */
import { captureServerEvent } from './server'

export type FoundingStep = 1 | 2 | 3 | 4

export async function trackFoundingStep(
  userId: string,
  step: FoundingStep,
  extra: Record<string, string | number | boolean> = {},
): Promise<void> {
  if (!userId) return
  await captureServerEvent({ event: 'founding_step_completed', distinctId: userId, props: { step, ...extra } })
}
