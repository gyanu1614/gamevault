/**
 * Node-runtime Sentry init (route handlers, server components, server actions).
 * Loaded from instrumentation.ts when NEXT_RUNTIME === 'nodejs'.
 */
import * as Sentry from '@sentry/nextjs'
import { deployTags } from '@/lib/observability/deploy-tags'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: Boolean(
    process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  ),

  tracesSampleRate: 0.1,

  // Replays are a browser-only product; named here only so the intent is
  // explicit across all three configs.
  initialScope: { tags: deployTags() },

  debug: false,
})
