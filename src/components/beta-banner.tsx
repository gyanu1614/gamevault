'use client'

/**
 * BetaBanner — the seller banner (growth point 5, 2026-10-08): a thin glassy
 * bar pinned to the very top of the document (above the floating navbar, in
 * normal flow so it scrolls away naturally as the page moves down).
 *
 * Two variants, picked from the same `useAuth()` profile the navbar reads —
 * no request, no redirect, no server round trip:
 *   · everyone else (signed out, buyers): AMBER, "Sell Game Items for Real
 *     Money" → /founding (list today, verify when you cash out);
 *   · a seller (profiles.role === 'seller'): GREEN, "Your store is open.
 *     Create your first listing and earn" → /sell/new.
 * While auth is still resolving the amber variant shows (most visitors are
 * not sellers), then it swaps without a layout change — same height.
 *
 * Hidden on admin/checkout/seller-application shells (those own their whole
 * canvas), matching LayoutWrapper's chrome rules.
 */

import Link from '@/components/navigation/AppLink'
import { usePathname } from 'next/navigation'
import { track } from '@vercel/analytics'
import { IconRocket, IconArrowRight, IconBuildingStore } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { foundingHref } from '@/lib/seo/founding-href'
import { useAuth } from '@/hooks/use-auth'

const AMBER = '#F5C451'
const GREEN = '#56B87F'

type Variant = {
  color: string
  Icon: typeof IconRocket
  lead: string
  tail: string
  cta: string
  href: string
  event: string
  bg: string
}

const VISITOR: Variant = {
  color: AMBER,
  Icon: IconRocket,
  lead: 'Sell Game Items for Real Money.',
  tail: 'Start listing today, verify when you cash out.',
  cta: 'Start Selling',
  href: foundingHref('banner'),
  event: 'seller_cta_click',
  bg: 'bg-[#12100a]/90',
}

const SELLER: Variant = {
  color: GREEN,
  Icon: IconBuildingStore,
  lead: 'Your store is open.',
  tail: 'Create your first listing and earn.',
  cta: 'Start Selling',
  href: '/sell/new',
  event: 'seller_first_listing_cta_click',
  bg: 'bg-[#0b120e]/90',
}

export function BetaBanner() {
  const pathname = usePathname() || ''
  const ref = useRef<HTMLDivElement>(null)
  const { profile } = useAuth()
  const v = profile?.role === 'seller' ? SELLER : VISITOR
  const { Icon } = v

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

  // Mirror LayoutWrapper: no banner on full-canvas / chrome-less shells,
  // and none on sidebar'd account/seller pages — the banner recruits
  // sellers, which is noise once you're inside your own account.
  const isOrderDetail = /^\/account\/orders\/[^/]+$/.test(pathname)
  const hidden =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/dev/checkout-preview') ||
    // The sell wizard is a focused task surface with no global chrome —
    // its progress rail owns the top of the viewport.
    /^\/sell\/(new|edit|bulk)(\/|$)/.test(pathname) ||
    pathname.startsWith('/dev/sell-wizard-preview') ||
    (pathname.startsWith('/account') && !isOrderDetail) ||
    (pathname.startsWith('/seller') && !pathname.includes('/new') && !pathname.includes('/edit')) ||
    pathname.startsWith('/kyc/complete') ||
    // The signup flow itself owns its canvas (chrome-less).
    pathname.startsWith('/founding')

  if (hidden) return null

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Sell on DropMarket"
      className={`relative z-[60] w-full border-b border-white/[0.07] ${v.bg} backdrop-blur-xl backdrop-saturate-150 transition-colors duration-300`}
    >
      {/* Thin accent rail along the top edge — the "chosen" detail instead
          of a full colour wash. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${v.color}66, transparent)` }}
      />

      <div className="relative mx-auto flex min-h-[42px] max-w-[1400px] items-center justify-between gap-4 px-4 py-2 sm:px-6">
        {/* Left — status. Squared glyph badge (not a pill) + label + copy. */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span
            className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border"
            style={{ color: v.color, borderColor: `${v.color}40`, backgroundColor: `${v.color}1A` }}
          >
            <Icon className="h-[15px] w-[15px]" stroke={2} />
          </span>
          <p className="truncate text-[12.5px] leading-tight text-text-secondary sm:text-[13px]">
            <span className="font-semibold text-white">{v.lead}</span>
            <span className="hidden text-text-tertiary sm:inline"> {v.tail}</span>
          </p>
        </div>

        {/* Right — CTA. Rectangular soft-corner button, not a pill. Verb +
            scarcity beats the vague role-ask; ?src tags the funnel source. */}
        <Link
          href={v.href}
          onClick={() => track(v.event, { source: 'banner' })}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border px-3 py-[7px] text-[12px] font-semibold transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:text-[12.5px]"
          style={{ color: v.color, borderColor: `${v.color}59`, backgroundColor: `${v.color}14` }}
        >
          <span>{v.cta}</span>
          <IconArrowRight className="h-[15px] w-[15px] transition-transform group-hover:translate-x-0.5" stroke={2.2} />
        </Link>
      </div>
    </div>
  )
}
