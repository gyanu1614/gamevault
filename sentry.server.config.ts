/**
 * Node-runtime Sentry init (route handlers, server components, server actions).
 * Loaded from src/instrumentation.ts when NEXT_RUNTIME === 'nodejs'.
 *
 * SENTRY_DSN is read first (server-only, set in Vercel), falling back to the
 * NEXT_PUBLIC_ one so a project that only sets the public var still reports.
 * `enabled` follows the same value, so a deploy without a DSN is inert rather
 * than queueing events it can never deliver.
 *
 * Set SENTRY_DEBUG=1 to make the SDK log what it is doing. Note that a
 * production `next build` strips debug logging from the bundle and the SDK
 * will say so — use `next dev` when you need the full debug trace.
 */
import * as Sentry from '@sentry/nextjs'
import { deployTags } from '@/lib/observability/deploy-tags'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: Boolean(
    process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  ),

  tracesSampleRate: 0.1,

  initialScope: { tags: deployTags() },

  debug: Boolean(process.env.SENTRY_DEBUG),
})
