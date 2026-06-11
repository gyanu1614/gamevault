import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Forward pathname to server components (used by admin layout for MFA gate)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  // Protected routes that require authentication
  const protectedRoutes = [
    '/orders',
    '/purchases',
    '/account/dashboard',
    '/account/listings',
    '/account/analytics',
    '/account/earnings'
  ]
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

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
