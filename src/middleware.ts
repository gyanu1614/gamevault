import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isProtectedPath } from '@/lib/auth/protected-routes'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Forward pathname to server components (used by admin layout for MFA gate)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  // Routes requiring authentication — single source of truth shared with the
  // logout handler (src/lib/auth/protected-routes.ts). Broadened from the old
  // narrow list to cover all of /account, /checkout, /cart, /sell, /seller,
  // /wallet, /admin — closing the audit's coverage gaps (e.g. /account/wallet,
  // /account/settings were previously unprotected).
  const isProtectedRoute = isProtectedPath(pathname)

  // Public seller/account routes (registration, status, etc.)
  const publicSellerRoutes = [
    '/account/become-seller',
    '/account/seller-status'
  ]
  const isPublicSellerRoute = publicSellerRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute && !isPublicSellerRoute) {
    try {
      const supabase = await createClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        // Redirect to login with return URL
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(redirectUrl)
      }

      // V17e — Seller-only sections. Buyers and unapproved accounts
      // hitting any /account/listings* route or /account/dashboard
      // get bounced to "/". This is the authoritative server-side
      // gate; the client-side SellerOnlyGate handles UX (toast +
      // loader) for snappy feedback.
      const isSellerOnlyRoute =
        pathname.startsWith('/account/listings') ||
        pathname.startsWith('/account/dashboard') ||
        pathname.startsWith('/account/analytics') ||
        pathname.startsWith('/account/earnings')

      if (isSellerOnlyRoute) {
        const { data: approvedApp } = await supabase
          .from('seller_applications')
          .select('status')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .maybeSingle()

        if (!approvedApp) {
          // Not an approved seller — push to home with a query flag
          // so the homepage can surface a toast if it wants to.
          const homeUrl = new URL('/', request.url)
          homeUrl.searchParams.set('access', 'seller-only')
          return NextResponse.redirect(homeUrl)
        }
      }

      // CRITICAL: Block restricted/banned sellers from creating/editing listings
      const isListingMutation = pathname.startsWith('/account/listings/new') ||
                                pathname.startsWith('/sell/') ||
                                pathname.includes('/edit')

      if (isListingMutation) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('seller_status')
          .eq('id', user.id)
          .single() as any

        if (profile?.seller_status && profile.seller_status !== 'active') {
          // Redirect restricted/banned sellers to restrictions page
          return NextResponse.redirect(new URL('/account/restrictions', request.url))
        }
      }
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
