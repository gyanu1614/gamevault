import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'
import { isProtectedPath } from '@/lib/auth/protected-routes'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Forward pathname to server components (used by admin layout for MFA gate)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  // Routes requiring authentication — single source of truth shared with the
  // logout handler (src/lib/auth/protected-routes.ts). Broadened from the old
  // narrow list to cover all of /account, /checkout, /sell, /seller, /wallet,
  // /admin — closing the audit's coverage gaps (e.g. /account/wallet,
  // /account/settings were previously unprotected). /cart was dropped in
  // ROUTE-007: it is a bare redirect to /browse, so gating it only bought a
  // pointless auth round-trip.
  const isProtectedRoute = isProtectedPath(pathname)

  // Public seller/account routes (registration, status, etc.)
  const publicSellerRoutes = [
    '/account/become-seller',
    '/account/seller-status'
  ]
  const isPublicSellerRoute = publicSellerRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute && !isPublicSellerRoute) {
    try {
      // Edge-safe client built from the request's cookies. The server client
      // (@/lib/supabase/server) is cache()-wrapped and uses next/headers —
      // importing it here crashes the edge bundle at module scope.
      const { supabase, response: authResponse } = createMiddlewareClient(request)
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        // Redirect to login with return URL
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(redirectUrl)
      }

      // V17e / Beta C — Seller-only sections. Buyers and unapproved accounts
      // hitting any /account/listings* route or /account/dashboard get bounced
      // to "/". This is the authoritative server-side gate; the client-side
      // SellerOnlyGate handles UX (toast + loader) for snappy feedback.
      const isSellerOnlyRoute =
        pathname.startsWith('/account/listings') ||
        pathname.startsWith('/account/dashboard') ||
        pathname.startsWith('/account/analytics') ||
        pathname.startsWith('/account/earnings')

      // ACC-07 — the sell surface (/sell, /sell/new, /sell/bulk, /sell/edit/*;
      // /sell/fees is public and never reaches here). Exact segment match: a
      // bare startsWith('/sell') would also catch /seller and /seller-agreement.
      const isSellSurface = pathname === '/sell' || pathname.startsWith('/sell/')

      // CRITICAL: Block restricted/banned sellers from creating/editing listings
      const isListingMutation = pathname.startsWith('/account/listings/new') ||
                                isSellSurface ||
                                pathname.includes('/edit')

      // ONE source of truth for "may this account sell?": the sell_access_kind
      // RPC (migration 20260925204757), pinned to the caller. The same answer
      // gates the listings trigger, the INSERT policy, the storage policy and
      // the server actions, so the page gate can never disagree with them.
      //   seller | seller_blocked  profiles.role = 'seller' (status decides)
      //   admin                    active admin (may publish, parity with RLS)
      //   applicant                application in the pipeline: wizard + drafts
      //   none                     everyone else
      if (isSellerOnlyRoute || isListingMutation) {
        // (cast: the edge client is typed from database.types.ts, which does
        // not carry the Functions map; the RPC is pinned server-side anyway.)
        const { data: kindRaw } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>)(
          'sell_access_kind',
          { p_user: user.id },
        )
        const kind: string = typeof kindRaw === 'string' ? kindRaw : 'none'
        const hasSellerRole = kind === 'seller' || kind === 'seller_blocked'

        if (isSellerOnlyRoute && !hasSellerRole) {
          // Not an approved seller — push to home with a query flag
          // so the homepage can surface a toast if it wants to.
          const homeUrl = new URL('/', request.url)
          homeUrl.searchParams.set('access', 'seller-only')
          return NextResponse.redirect(homeUrl)
        }

        if (isListingMutation && kind === 'seller_blocked') {
          // Redirect restricted/banned sellers to restrictions page
          return NextResponse.redirect(new URL('/account/restrictions', request.url))
        }

        if (isSellSurface && !(kind === 'seller' || kind === 'admin' || kind === 'applicant')) {
          // Buyers and accounts with no application in the pipeline start
          // at the seller application, not inside the wizard.
          return NextResponse.redirect(new URL('/account/become-seller', request.url))
        }
      }

      // Carry any cookies Supabase rotated during getUser() onto the response
      // we hand back, alongside the x-pathname header.
      const passThrough = NextResponse.next({ request: { headers: requestHeaders } })
      authResponse.cookies.getAll().forEach((cookie) => {
        passThrough.cookies.set(cookie)
      })
      return passThrough
    } catch (error) {
      console.error('Middleware auth error:', error)
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
