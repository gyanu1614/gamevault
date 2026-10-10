import { sanitizeUrl } from './sanitize'

type VercelEvent = { type: 'pageview' | 'event'; url: string }

/**
 * Vercel Web Analytics `beforeSend`: the same URL filter PostHog gets
 * (./sanitize). Without it every page view stored the full address, so
 * private links (/founding?id=…&token=…, ?email= on auth pages) sat in
 * Vercel's analytics. Path + campaign params only; UUIDs become `:id`.
 */
export function vercelBeforeSend<E extends VercelEvent>(event: E): E {
  return { ...event, url: sanitizeUrl(event.url) }
}
