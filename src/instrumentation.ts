/**
 * Next.js instrumentation hook — the single entry point that loads the
 * runtime-appropriate Sentry config. Next calls register() once per runtime
 * before any request is served.
 *
 * LOCATION MATTERS: this file must sit at src/instrumentation.ts, NOT the
 * project root, because this project has a src/ directory. Next only looks in
 * one of the two places, and it picks src/ when src/ exists. At the root it is
 * silently ignored — no warning, no build error, and every Sentry.init()
 * simply never runs, so captureException() is a no-op against an
 * uninitialized client. That is exactly how the first deploy shipped: the
 * verification route 500'd correctly and delivered nothing.
 */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

/**
 * Reports errors thrown in server components, route handlers and middleware.
 *
 * Sentry's captureRequestError already records the request; the wrapper adds
 * the route segment (the app-router path pattern, e.g. `/[gameSlug]/blog/
 * [slug]`, NOT the resolved URL) so issues group per route rather than
 * splintering across every slug. Vercel deploy identity comes from each
 * config's initialScope.
 *
 * The flush is what makes this work on serverless: Next calls onRequestError
 * while the response is already on its way out, and the lambda can freeze the
 * moment it is sent — taking the queued, not-yet-sent event with it. Awaiting
 * a bounded flush keeps the isolate alive just long enough to transmit. It is
 * capped at 2s so a slow or unreachable ingest endpoint degrades into a lost
 * event rather than a hung request.
 */
export const onRequestError: typeof Sentry.captureRequestError = async (
  err,
  request,
  errorContext,
) => {
  Sentry.withScope((scope) => {
    const routePath = errorContext?.routePath
    if (routePath) scope.setTag('route_segment', routePath)
    if (errorContext?.routeType) scope.setTag('route_type', errorContext.routeType)

    Sentry.captureRequestError(err, request, errorContext)
  })

  await Sentry.flush(2000)
}
