'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from '@/components/navbar-floating'
import { Footer } from '@/components/footer'

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Don't show navbar and footer on admin pages
  const isAdminPage = pathname?.startsWith('/admin')

  // V19/P15.b — Sell wizard pages keep the global navbar (forced into
  // its scrolled full-width mode via Navbar's `forceScrolled` prop —
  // see navbar-floating.tsx). Footer stays hidden so the wizard owns
  // the canvas below.
  const isSellWizard = pathname?.startsWith('/sell')

  // V19/P24/P7.r — /checkout/* has its own slim layout: stripped
  // navbar + checkout-specific footer so the buyer can't leak out
  // mid-purchase. Matches industry pattern (G2A, G2G, Eldorado,
  // 2Game) which Baymard found lifts conversion 5–15%.
  // (dev-only /dev/checkout-preview mirrors the checkout chrome so the
  // design harness renders faithfully; route 404s in production.)
  const isCheckout =
    pathname?.startsWith('/checkout') || pathname?.startsWith('/dev/checkout-preview')

  // Seller application (Forest Ledger redesign) is a full-screen formal
  // flow with its own light shell — no global navbar/footer, same
  // rationale as checkout: the applicant shouldn't leak out mid-form.
  const isSellerApplication =
    pathname?.startsWith('/account/become-seller') ||
    pathname?.startsWith('/dev/seller-intro-preview')

  // Check if we're on a seller page with sidebar (not /new or /edit)
  const isSellerPageWithSidebar = pathname?.startsWith('/seller') &&
    !pathname?.includes('/new') &&
    !pathname?.includes('/edit')

  // Account pages have sidebar, except for order detail pages
  const isOrderDetail = /^\/account\/orders\/[^/]+$/.test(pathname || '')
  const isAccountPage = pathname?.startsWith('/account') && !isOrderDetail

  const hasSidebar = isSellerPageWithSidebar || isAccountPage

  return (
    <div className="flex min-h-screen flex-col">
      {/* P5 — Checkout strips the global navbar: the page carries its
          own slim header (brand left · secure badge right). */}
      {!isAdminPage && !isCheckout && !isSellerApplication && (
        <Navbar forceScrolled={isSellWizard} />
      )}
      <main className="flex-1">{children}</main>
      {!isAdminPage && !isSellWizard && !isCheckout && !isSellerApplication && (
        <Footer hasSellerSidebar={hasSidebar} />
      )}
    </div>
  )
}