'use client'

import { useAuth } from '@/hooks/use-auth'
import AccountSidebar from '@/components/account/AccountSidebar'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'
import { isLoggingOut } from '@/lib/auth/logout-signal'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  // Redirect to login if not authenticated.
  // BUT skip it during a user-initiated logout: the navbar already drives the
  // user home, and racing it with a /login push flashes the login screen +
  // collapses this page mid-logout. A genuine session expiry (no logout flag)
  // still redirects to login as before.
  useEffect(() => {
    if (!loading && !user && !isLoggingOut()) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/account')}`)
    }
  }, [user, loading, pathname, router])

  // V21/P7.ah — Auth-resolving state renders OVER the hero backdrop (not
  // flat black) so navigating into /account/* doesn't flash a black
  // screen before the backdrop fades in. Same backdrop the resolved
  // layout uses, so there's no visual swap when auth settles.
  if (loading) {
    // Context-aware loader copy. Coming back from checkout lands on an order
    // page — "Preparing your order" reads far better than a bare "Loading…".
    const loadingLabel = (() => {
      const p = pathname || ''
      if (/^\/account\/orders\/[^/]+/.test(p)) return 'Preparing your order…'
      if (p.startsWith('/account/orders')) return 'Loading your orders…'
      if (p.startsWith('/account/wallet')) return 'Loading your wallet…'
      return 'Loading your account…'
    })()
    return (
      <>
        <HeroBackdropPreload name="account" />
        <HeroBackdrop name="account" className="hero-dim">
          <div className="flex min-h-screen items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
              <p className="text-sm font-medium text-text-secondary">{loadingLabel}</p>
            </div>
          </div>
        </HeroBackdrop>
      </>
    )
  }

  // Don't render protected content if not authenticated. During a logout the
  // navbar's full-screen overlay is already up and driving the user home, so
  // returning null here is invisible (and avoids briefly painting this page
  // logged-out in place — the "bottom of the page" flash).
  if (!user) {
    return null
  }

  // Flatten profile data for AccountSidebar
  const sidebarUser = user ? {
    id: user.id,
    username: user.profile?.username || user.email?.split('@')[0] || '',
    email: user.email || '',
    avatar_url: user.profile?.avatar_url || undefined,
    seller_tier: user.profile?.seller_tier,
    isApprovedSeller: user.isApprovedSeller,
    shop_name: user.profile?.shop_name,
    shop_slug: user.profile?.shop_slug,
    seller_status: (user.profile as any)?.seller_status as 'active' | 'restricted' | 'banned',
    joinedAt: (user.profile as any)?.created_at as string | undefined,
  } : undefined

  // Hide sidebar on certain pages for a clean full-width view
  const isOrderDetail = /^\/account\/orders\/[^/]+$/.test(pathname || '')
  const isBecomeSeller = pathname === '/account/become-seller'
  const isSellerStatus = pathname === '/account/seller-status'

  if (isOrderDetail || isBecomeSeller || isSellerStatus) {
    // V21/P5.v — Dropped the `bg-[#0a0a0f] pt-8 sm:pt-10 md:pt-12`
    // wrapper styles. The pt-* was painting a solid black band
    // between the (transparent-over-hero) navbar and the order
    // page's own gradient/glow background. The order detail and
    // become-seller pages render their own backdrops; this wrapper
    // shouldn't add a competing solid layer above them.
    return <div className="min-h-screen">{children}</div>
  }

  return (
    <>
      <HeroBackdropPreload name="account" />
      {/* V21/P7.c — Account sidebar pages share the `account` hero.
          The `bg-black` from before is replaced with a transparent
          wrapper so the HeroBackdrop's scrim + bg-base show through
          consistently with the rest of the site.
          V21/P7.e — Sidebar renders AFTER the backdrop in DOM order
          so it paints on top of the .hero-backdrop layer (both have
          `position: fixed`-ish behaviour but are sibling stacking
          contexts under `<>...</>` — last-written wins). Otherwise
          the wrapper covers the sidebar entirely. */}
      {/* V21/P7.ak — Single source of navbar clearance for ALL sidebar
          account pages: pt-20 = the 80px fixed navbar height, so content
          starts flush under the navbar. Pages must NOT add their own
          navbar-clearance padding on top (only internal content rhythm). */}
      <HeroBackdrop name="account" className="hero-dim lg:pl-64">
        <div className="pt-14">{children}</div>
      </HeroBackdrop>
      <AccountSidebar user={sidebarUser} />
    </>
  )
}
