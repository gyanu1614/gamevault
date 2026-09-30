'use client'

import { useAuth } from '@/hooks/use-auth'
import AccountSidebar, { AccountSidebarSkeleton } from '@/components/account/AccountSidebar'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'
import { isLoggingOut } from '@/lib/auth/logout-signal'
import BuyingOpensSoonBanner from '@/components/seller/BuyingOpensSoonBanner'
import { AccountRouteSkeleton } from './_AccountRouteSkeleton'

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

  // Hide sidebar on certain pages for a clean full-width view
  const isOrderDetail = /^\/account\/orders\/[^/]+$/.test(pathname || '')
  const isBecomeSeller = pathname === '/account/become-seller'
  const isSellerStatus = pathname === '/account/seller-status'
  const bare = isOrderDetail || isBecomeSeller || isSellerStatus

  if (!user) {
    // During a logout the navbar's overlay is up and driving the user home;
    // painting anything here would flash the page logged-out in place.
    if (!loading || isLoggingOut()) return null

    // Sign-in still resolving (hard load, new tab). Middleware has already
    // verified the session for /account/*, so draw the page's own frame and
    // skeleton (the same one its loading.tsx uses) instead of a full-screen
    // spinner: skeleton, then content, with nothing in between.
    const skeleton = <AccountRouteSkeleton pathname={pathname || ''} />
    if (bare) return <div className="min-h-screen">{skeleton}</div>
    return (
      <>
        <HeroBackdropPreload name="account" />
        <HeroBackdrop name="account" className="hero-dim min-h-[calc(100dvh-var(--navbar-bottom,0px))] lg:pl-64">
          <div className="pt-7">{skeleton}</div>
        </HeroBackdrop>
        <AccountSidebarSkeleton />
      </>
    )
  }

  // Flatten profile data for AccountSidebar
  const sidebarUser = {
    id: user.id,
    username: user.profile?.username || user.email?.split('@')[0] || '',
    email: user.email || '',
    avatar_url: user.profile?.avatar_url || undefined,
    // seller_tier is nullable in the DB; AccountSidebar's prop is optional
    // (string | undefined), so normalise null away like avatar_url above.
    seller_tier: user.profile?.seller_tier || undefined,
    isApprovedSeller: user.isApprovedSeller,
    shop_name: user.profile?.shop_name,
    shop_slug: user.profile?.shop_slug,
    seller_status: (user.profile as any)?.seller_status as 'active' | 'restricted' | 'banned',
    joinedAt: (user.profile as any)?.created_at as string | undefined,
  }

  if (bare) {
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
          account pages: the navbar already emits its own in-flow spacer (60px mobile / 84px desktop), so this padding is PURELY the uniform 28px navbar-to-content gap. Pages must NOT add their own top padding. */}
      {/* Height = the space BELOW the navbar, not a full screen: with
          min-h-screen under the navbar's in-flow spacer every account page
          was taller than the window and scrolled for nothing (owner,
          2026-09-28, Withdraw Funds). */}
      <HeroBackdrop name="account" className="hero-dim min-h-[calc(100dvh-var(--navbar-bottom,0px))] lg:pl-64">
        <div className="pt-7">
          <BuyingOpensSoonBanner />
          {children}
        </div>
      </HeroBackdrop>
      <AccountSidebar user={sidebarUser} />
    </>
  )
}
