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

  // Noise that is not a defect in this app.
  //
  // "Load failed" (WebKit) / "Failed to fetch" (Chromium) / "NetworkError"
  // (Firefox) are the browsers' opaque messages for ANY network-layer fetch
  // failure: offline, radio handover, DNS, TLS, or an in-app webview killing
  // in-flight requests when its host app backgrounds. On mobile that is a
  // condition of browsing, not a bug — the fix is for the call site to degrade
  // (see src/lib/utils/safe-background.ts), which the 16 Sep 2026 events now
  // do. Reporting them too would drown real errors in transport noise.
  //
  // NOTE this filters the SYMPTOM, so it must stay paired with call sites that
  // actually degrade. A required read that genuinely cannot complete should
  // surface its own typed error (e.g. FoundingDataError) which is NOT matched
  // here and still reports.
  //
  // "ResizeObserver loop" is a benign spec-mandated notice browsers emit when
  // a layout settles over two frames; "Non-Error promise rejection" is the
  // SDK's wrapper for a rejection with no Error in it, almost always thrown by
  // third-party scripts we cannot fix.
  ignoreErrors: [
    'Load failed',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
    'ResizeObserver loop',
    'Non-Error promise rejection',
  ],

  // Errors whose stack lives entirely in code we did not ship: browser
  // extensions injected into the page, and the `app:///scripts/` origin used
  // by in-app webview wrappers. We cannot fix them and they are not our users'
  // experience of the app.
  denyUrls: [
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
    /^safari-web-extension:\/\//i,
    /app:\/\/\/scripts\//i,
  ],

  // Session Replay is off deliberately: it ships a heavy extra bundle to every
  // visitor and records DOM content from checkout, payout and KYC screens.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  debug: false,
})

// Required for navigation spans on App Router route changes.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
