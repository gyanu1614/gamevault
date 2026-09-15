/**
 * Next.js instrumentation hook — the single entry point that loads the
 * runtime-appropriate Sentry config. Next calls register() once per runtime
 * before any request is served.
 */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
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
 */
export const onRequestError: typeof Sentry.captureRequestError = (
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
}
