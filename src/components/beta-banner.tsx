'use client'

/**
 * BetaBanner — thin glassy amber announcement bar pinned to the very top
 * of the document (above the floating navbar, in normal flow so it scrolls
 * away naturally as the page moves down — classic Shopify/Vercel pattern).
 *
 * Left: "Beta" pill + status line. Right: an early-seller CTA that links to
 * the /early-seller waitlist form. Amber = "heads up, not an error" — sits
 * apart from the site's lime brand and its semantic red/green.
 *
 * Hidden on admin/checkout/seller-application shells (those own their whole
 * canvas), matching LayoutWrapper's chrome rules.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'

const AMBER = '#F5C451'

export function BetaBanner() {
  const pathname = usePathname() || ''
  const ref = useRef<HTMLDivElement>(null)

  // Publish how much of the banner is still on-screen as a CSS var the
  // fixed navbar reads, so the floating navbar rides just below the banner
  // while it's visible and slides up to the true top as it scrolls away.
  // rAF-throttled scroll listener — cheap, passive.
  useEffect(() => {
    const el = ref.current
    const root = document.documentElement
    if (!el) {
      root.style.setProperty('--beta-banner-offset', '0px')
      return
    }
    let raf = 0
    const update = () => {
      raf = 0
      const remaining = Math.max(0, el.getBoundingClientRect().bottom)
      root.style.setProperty('--beta-banner-offset', `${remaining}px`)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
      root.style.setProperty('--beta-banner-offset', '0px')
    }
  }, [pathname])

  // Mirror LayoutWrapper: no banner on full-canvas / chrome-less shells.
  const hidden =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/dev/checkout-preview') ||
    pathname.startsWith('/account/become-seller') ||
    pathname.startsWith('/account/seller-status') ||
    pathname.startsWith('/kyc/complete')

  if (hidden) return null

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Beta announcement"
      className="relative z-[60] w-full border-b border-[#F5C451]/20 bg-[#1a160b]/80 backdrop-blur-xl backdrop-saturate-150"
    >
      {/* Warm top sheen so the glass reads as amber, not just dark. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[linear-gradient(to_bottom,rgba(245,196,81,0.10),rgba(245,196,81,0.02))]"
      />

      <div className="relative mx-auto flex min-h-[40px] max-w-[1400px] items-center justify-between gap-3 px-4 py-1.5 sm:px-6">
        {/* Left — status */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#F5C451]/30 bg-[#F5C451]/10 px-2 py-[3px] text-[10px] font-bold uppercase tracking-wider"
            style={{ color: AMBER }}
          >
            <Sparkles className="h-3 w-3" />
            Beta
          </span>
          <p className="truncate text-[12.5px] leading-tight text-white/85 sm:text-[13px]">
            <span className="font-semibold text-white">
              DropMarket is in early beta
            </span>
            <span className="hidden text-white/60 sm:inline">
              {' '}— launching fully soon. Trades run in test mode for now.
            </span>
          </p>
        </div>

        {/* Right — CTA */}
        <Link
          href="/early-seller"
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#F5C451]/40 bg-[#F5C451]/12 px-3 py-[6px] text-[12px] font-semibold text-[#F5C451] transition-colors hover:bg-[#F5C451]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C451]/50 sm:text-[12.5px]"
        >
          <span className="hidden sm:inline">
            Be one of the first 100 sellers — lower fees
          </span>
          <span className="sm:hidden">First 100 sellers</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}
