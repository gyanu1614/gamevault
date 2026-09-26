'use client'

/**
 * BuyerSteps — how a buyer purchases, as four numbered steps.
 *
 * Sets no padding, margin, max-width or overflow beyond `.page-measure`:
 * it opts into the page measure and lets the rhythm container own the
 * spacing around it, per the section authoring contract in CLAUDE.md.
 *
 * The numeral is the ground layer, not decoration: it sits BEHIND the card,
 * offset up and left, and fades toward its own bottom via a mask rather than
 * a flat opacity — an evenly dimmed glyph reads as a watermark, a masked one
 * reads as carved out of the page. The card above it is genuinely
 * translucent, so the numeral shows through, dimmed.
 *
 * COPY RULE (see the no-escrow memory): steps describe the ORDER's state,
 * never when money moves between buyer, us and seller. "Confirm and the
 * order is complete" — NOT "the seller gets paid", which is both factually
 * wrong under the agent model (the buyer's debt to the seller is discharged
 * on receipt, not on confirmation) and the banned hold-till-delivery
 * framing.
 */

import {
  BadgeCheck,
  Wallet,
  PackageCheck,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

interface Step {
  num: string
  title: string
  /** Shown under the title only when the section is given `subs`. The
      homepage renders title-only cards; category pages add one short line. */
  sub: string
  icon: ReactNode
}

/**
 * Lucide outline icons with a glossy treatment.
 *
 * Boldness here comes from LIGHT, not weight: a vertical gradient on the
 * stroke (bright at the top, deeper at the bottom, as if lit from above)
 * plus a soft coloured glow beneath. Thickening the stroke was the wrong
 * lever — three earlier passes went heavier and each read as fat rather
 * than premium.
 *
 * The gradient is applied by painting the icon's stroke with a `url(#...)`
 * reference; Lucide draws with `currentColor`, so the SVG is wrapped and
 * the gradient injected via CSS custom properties on a shared <defs>.
 */
const GRAD_ID = 'buyer-step-gloss'

function StepIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span
      className="buyer-step__glyph relative block h-full w-full"
      style={{ color: '#2E9BFF' }}
    >
      {/* No `absoluteStrokeWidth`: it divides by a numeric size, and with
          size="100%" that yields NaN and drops the stroke width entirely.
          1.9 against Lucide's 24-unit viewBox is the intended weight. */}
      <Icon size="100%" strokeWidth={1.9} aria-hidden />
    </span>
  )
}

/** One shared gradient + glow filter for every icon on the section. */
function IconDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <linearGradient id={GRAD_ID} x1="0" y1="0" x2="0" y2="1">
          {/* Lit top edge -> deeper base, the same light direction the
              cards and numerals use. */}
          <stop offset="0%" stopColor="#7CC4FF" />
          <stop offset="45%" stopColor="#2E9BFF" />
          <stop offset="100%" stopColor="#0B6FD4" />
        </linearGradient>
        <filter id={`${GRAD_ID}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="1.5"
            stdDeviation="2.5"
            floodColor="#1080F0"
            floodOpacity="0.55"
          />
        </filter>
      </defs>
    </svg>
  )
}

const STEPS: Step[] = [
  {
    num: '1',
    title: 'Pay for Item',
    sub: 'Checkout in seconds. Covered by SafeDrop from the first second.',
    icon: <StepIcon Icon={Wallet} />,
  },
  {
    num: '2',
    title: 'Seller Delivers',
    sub: 'Get your item in-game or by code.',
    icon: <StepIcon Icon={PackageCheck} />,
  },
  {
    num: '3',
    title: 'Confirm Order',
    sub: 'Happy with it? Confirm and the order is complete.',
    icon: <StepIcon Icon={BadgeCheck} />,
  },
  {
    num: '4',
    title: 'Order Complete',
    sub: 'Item not received or not as described? Get your money back.',
    icon: <StepIcon Icon={ShieldCheck} />,
  },
]

function StepCard({ step, index, sub }: { step: Step; index: number; sub?: string }) {
  return (
    // Plain <li>, no framer entrance. The cards previously animated in on
    // scroll via `whileInView`, which left them at opacity 0 until an
    // IntersectionObserver fired — so scrolling down showed the numerals
    // with empty space beside them. A JS-driven `animate` on mount did not
    // fix it either: the section sits ~2200px down the page and its
    // hydration is deferred, so the cards stayed invisible until late.
    // The card is now painted by the server with no entrance animation at
    // all; the ambient rim light (CSS) supplies the motion.
    <li
      // `block`, not `flex`: as a flex parent with items-end the card shrank
      // to its content width (46px). The card is the only in-flow child and
      // already spans 100%, so the li needs no flex context at all.
      className="buyer-step relative block min-w-0"
    >
      {/* Ground layer. aria-hidden: the step's position is already conveyed
          by the ordered list, so the numeral is pure decoration. */}
      <span aria-hidden className="buyer-step__num">
        {step.num}
      </span>

      {/* Always-on, not hover: the card is not clickable, so ambient life
          suits it better than a reward for pointing at it. Each card's
          rim travels one card at a time: each runs the same 12.8s cycle
          offset by 2.7s, and the light is fully out before the next begins. */}
      <div className="buyer-step__card" style={{ '--step-delay': `${index * 2.7}s` } as CSSProperties}>
        <span aria-hidden className="buyer-step__sheen" />
        <span aria-hidden className="buyer-step__icon">
          {step.icon}
        </span>
        <p className="buyer-step__title">{step.title}</p>
        {sub && <p className="buyer-step__sub">{sub}</p>}
      </div>
    </li>
  )
}

/**
 * Used on the homepage (defaults: "How Buying Works", title-only cards) and
 * at the bottom of every marketplace category page, where it takes a
 * game-specific title and one short line under each step.
 */
export function BuyerSteps({
  title = 'How Buying Works',
  subtitle = 'Every order is covered by SafeDrop Protection',
  subs,
}: {
  title?: string
  /** Line under the title. Pass `null` to show no line at all. */
  subtitle?: string | null
  /** One short line per step, in step order. Omit for title-only cards. */
  subs?: [string, string, string, string]
} = {}) {
  return (
    <section className="page-measure">
      <header className="text-center">
        <h2 className="section-title">{title}</h2>
        {subtitle && (
          <p className="mt-2.5 text-[15px] leading-[1.5] text-text-secondary">{subtitle}</p>
        )}
      </header>

      <IconDefs />
      <ol className="mt-12 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <StepCard key={s.num} step={s} index={i} sub={subs?.[i]} />
        ))}
      </ol>
    </section>
  )
}
