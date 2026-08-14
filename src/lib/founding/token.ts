/**
 * Founding-seller HQ magic-link token.
 *
 * A waitlist applicant (`early_seller_signups` row) has no `profiles.id` and no
 * password, so they can't log in to reach their Founding HQ. Instead the
 * "claim your spot" email embeds `/founding?id=<signupId>&token=<t>`, where the
 * token is an HMAC of the signup id + email with a server secret — exactly the
 * stateless, timing-safe pattern used for CoinGate callbacks
 * (src/lib/payments/providers/coingate/callback-token.ts). No token table: the
 * link is personal and unguessable without the secret, and verification needs
 * only the row it already has to fetch.
 *
 * The token intentionally binds the email too, so a leaked id alone (e.g. from a
 * log) can't be turned into a working link, and rotating a row's email
 * invalidates its old link.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Secret for signing founding links. Falls back through a couple of secrets
 * that already exist in this project's env so a fresh deploy doesn't 500 before
 * a dedicated key is set — but a dedicated `FOUNDING_LINK_SECRET` is preferred
 * and should be set in production.
 */
function secret(): string {
  const s =
    process.env.FOUNDING_LINK_SECRET ||
    process.env.PAYOUT_ENCRYPTION_KEY ||
    process.env.COINGATE_CALLBACK_TOKEN_SECRET
  if (!s) {
    throw new Error(
      '[Founding] No signing secret set. Provide FOUNDING_LINK_SECRET (preferred) ' +
        'or PAYOUT_ENCRYPTION_KEY.',
    )
  }
  return s
}

/** Deterministic per-signup HQ token. Binds both id and email. */
export function foundingTokenFor(signupId: string, email: string): string {
  return createHmac('sha256', secret())
    .update(`${signupId}:${email.trim().toLowerCase()}`)
    .digest('hex')
}

/** Timing-safe check that a presented token matches this signup. */
export function foundingTokenMatches(
  signupId: string,
  email: string,
  presented: string | undefined | null,
): boolean {
  if (!presented) return false
  const expected = foundingTokenFor(signupId, email)
  // Both are hex sha256 (64 chars); lengths must match for timingSafeEqual.
  if (presented.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(presented), Buffer.from(expected))
  } catch {
    return false
  }
}
