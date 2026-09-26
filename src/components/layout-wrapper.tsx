'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from '@/components/navbar-floating'
import { Footer } from '@/components/footer'
import { BetaBanner } from '@/components/beta-banner'

export function LayoutWrapper({
  children,
  footerGameLinks,
}: {
  children: React.ReactNode
  /** Server-rendered "Popular Games" directory section (GameBoost-style),
      rendered as its own band ABOVE the Footer. */
  footerGameLinks?: React.ReactNode
}) {
  const pathname = usePathname()

  // Don't show navbar and footer on admin pages
  const isAdminPage = pathname?.startsWith('/admin')

  // The sell wizard is a focused task surface, not a browsing page: it
  // strips the global navbar AND footer so nothing competes with the
  // form, and the wizard's own progress rail sits where the navbar was.
  // /sell/fees is the public fee schedule (normal chrome); only the wizard
  // routes (/sell/new, /sell/edit, /sell/bulk) get the stripped shell. An
  // exact segment match also keeps /seller/* and /seller-agreement out.
  const isSellWizard =
    /^\/sell\/(new|edit|bulk)(\/|$)/.test(pathname ?? '') ||
    // The dev harness must render the same chrome-less shell as the real
    // route, or it measures a layout nobody sees.
    !!pathname?.startsWith('/dev/sell-wizard-preview')

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
    pathname?.startsWith('/account/seller-status') ||
    pathname?.startsWith('/signup-become-seller') ||
    pathname?.startsWith('/founding') ||
    pathname?.startsWith('/early-seller') ||
    pathname?.startsWith('/dev/seller-status-preview') ||
    pathname?.startsWith('/dev/seller-intro-preview') ||
    pathname?.startsWith('/kyc/complete')

  // SAB "DropMarket Values" hub (values directory, per-brainrot pages, and
  // the cash/trade calculators) is an SEO/content destination with its own
  // slim forest header (see _ValuesHeader) — strip the global navbar + beta
  // banner so it reads as its own section, not the storefront. Footer stays
  // for internal-link SEO. Same "own slim header" precedent as checkout.
  // The Values HUB (directory / item / calculator) strips the global navbar for
  // its own slim "DropMarket Values" header. The SAB LANDING is a normal
  // MARKETPLACE page — it keeps the global navbar + the standard GameSubNav pill
  // (like every other game/category page), so it is NOT matched here.
  const isValuesHub =
    !!pathname &&
    /^\/[^/]+\/(values|calculator|neon-calculator|blog|price-index|sell)(\/|$)/.test(pathname)

  // Check if we're on a seller page with sidebar (not /new or /edit)
  const isSellerPageWithSidebar = pathname?.startsWith('/seller') &&
    !pathname?.includes('/new') &&
    !pathname?.includes('/edit')

  // Account pages have sidebar, except for order detail pages
  const isOrderDetail = /^\/account\/orders\/[^/]+$/.test(pathname || '')
  const isAccountPage = pathname?.startsWith('/account') && !isOrderDetail

  const hasSidebar = isSellerPageWithSidebar || isAccountPage

  // TEMPORARY — homepage rebuild. The homepage is being rebuilt section by
  // section against the layout contract in CLAUDE.md; it renders as an empty
  // scroll surface with only the navbar until sections are added back. The
  // footer (incl. the game-links matrix) is suppressed here so the empty
  // page can be verified on its own. Remove this flag when the rebuild lands.
  // Was: suppress the footer on '/' while the homepage was an empty scroll
  // surface. The rebuild has sections now, so the footer renders there again.
  const isHomepageRebuild = false

  return (
    <div className={`flex min-h-screen flex-col${isValuesHub ? ' hub-chrome' : ''}`}>
      {/* Beta announcement bar — normal-flow so it scrolls away with the
          page; the fixed navbar reads its remaining height and rides just
          below it. Self-hides on chrome-less shells (admin/checkout/seller
          application) to match the navbar rules below. */}
      {/* Not on sidebar'd account/seller pages: the banner recruits sellers
          ("Sell on DropMarket … Start Earning"), which is noise once you are
          signed in and standing in your own account area. */}
      {!isAdminPage && !isCheckout && !isSellerApplication && !isValuesHub && !isSellWizard && !hasSidebar && (
        <BetaBanner />
      )}
      {/* P5 — Checkout strips the global navbar: the page carries its
          own slim header (brand left · secure badge right). */}
      {/* Sidebar'd account pages pin the navbar to its full-width bar mode:
          the floating pill reads as an overlay above a page that already has
          its own left rail. */}
      {!isAdminPage && !isCheckout && !isSellerApplication && !isValuesHub && !isSellWizard && (
        <Navbar forceScrolled={hasSidebar} />
      )}
      <main className="flex-1">{children}</main>
      {/* Sidebar'd account/seller pages have no marketing footer — it
          scrolled awkwardly over the sidebar and adds nothing there. */}
      {/* The content hub renders its own compact forest footer (HubFooter,
          per page, since it needs the game's data). The tall lime marketplace
          footer would be more footer than page on a guide or value list. */}
      {!isAdminPage &&
        !isSellWizard &&
        !isCheckout &&
        !isSellerApplication &&
        !hasSidebar &&
        !isValuesHub &&
        !isHomepageRebuild && (
          // Direction A: the games directory is a slot INSIDE the footer
          // rather than its own band above it — see the note in footer.tsx.
          <Footer gameDirectory={footerGameLinks} />
        )}
    </div>
  )
}
