'use client'

import { useAuth } from '@/hooks/use-auth'
import AccountSidebar from '@/components/account/AccountSidebar'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/account')}`)
    }
  }, [user, loading, pathname, router])

  // V21/P7.ah — Auth-resolving state renders OVER the hero backdrop (not
  // flat black) so navigating into /account/* doesn't flash a black
  // screen before the backdrop fades in. Same backdrop the resolved
  // layout uses, so there's no visual swap when auth settles.
  if (loading) {
    return (
      <>
        <HeroBackdropPreload name="account" />
        <HeroBackdrop name="account" className="hero-dim">
          <div className="flex min-h-screen items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-text-secondary">Loading...</p>
            </div>
          </div>
        </HeroBackdrop>
      </>
    )
  }

  // Don't render protected content if not authenticated
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
      <HeroBackdrop name="account" className="hero-dim lg:pl-72">
        <div className="pt-14">{children}</div>
      </HeroBackdrop>
      <AccountSidebar user={sidebarUser} />
    </>
  )
}
