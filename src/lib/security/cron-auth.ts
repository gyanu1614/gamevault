/**
 * PAY-020 — one cron bearer check for every /api/cron/* route.
 *
 * The routes compared `authHeader !== \`Bearer ${CRON_SECRET}\`` — a plain
 * string compare whose running time depends on where the first mismatching
 * byte sits — while every provider signature in lib/payments compares
 * timing-safe. Not a practical oracle over the network at this size, but
 * the codebase should have exactly one way to check a secret, and it should
 * be the constant-time one.
 *
 * Fails CLOSED: an unset CRON_SECRET rejects every caller (no default token).
 */
import { timingSafeEqual } from 'node:crypto'

type HeaderLike = { get(name: string): string | null }

/** Constant-time compare of two strings (length mismatch also constant-time). */
export function secretsMatch(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) {
    // Burn the same work as a real compare so length is not a fast path.
    timingSafeEqual(b, b)
    return false
  }
  return timingSafeEqual(a, b)
}

/** True when the request carries `Authorization: Bearer <CRON_SECRET>`. */
export function isCronAuthorized(headers: HeaderLike, secret = process.env.CRON_SECRET): boolean {
  if (!secret) return false
  const header = headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) return false
  return secretsMatch(header.slice('Bearer '.length), secret)
}
