/**
 * Rate limiting for abuse-prone routes and server actions.
 *
 * Backed by `rate_limit_hit()` (migration 20260916100000): a single atomic
 * INSERT .. ON CONFLICT in Postgres, so the budget is shared by every Vercel
 * lambda instance in every region. An in-memory limiter is NOT a substitute --
 * each warm instance would carry its own counter, multiplying an attacker's
 * real budget by the number of instances.
 *
 * IMPORTANT: src/middleware.ts must never import this module. It pulls in the
 * service-role client (node-only), and middleware runs on the edge runtime --
 * `src/test/guards/middleware-edge-safety.test.ts` fails the build if the
 * middleware import graph ever reaches it. Apply limits in route handlers and
 * server actions instead, where the Node runtime is available.
 *
 * Fail-open: if the limiter itself errors (DB unreachable, migration not yet
 * applied), the request is ALLOWED. A rate limiter that hard-fails closed turns
 * one database blip into a total outage, including for checkout and webhooks.
 * The error is logged so the failure is visible rather than silent.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'

/** A named budget: `limit` requests per `windowSeconds`. */
export type RateLimitBudget = { limit: number; windowSeconds: number }

/**
 * The budgets, as specified. Keyed by a short route family name that also
 * becomes part of the counter key, so one IP's checkout budget is independent
 * of its login budget.
 */
export const RATE_LIMITS = {
  /** /api/auth/* and the login/signup server actions. */
  auth: { limit: 10, windowSeconds: 60 },
  /** Checkout order creation. */
  checkout: { limit: 20, windowSeconds: 60 },
  /** Provider webhook intake -- keyed per provider, not per IP (see below). */
  webhook: { limit: 120, windowSeconds: 60 },
  /** /api/internal/*. */
  internal: { limit: 30, windowSeconds: 60 },
  /** Public contact / support / waitlist forms. */
  contact: { limit: 5, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitBudget>

export type RateLimitName = keyof typeof RATE_LIMITS

export type RateLimitResult = {
  /** True when the caller is over budget and the request must be rejected. */
  limited: boolean
  /** Seconds the caller should wait before retrying. Always >= 1. */
  retryAfter: number
  /** The counter key that was charged -- useful for logs and tests. */
  key: string
}

/** Header bag that works for both `Request.headers` and Next's `headers()`. */
type HeaderLike = { get(name: string): string | null }

/**
 * The client IP: the FIRST hop of x-forwarded-for.
 *
 * Vercel appends the real client IP as the leftmost entry and strips any
 * client-supplied value, so hop 0 is the trustworthy one. Taking the last hop
 * instead would read a proxy address and collapse every visitor onto one key.
 */
export function clientIp(headers: HeaderLike): string {
  const forwarded = headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  if (first) return first
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Build the counter key. Exported so tests can assert on key shape. */
export function rateLimitKey(name: RateLimitName, identifier: string): string {
  return `${name}:${identifier}`
}

/** The shape of the `rate_limit_hit` RPC — see the note inside checkRateLimit. */
type RateLimitRpc = (
  fn: 'rate_limit_hit',
  args: { p_key: string; p_limit: number; p_window_seconds: number },
) => PromiseLike<{ data: boolean | null; error: { message: string } | null }>

/**
 * Charge one hit against a budget.
 *
 * `identifier` scopes the budget -- an IP for user-facing routes, a provider
 * name for webhooks. Pass it explicitly so the caller decides what "per" means.
 */
export async function checkRateLimit(
  name: RateLimitName,
  identifier: string,
  budget: RateLimitBudget = RATE_LIMITS[name],
): Promise<RateLimitResult> {
  const key = rateLimitKey(name, identifier || 'unknown')
  const retryAfter = Math.max(1, budget.windowSeconds)

  try {
    const supabase = createServiceRoleClient()
    // Typed locally rather than through Database['public']['Functions']: the
    // hand-written schema in src/types/database.ts has no `Relationships` key
    // on its tables, so it fails postgrest-js' GenericSchema constraint and
    // every .rpc() there degrades to accepting `undefined` args. Widening that
    // schema is a separate change; this keeps the call site honestly typed.
    const { data, error } = await (supabase.rpc as RateLimitRpc)('rate_limit_hit', {
      p_key: key,
      p_limit: budget.limit,
      p_window_seconds: budget.windowSeconds,
    })

    if (error) {
      // Fail open -- see the module header.
      console.error(`[rate-limit] ${key}: ${error.message}`)
      return { limited: false, retryAfter, key }
    }

    return { limited: data === true, retryAfter, key }
  } catch (err) {
    console.error(`[rate-limit] ${key}:`, err)
    return { limited: false, retryAfter, key }
  }
}

/**
 * Charge a budget keyed by the caller's IP, read from a header bag.
 * The common case for route handlers and server actions.
 */
export async function checkRateLimitByIp(
  name: RateLimitName,
  headers: HeaderLike,
): Promise<RateLimitResult> {
  return checkRateLimit(name, `ip:${clientIp(headers)}`)
}

/**
 * The 429 a limited caller gets. `Retry-After` is in seconds (RFC 9110); we
 * also send the conventional X-RateLimit-* hints.
 *
 * Returned as a plain `Response` rather than NextResponse so this module stays
 * usable from anywhere on the server.
 */
export function rateLimitResponse(result: RateLimitResult, message?: string): Response {
  return Response.json(
    {
      success: false,
      error: message ?? 'Too many requests. Please slow down and try again shortly.',
    },
    {
      status: 429,
      headers: {
        'retry-after': String(result.retryAfter),
        'x-ratelimit-reset': String(result.retryAfter),
        'cache-control': 'no-store',
      },
    },
  )
}

/**
 * Server-action variant: charges the caller's IP and, when over budget,
 * returns a plain `{ error }` object instead of a Response.
 *
 * Server actions return values to the client component rather than HTTP
 * responses, so a 429 would be invisible; callers surface `error` in the form
 * exactly as they already surface a validation failure. `retryAfter` carries
 * the same seconds value the Retry-After header would.
 *
 * Returns null when the caller is within budget, so the call site reads:
 *   const limited = await rateLimitAction('auth')
 *   if (limited) return limited
 */
export async function rateLimitAction(
  name: RateLimitName,
  message?: string,
): Promise<{ error: string; rateLimited: true; retryAfter: number } | null> {
  // Imported lazily: next/headers is only resolvable inside a request scope,
  // and keeping it out of module scope lets this file stay unit-testable.
  const { headers } = await import('next/headers')
  const result = await checkRateLimitByIp(name, await headers())
  if (!result.limited) return null
  return {
    error:
      message ?? 'Too many attempts. Please wait a minute before trying again.',
    rateLimited: true,
    retryAfter: result.retryAfter,
  }
}
