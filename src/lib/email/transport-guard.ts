/**
 * Refuse real email transport from inside a test run.
 *
 * On 2026-09-12 a `vitest run` sent live "You made a sale" and order-receipt
 * emails to real sellers' inboxes, and left orphaned in-app notifications on
 * real production accounts. The chain:
 *
 *   src/test/setup-env.ts loads .env.local into EVERY vitest run
 *     → NEXT_PUBLIC_SUPABASE_URL points at production Supabase
 *     → RESEND_API_KEY is a live key
 *     → webhook-router.integration.test.ts (no local-URL guard, unlike
 *       src/test/guards/*) inserts a real order against prod, then calls the
 *       real handleWebhook()
 *     → dispatch → notify.ts → sendOrderPaidEmail + sendNewOrderNotificationEmail
 *
 * The only existing kill-switch was an ABSENT RESEND_API_KEY, which .env.local
 * always supplies. So the guard belongs at the transport, not at each of the
 * 22 senders: a test either mocks '@/lib/email' (what every other
 * email-touching test does) or it does not send at all.
 *
 * Mirrors assertGuardTargetAllowed in src/test/guards/throwaway.ts — same
 * incident class, same opt-out, so there is one thing to remember.
 */

/** Minimal shape we read — keeps callers (and tests) from needing a full ProcessEnv. */
type EnvLike = Record<string, string | undefined>

/** True when running under vitest (set by the runner, not by us). */
export function isTestRun(env: EnvLike = process.env): boolean {
  return Boolean(env.VITEST) || env.NODE_ENV === 'test'
}

/**
 * Throws if a real send is attempted from a test run without an explicit
 * opt-out. Returning would silently drop the mail and let a test "pass" while
 * asserting nothing, so this fails loudly instead.
 */
export function assertEmailTransportAllowed(
  env: EnvLike = process.env,
  subject?: string,
): void {
  if (!isTestRun(env)) return
  if (env.ALLOW_REMOTE_GUARD_TESTS === '1') return

  throw new Error(
    `[email] refusing to send real email from a test run${subject ? ` (subject: ${JSON.stringify(subject)})` : ''}. ` +
      "Mock the module in your test — vi.mock('@/lib/email', () => ({ ... })) — " +
      'or set ALLOW_REMOTE_GUARD_TESTS=1 deliberately. ' +
      'A live run on 2026-09-12 emailed real sellers from vitest.',
  )
}
