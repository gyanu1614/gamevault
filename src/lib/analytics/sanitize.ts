/**
 * PostHog privacy filter (growth point 1): no personal data in URLs or events.
 * Runs as `before_send` on every browser event and on server events.
 *
 *   - URLs keep their path and only the campaign params we report on
 *     (utm_*, ref, src); every other query param and the hash are dropped.
 *   - UUIDs in a path (order, account, checkout ids) become `:id`.
 *   - Referrers keep only their origin, so a search query never travels.
 *   - Properties named like personal data are dropped outright (never
 *     PostHog's own required token / distinct_id).
 */

const KEEP_PARAMS = /^(utm_(source|medium|campaign|term|content)|ref|src)$/
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const PERSONAL_KEYS = /^(email|e-mail|name|full_?name|first_?name|last_?name|username|phone|address|ip|password)$/i
/**
 * PostHog's own fields. posthog-js DROPS the whole event when before_send
 * removes one of them (`token` is the project token, not a secret), so they
 * are never filtered — only URL-ish ones are cleaned.
 */
const POSTHOG_REQUIRED = new Set(['token', 'distinct_id'])
const URL_KEY = /(url|pathname|referrer)$/i
const REFERRER_KEY = /referrer$/i

export function sanitizeUrl(value: string, opts: { originOnly?: boolean } = {}): string {
  const relative = value.startsWith('/')
  if (!relative && !/^https?:\/\//i.test(value)) return value
  let url: URL
  try {
    url = new URL(value, 'https://relative.invalid')
  } catch {
    return value
  }
  if (opts.originOnly && !relative) return url.origin
  const kept = new URLSearchParams()
  url.searchParams.forEach((v, k) => {
    if (KEEP_PARAMS.test(k)) kept.append(k, v)
  })
  const query = kept.toString()
  const path = url.pathname.replace(UUID, ':id')
  return `${relative ? '' : url.origin}${path}${query ? `?${query}` : ''}`
}

type Props = Record<string, unknown>

export function sanitizeEventProperties(props: Props): Props {
  const out: Props = {}
  for (const [key, value] of Object.entries(props)) {
    if (!POSTHOG_REQUIRED.has(key) && PERSONAL_KEYS.test(key)) continue
    if ((key === '$set' || key === '$set_once') && value && typeof value === 'object') {
      out[key] = sanitizeEventProperties(value as Props)
    } else if (typeof value === 'string' && URL_KEY.test(key)) {
      out[key] = sanitizeUrl(value, { originOnly: REFERRER_KEY.test(key) })
    } else {
      out[key] = value
    }
  }
  return out
}
