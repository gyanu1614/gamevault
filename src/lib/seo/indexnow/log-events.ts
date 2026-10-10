import { recordAndFlush } from '@/lib/seo/events/log'

import type { SubmitFn } from './submit'

/**
 * The default `submit` of every event helper in this folder: it LOGS the URLs
 * to seo_url_events and tries the delivery at once (awaited); whatever fails
 * stays pending for the daily /api/cron/seo-indexnow retry. Nothing pings
 * IndexNow outside the log.
 */
export const logUrlEvents: SubmitFn = (urls, { reason }) => recordAndFlush(urls, reason)
