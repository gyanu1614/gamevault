/**
 * Google + Discord sign-in — pure helpers (no Next, no Supabase imports) so
 * the callback route, the middleware, the client gate and the set-password
 * action all share ONE definition of each rule. Unit-tested in oauth.test.ts.
 */

export type OAuthProvider = 'google' | 'discord'

export const OAUTH_PROVIDERS: readonly OAuthProvider[] = ['google', 'discord'] as const

export const SET_PASSWORD_PATH = '/auth/set-password'

/** Minimal shape of a Supabase user that the rules below read. */
export interface OAuthUserLike {
  app_metadata?: {
    provider?: string
    providers?: string[]
    /** Stamped (service role) by setInitialPassword once a password exists. */
    password_set?: boolean
    [key: string]: unknown
  }
  identities?: Array<{ provider?: string; identity_data?: Record<string, unknown> }> | null
}

/**
 * Every account must have a password. An account needs one when none of its
 * identities is the `email` provider AND no password has been stored since.
 * An account with no provider information at all is never gated — that would
 * lock out legacy users on a malformed token.
 */
export function needsPassword(user: OAuthUserLike | null | undefined): boolean {
  if (!user) return false
  if (user.app_metadata?.password_set === true) return false
  const fromMeta = user.app_metadata?.providers
  const providers = Array.isArray(fromMeta) && fromMeta.length > 0
    ? fromMeta
    : (user.identities ?? []).map((i) => i.provider).filter((p): p is string => typeof p === 'string')
  if (providers.length === 0) return false
  return !providers.includes('email')
}

/** Routes that must not bounce a password-less user to the set-password screen. */
export function isPasswordGateExempt(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname === SET_PASSWORD_PATH || pathname.startsWith(SET_PASSWORD_PATH + '/')) return true
  if (pathname.startsWith('/auth/')) return true
  // /founding step 1 hosts its own password panel (wired after Chat A merges).
  return pathname === '/founding' || pathname.startsWith('/founding/')
}

/**
 * Same-origin relative path or "/". Also refuses to land on an auth route:
 * a `next` of /login or /auth/set-password would loop the user back into the
 * flow they just finished.
 */
export function sanitizeNext(next: string | null | undefined): string {
  if (typeof next !== 'string' || next.length === 0) return '/'
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  if (/^\/(auth|login|signup)(\/|\?|#|$)/.test(next)) return '/'
  return next
}

export function oauthCallbackUrl(origin: string, next: string | null | undefined): string {
  const safe = sanitizeNext(next)
  const base = `${origin}/auth/callback`
  return safe === '/' ? base : `${base}?next=${encodeURIComponent(safe)}`
}

export function setPasswordUrl(next: string | null | undefined): string {
  const safe = sanitizeNext(next)
  return safe === '/' ? SET_PASSWORD_PATH : `${SET_PASSWORD_PATH}?next=${encodeURIComponent(safe)}`
}

/**
 * The Discord username (the unique handle, not the display name) from the
 * discord identity. Supabase stores it as `full_name` (username) and
 * `name` (`username#discriminator`, `#0` on new-style accounts). Shape matches
 * the founding flow's Discord field: 2–32 chars, new-style or legacy#1234.
 */
export function discordHandleFromUser(user: OAuthUserLike | null | undefined): string | null {
  const identity = user?.identities?.find((i) => i.provider === 'discord')
  if (!identity) return null
  const data = identity.identity_data ?? {}
  const fullName = typeof data.full_name === 'string' ? data.full_name.trim() : ''
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  const candidate = fullName || name.replace(/#0$/, '')
  if (!candidate) return null
  const ok = /^(?:[a-z0-9._]{2,32}|[^#@:`\s]{2,32}#\d{4})$/.test(candidate)
  return ok ? candidate : null
}
