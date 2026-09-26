import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database.types'

/**
 * Edge-safe Supabase client for src/middleware.ts.
 *
 * DO NOT import `@/lib/supabase/server` from middleware. That module is
 * request-scoped with React `cache()` (STATE-009) and reads cookies via
 * `next/headers` — neither works in the edge runtime:
 *
 *   - react@18 exports `cache` from NO build. Server components only get it
 *     because Next aliases `react` to next/dist/compiled/react. The middleware
 *     edge bundle resolves the bare package, so `cache` is undefined and
 *     `cache(fn)` throws at module scope → MIDDLEWARE_INVOCATION_FAILED on
 *     every matched route (production outage, 2026-09-13).
 *   - `cookies()` from next/headers is not available in middleware at all.
 *
 * Here cookies come off the NextRequest/NextResponse pair instead, which is the
 * supported middleware pattern. Guarded by
 * src/test/guards/middleware-edge-safety.test.ts.
 */
export function createMiddlewareClient(request: NextRequest) {
  // Mutable so cookie writes (token refresh) can rebuild the response while
  // preserving any headers the caller has already set on the request.
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // `response` is read through a getter: Supabase may replace it during
  // auth.getUser() when it refreshes the session, and the caller must return
  // the LATEST one or the refreshed cookies are dropped.
  return {
    supabase,
    get response() {
      return response
    },
  }
}

/**
 * Back-compat helper: refresh the session and return the response carrying any
 * rotated auth cookies.
 */
export async function updateSession(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request)
  await supabase.auth.getUser()
  return response
}
