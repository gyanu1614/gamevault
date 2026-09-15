/**
 * Edge-runtime Sentry init (middleware and `runtime = 'edge'` handlers).
 * Loaded from instrumentation.ts when NEXT_RUNTIME === 'edge'.
 *
 * EDGE SAFETY: this file, and everything it imports, must stay free of
 * node-only modules (fs/path/crypto/next-headers). It is NOT imported by
 * src/middleware.ts — Next loads it through the instrumentation hook — so it
 * does not enter the graph that
 * src/test/guards/middleware-edge-safety.test.ts walks. @/lib/observability/
 * deploy-tags reads process.env only, which the edge runtime provides.
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

  debug: false,
})
