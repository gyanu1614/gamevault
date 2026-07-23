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
import { IconRocket, IconArrowRight } from '@tabler/icons-react'
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
      className="relative z-[60] w-full border-b border-white/[0.07] bg-[#12100a]/90 backdrop-blur-xl backdrop-saturate-150"
    >
      {/* Thin amber accent rail along the top edge — the "chosen" detail
          instead of a full amber wash. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${AMBER}66, transparent)` }}
      />

      <div className="relative mx-auto flex min-h-[42px] max-w-[1400px] items-center justify-between gap-4 px-4 py-2 sm:px-6">
        {/* Left — status. Squared glyph badge (not a pill) + label + copy. */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span
            className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border border-[#F5C451]/25 bg-[#F5C451]/10"
            style={{ color: AMBER }}
          >
            <IconRocket className="h-[15px] w-[15px]" stroke={2} />
          </span>
          <p className="truncate text-[12.5px] leading-tight text-text-secondary sm:text-[13px]">
            <span
              className="font-bold uppercase tracking-[0.08em]"
              style={{ color: AMBER }}
            >
              Beta
            </span>
            <span aria-hidden className="mx-2 text-white/20">·</span>
            <span className="font-semibold text-white">
              We&apos;re now live in early access
            </span>
            <span className="hidden text-text-tertiary md:inline">
              {' '}— full launch coming soon.
            </span>
          </p>
        </div>

        {/* Right — CTA. Rectangular soft-corner button, not a pill. */}
        <Link
          href="/early-seller"
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-[#F5C451]/35 bg-[#F5C451]/[0.08] px-3 py-[7px] text-[12px] font-semibold text-[#F5C451] transition-colors hover:border-[#F5C451]/55 hover:bg-[#F5C451]/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C451]/50 sm:text-[12.5px]"
        >
          <span className="hidden sm:inline">Become a Founding Seller</span>
          <span className="sm:hidden">Founding Seller</span>
          <IconArrowRight className="h-[15px] w-[15px] transition-transform group-hover:translate-x-0.5" stroke={2.2} />
        </Link>
      </div>
    </div>
  )
}
