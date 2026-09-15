/**
 * Browser-side Sentry init.
 *
 * Next 14's client instrumentation hook — the SDK picks this file up
 * automatically (it replaced the old sentry.client.config.ts in @sentry/nextjs
 * v9+). The DSN must come from a NEXT_PUBLIC_ var because this runs in the
 * browser; the bare SENTRY_DSN is server-only and would inline as undefined.
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // No DSN (local dev, CI, a preview without the env var) => the SDK stays
  // inert rather than buffering events it can never deliver.
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  tracesSampleRate: 0.1,

  // Session Replay is off deliberately: it ships a heavy extra bundle to every
  // visitor and records DOM content from checkout, payout and KYC screens.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  debug: false,
})

// Required for navigation spans on App Router route changes.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
