'use client'

/**
 * How It Works — a bento grid in the homepage's "How Buying Works" language
 * (BuyerSteps glass and glossy blue Lucide icons), with a small four-segment
 * progress meter in each tile's corner instead of numerals. Shared by the currency, bundle, game hub
 * and listing detail pages.
 *
 * Owner, 2026-10-05: the curved band with four icons in a row was rejected
 * ("revamp the entire thing"); of three directions they picked the bento
 * grid, built from the homepage section rather than a new style.
 *
 *   ┌───────────────┬──────────┬──────────┐
 *   │ 1  Pick       │ 2 Pay    │ 3 Get    │
 *   │    + live     ├──────────┴──────────┤
 *   │      price    │ 4 Confirm your order│  ← SafeDrop, green
 *   └───────────────┴─────────────────────┘
 *
 * One H2 written as the search phrase. A client component only because the
 * glossy icons come from BuyerSteps (client); it still renders on the server,
 * so the tiles are in the HTML; the only motion is a CSS scroll-driven rise
 * (`.hiw-tile`, globals.css) that browsers without view timelines skip, and
 * reduced-motion turns off.
 */

import type { ReactNode } from 'react'
import { MousePointerClick, ShieldCheck, Wallet, PackageCheck, type LucideIcon } from 'lucide-react'
import { IconDefs, StepIcon } from '@/features/home/components/BuyerSteps'
import { cn } from '@/lib/utils'

export interface HowItWorksStepCopy {
  title: string
  body: string
}

/** A live number for the first tile ("Robux from" · "$0.0072 each"). */
export interface HowItWorksHighlight {
  label: string
  value: string
  /** Optional small line under the value. */
  note?: string
  /** The currency's own icon (Robux, V-Bucks), floated on the right. */
  iconUrl?: string | null
  /** Game art, blurred and dimmed behind the figure. */
  backdropUrl?: string | null
}

const DEFAULT_STEPS: HowItWorksStepCopy[] = [
  { title: 'Choose Your Item', body: 'Compare offers by price, delivery time and seller rating.' },
  { title: 'Pay at Checkout', body: 'Pay in seconds. Your order is covered from the start.' },
  { title: 'Get Your Delivery', body: 'Your seller delivers in-game. Track it in your order chat.' },
  { title: 'Confirm Your Order', body: "Got it? Confirm and you're done. Not received? You get a full refund." },
]

const ICONS: LucideIcon[] = [MousePointerClick, Wallet, PackageCheck]

/**
 * Where a step sits in the journey: four short segments in the tile's
 * corner, filled up to this step (owner, 2026-10-05: the big 1–4 numerals
 * "don't look good"). Reads as progress, not as a numbered list; the
 * step number is still announced to screen readers by each heading.
 */
function Progress({ step, tone }: { step: number; tone: 'blue' | 'green' }) {
  const on = tone === 'green' ? '#3FD986' : '#2E9BFF'
  return (
    <span aria-hidden className="absolute right-5 top-6 flex gap-1 sm:right-6">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className="h-[3px] w-4 rounded-full"
          style={{ background: n <= step ? on : 'rgba(233,237,242,0.10)', opacity: n === step ? 1 : n < step ? 0.45 : 1 }}
        />
      ))}
    </span>
  )
}

/**
 * The live figure on the first tile: the game's art blurred into a dark
 * backdrop, the price on the left, the currency's icon floating on the right.
 * Owner, 2026-10-05: a plain teal "7 Roblox Offers" box "doesn't look good";
 * wanted the Robux icon. 2026-10-06: drop the backdrop box (card in card).
 */
function Highlight({ label, value, note, iconUrl }: HowItWorksHighlight) {
  // No box of its own (owner, 2026-10-06: no card in card): the figure on the
  // left, the currency icon floating on the right, straight on the tile.
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-text-secondary">{label}</p>
        <p className="mt-0.5 text-[30px] font-bold leading-tight tracking-[-0.02em] tabular-nums text-text-primary">{value}</p>
        {note && <p className="mt-1 text-[12.5px] text-text-tertiary">{note}</p>}
      </div>
      {iconUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded currency icon
        <img
          src={iconUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="hiw-coin h-16 w-16 shrink-0 object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.5)] sm:h-[76px] sm:w-[76px]"
        />
      )}
    </div>
  )
}

function Tile({ className, children }: { className?: string; children: ReactNode }) {
  return <li className={cn('hiw-tile relative isolate overflow-hidden rounded-xl p-5 sm:p-6', className)}>{children}</li>
}

export default function HowItWorksBand({
  title = 'How to Buy on DropMarket',
  sub,
  steps = DEFAULT_STEPS,
  highlight,
}: {
  /** The section's H2: write it as the search phrase. */
  title?: string
  /** Optional one-line subtitle. */
  sub?: string
  /** Copy per surface: exactly four entries (the fourth is the SafeDrop tile). */
  steps?: HowItWorksStepCopy[]
  /** A live figure shown on the first tile (e.g. the cheapest price). */
  highlight?: HowItWorksHighlight | null
}) {
  const [s1, s2, s3, s4] = steps.length === 4 ? steps : DEFAULT_STEPS

  return (
    <section aria-labelledby="how-it-works-title" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <header className="text-center">
        <h2 id="how-it-works-title" className="section-title">
          {title}
        </h2>
        {sub && <p className="mt-2.5 text-[15px] leading-[1.5] text-text-secondary">{sub}</p>}
      </header>

      <IconDefs />
      <ol className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[auto_auto]">
        {/* 1 — the big tile: what to pick, and the live price to start from. */}
        <Tile className="flex flex-col sm:col-span-2 lg:col-span-1 lg:row-span-2">
          <Progress step={1} tone="blue" />
          <span aria-hidden className="block h-12 w-12">
            <StepIcon Icon={ICONS[0]} />
          </span>
          <h3 className="mt-6 text-[20px] font-semibold leading-tight text-text-primary">
            <span className="sr-only">Step 1: </span>
            {s1.title}
          </h3>
          <p className="mt-2 max-w-[34ch] text-[14px] leading-6 text-text-secondary">{s1.body}</p>
          {highlight && (
            <div className="mt-auto pt-8">
              <Highlight {...highlight} />
            </div>
          )}
        </Tile>

        {/* 2 and 3 — compact. */}
        {[s2, s3].map((s, i) => (
          <Tile key={s.title}>
            <Progress step={i + 2} tone="blue" />
            <span aria-hidden className="block h-10 w-10">
              <StepIcon Icon={ICONS[i + 1]} />
            </span>
            <h3 className="mt-4 text-[16px] font-semibold leading-snug text-text-primary">
              <span className="sr-only">Step {i + 2}: </span>
              {s.title}
            </h3>
            <p className="mt-1.5 max-w-[30ch] text-[13px] leading-5 text-text-secondary">{s.body}</p>
          </Tile>
        ))}

        {/* 4 — the promise, wide and green. */}
        <Tile className="hiw-tile--safe flex items-center max-sm:pt-12 sm:col-span-2">
          <Progress step={4} tone="green" />
          <div className="flex w-full items-center gap-4">
            <span
              aria-hidden
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[rgba(63,217,134,0.14)] text-[#3FD986]"
            >
              <ShieldCheck size={22} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold leading-snug text-text-primary">
                <span className="sr-only">Step 4: </span>
                {s4.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-5 text-text-secondary">{s4.body}</p>
            </div>
          </div>
        </Tile>
      </ol>
    </section>
  )
}
