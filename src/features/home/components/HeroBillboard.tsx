/**
 * HeroBillboard — section 1, the Dmarket-style split from the design brief
 * (`design/homepage-section-specs.md` §1).
 *
 * Layout: notched hero slab (~2/3) + sidebar rail (~1/3).
 *
 * ONE DELIBERATE DEPARTURE FROM THE BRIEF. The spec calls for flat sand /
 * lavender / mint fields carrying near-black type. We render a SATURATED
 * GRADIENT field with white type instead, because:
 *   1. The homepage surface rule (CLAUDE.md) forbids a section owning a
 *      background colour — a bright slab above a dark page is two brands.
 *   2. The seller cards already solved this exact problem and their
 *      gradients are the treatment the page validated. The hero inherits
 *      that material rather than opening a second argument.
 * Everything else from the spec is kept: the split, the notch, the
 * character cutout in the field, floating props, the price-index rail.
 *
 * This round renders SLIDE 1 ONLY, static. The 3-slide rotation is wired
 * after the surface is signed off, so the carousel is not built twice.
 */

import Image from 'next/image'
import Link from 'next/link'

import type { PriceIndexSummary } from '../lib/price-index'
import { PriceIndexCard } from './PriceIndexCard'

/** Slide 1. Teal — card 1's field, the one already contrast-checked. */
const SLIDE = {
  chip: 'Steal a Brainrot',
  headline: ['Every Roblox trade,', 'in one place'],
  sub: 'Items, accounts, Robux and top-ups. From real players.',
  gradient: 'linear-gradient(125deg, #0A4D5E 0%, #0A5F60 48%, #096D4F 100%)',
  figure: { src: '/images/steps/step-01.webp', width: 1848, height: 821 },
} as const

/**
 * Floating props. THREE, at three depths — the same rule the seller card
 * decor follows: depth is carried by size, opacity and blur together, and
 * no two share a horizontal or vertical axis.
 */
const PROPS = [
  { src: '/images/decor/coin-gold.webp', size: 92, top: '14%', left: '6%', opacity: 0.95, blur: 0, rot: '-12deg', dur: '6.5s', delay: '0s' },
  { src: '/images/decor/eth.webp', size: 66, top: '58%', left: '2%', opacity: 0.7, blur: 0.6, rot: '8deg', dur: '7.8s', delay: '-2.2s' },
  { src: '/images/decor/coin-gold-b.webp', size: 48, top: '34%', left: '30%', opacity: 0.45, blur: 1.4, rot: '18deg', dur: '9s', delay: '-4.5s' },
] as const

const CATEGORY_CHIPS = [
  { label: 'Items', href: '/roblox/buy-items' },
  { label: 'Accounts', href: '/roblox/buy-accounts' },
  { label: 'Currency', href: '/roblox/buy-robux' },
  { label: 'Top Ups', href: '/topups' },
  { label: 'Boosting', href: '/boosting' },
] as const

export function HeroBillboard({ priceIndex }: { priceIndex: PriceIndexSummary | null }) {
  return (
    // Clears the navbar, which is a transparent overlay and so takes no
    // layout space. Derived from the token, not a constant.
    <section
      className="page-measure relative z-20"
      style={{ paddingTop: 'calc(var(--navbar-height, 60px) + 32px)' }}
    >
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* ── Hero slab ─────────────────────────────────────────────── */}
        <div className="notch-slab">
          <div
            className="notch relative flex min-h-[360px] flex-col justify-center overflow-hidden px-7 py-10 sm:px-10 sm:py-12 lg:min-h-[420px]"
            style={{ background: SLIDE.gradient }}
          >
            {/* Character cutout — stands IN the field, anchored to the
                bottom-right and oversized so it exits the bottom edge
                rather than sitting inside like a sticker. */}
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 right-0 hidden w-[52%] select-none sm:block"
            >
              <Image
                src={SLIDE.figure.src}
                alt=""
                width={SLIDE.figure.width}
                height={SLIDE.figure.height}
                priority
                className="h-auto w-full object-contain object-bottom"
              />
            </div>

            {/* Floating props, behind the copy and in front of the field. */}
            {PROPS.map((p) => (
              <span
                key={p.src + p.top}
                aria-hidden
                className="hero-prop pointer-events-none absolute hidden select-none sm:block"
                style={{
                  top: p.top,
                  left: p.left,
                  width: p.size,
                  opacity: p.opacity,
                  filter: p.blur ? `blur(${p.blur}px)` : undefined,
                  ['--prop-rot' as string]: p.rot,
                  ['--prop-dur' as string]: p.dur,
                  ['--prop-delay' as string]: p.delay,
                }}
              >
                <Image src={p.src} alt="" width={p.size} height={p.size} className="h-auto w-full" />
              </span>
            ))}

            {/* Copy sits above both. */}
            <div className="relative z-10 max-w-[30ch]">
              <span className="inline-flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-white/85 backdrop-blur-sm">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/70" />
                {SLIDE.chip}
              </span>

              <h1 className="mt-4 text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-[38px] lg:text-[44px]">
                {SLIDE.headline.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </h1>

              <p className="mt-3 max-w-[40ch] text-[14px] leading-[1.55] text-white/78">
                {SLIDE.sub}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/browse"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-white px-6 text-[14px] font-semibold text-[#0B2E24] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  Browse Marketplace
                </Link>
                <Link
                  href="/sell"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-white/25 px-5 text-[14px] font-medium text-white/90 transition-colors duration-200 hover:border-white/45 hover:bg-white/10"
                >
                  Start Selling
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar rail ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <PriceIndexCard summary={priceIndex} />
        </div>
      </div>

      {/* Category chips stay from the previous hero — they are the only
          element that changes the section's silhouette and they give the
          five landing pages a direct door. */}
      <ul className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {CATEGORY_CHIPS.map((chip) => (
          <li key={chip.label}>
            <Link
              href={chip.href}
              className="inline-flex h-8 items-center rounded-full border border-white/[0.14] bg-white/[0.06] px-3.5 text-[12.5px] font-medium text-text-primary backdrop-blur-sm transition-colors hover:border-white/[0.24] hover:bg-white/[0.11]"
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
