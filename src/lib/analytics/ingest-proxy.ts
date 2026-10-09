/**
 * First-party path for PostHog (growth point 1), so ad-blockers don't drop
 * the funnel. Handled in middleware rather than a next.config rewrite: a
 * config rewrite forwards the browser's cookies — our Supabase session
 * included — to PostHog. Here the request is rebuilt without them.
 *
 * PostHog's endpoints end in a slash (`/i/v0/e/`), so Next's own trailing-slash
 * redirect is switched off (`skipTrailingSlashRedirect`) and the middleware
 * applies the same redirect to every other path (`trailingSlashTarget`).
 *
 * Edge-safe: no Node APIs, no `@/` imports.
 */

export const INGEST_PATH = '/ingest'
const EVENTS_HOST = 'eu.i.posthog.com'
const ASSETS_HOST = 'eu-assets.i.posthog.com'

export function ingestUpstream(pathname: string, search: string): URL | null {
  if (pathname !== INGEST_PATH && !pathname.startsWith(`${INGEST_PATH}/`)) return null
  const rest = pathname.slice(INGEST_PATH.length) || '/'
  const host = rest.startsWith('/static/') || rest.startsWith('/array/') ? ASSETS_HOST : EVENTS_HOST
  return new URL(`https://${host}${rest}${search}`)
}

const DROP_HEADERS = ['cookie', 'authorization', 'x-pathname']

export function ingestRequestHeaders(incoming: Headers, host: string): Headers {
  const headers = new Headers(incoming)
  for (const h of DROP_HEADERS) headers.delete(h)
  headers.set('host', host)
  return headers
}

export function trailingSlashTarget(pathname: string): string | null {
  if (pathname === '/' || !pathname.endsWith('/')) return null
  if (pathname.startsWith(`${INGEST_PATH}/`)) return null
  return pathname.replace(/\/+$/, '') || '/'
}

/**
 * The redirect target as a plain URL. Not `request.nextUrl.clone()`: with
 * skipTrailingSlashRedirect on, NextURL remembers the incoming slash and
 * re-adds it on format, so the redirect would point at itself.
 */
export function trailingSlashRedirectUrl(requestUrl: string): URL | null {
  const url = new URL(requestUrl)
  const target = trailingSlashTarget(url.pathname)
  if (!target) return null
  url.pathname = target
  return url
}
