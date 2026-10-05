/**
 * Interlink sections for the blog hub: a live-values strip and a calculator
 * worked-example, on the card-surface system (one raised card each, flat
 * tiles inside, hairlines only between rows).
 *
 * Each teaser self-hides when it has nothing real to show — the values strip
 * needs priced items, so a game with no catalog simply omits it rather than
 * printing an empty box.
 */

import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import type { HubTeaserItem } from './_hubData'
import ValuesMarquee from './_ValuesMarquee'
import { ValueArt } from '@/components/values/ValueArt'
import {
  VALUE_BTN_PRIMARY,
  VALUE_LABEL,
  VALUE_SURFACE,
  VALUE_TILE,
} from '@/components/values/styles'

/* ─────────────────────────── Values teaser ─────────────────────────── */

export function ValuesTeaser({
  gameSlug,
  items,
  footnote,
}: {
  gameSlug: string
  items: HubTeaserItem[]
  footnote: string
}) {
  if (items.length === 0) return null

  return (
    <section className="pt-12 sm:pt-16">
      <div className={`overflow-hidden ${VALUE_SURFACE}`}>
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5">
          <span className="flex items-center gap-2.5">
            <span aria-hidden className="h-2 w-2 rounded-full bg-[#4FB477]" />
            <span className="text-[14px] font-semibold text-text-primary">Live Values</span>
          </span>
          <Link
            href={`/${gameSlug}/values`}
            className="group inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            See All Values
            <ArrowRightIcon
              size={14}
              weight="bold"
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        </div>

        {/* Items — a continuous auto-scrolling marquee (like the Founding HQ
            strip): glides seam-free, pauses on hover, static for reduced motion. */}
        <ValuesMarquee items={items} gameSlug={gameSlug} />

        {/* Footnote — the qualifier the design (and our data rules) require. */}
        <div className="border-t border-white/[0.07] px-4 py-3.5 sm:px-5">
          <p className="text-[12px] leading-relaxed text-text-tertiary">{footnote}</p>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── Calculator teaser ─────────────────────────── */

export interface CalcExample {
  title: string
  body: string
  offer: string
  give: string
  letter: string
  verdict: string
  qualifier: string
}

/** Real two-pet example (with images + a computed verdict) for the visual
 *  side. When present it drives an icon-based mini-trade; otherwise the teaser
 *  falls back to the text example. Shape mirrors HubCalcExample. */
export interface CalcRealExample {
  give: { name: string; imageUrl: string | null; usd: number }
  offer: { name: string; imageUrl: string | null; usd: number }
  verdict: 'WIN' | 'FAIR' | 'LOSE'
  deltaUsd: number
}

const VERDICT_STYLE: Record<CalcRealExample['verdict'], { fg: string; label: string }> = {
  WIN: { fg: '#6FE39A', label: 'You gain value' },
  FAIR: { fg: '#C9CDD6', label: 'Balanced trade' },
  LOSE: { fg: '#E0736B', label: 'You lose value' },
}

/** A verdict colour as a soft fill (no outlines on the card-surface system). */
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`

const usdFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

/** One side of the mini-trade: pet icon + name + cash value. */
function TradePet({
  side,
  pet,
}: {
  side: string
  pet: CalcRealExample['give']
}) {
  return (
    <div className={`flex flex-1 flex-col items-center gap-2.5 p-4 text-center ${VALUE_TILE}`}>
      <span className={VALUE_LABEL}>{side}</span>
      <ValueArt src={pet.imageUrl} alt="" size={64} className="shrink-0" />
      <span className="text-[14px] font-semibold leading-tight text-text-primary">
        {pet.name}
      </span>
      <span className="text-[14px] font-semibold tabular-nums text-text-primary">
        {usdFmt.format(pet.usd)}
      </span>
    </div>
  )
}

/** Verdict letter badge (W / F / L) on a soft fill. */
function VerdictLetter({ letter, color }: { letter: string; color: string }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[15px] font-bold"
      style={{ backgroundColor: tint(color, 18), color }}
    >
      {letter}
    </span>
  )
}

export function CalculatorTeaser({
  gameSlug,
  example,
  realExample,
}: {
  gameSlug: string
  example: CalcExample
  realExample?: CalcRealExample | null
}) {
  return (
    <section className="pt-12 sm:pt-16">
      <div
        className={`grid divide-y divide-white/[0.07] overflow-hidden lg:grid-cols-[1fr_1fr] lg:divide-x lg:divide-y-0 ${VALUE_SURFACE}`}
      >
        {/* Copy side */}
        <div className="p-5 sm:p-8">
          <p className="mb-3 text-[13px] font-medium text-text-tertiary sm:mb-4">Trade Calculator</p>
          <h3 className="mb-2.5 text-[20px] font-semibold leading-snug tracking-tight text-text-primary sm:mb-3 sm:text-[24px]">
            {example.title}
          </h3>
          <p className="mb-5 line-clamp-2 max-w-md text-[15px] leading-relaxed text-text-secondary sm:mb-6 sm:line-clamp-none">
            {example.body}
          </p>
          <Link href={`/${gameSlug}/calculator`} className={`group ${VALUE_BTN_PRIMARY}`}>
            Open the Calculator
            <ArrowRightIcon
              size={16}
              weight="bold"
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        </div>

        {/* Visual side — real pet-icon mini-trade with a moving arrow, or the
            text fallback for games without priced pets yet. */}
        <div className="flex flex-col justify-center p-5 sm:p-8">
          {realExample ? (
            <>
              {/* Two pets with an animated arrow between them. */}
              <div className="flex items-stretch gap-2 sm:gap-3">
                <TradePet side="You give" pet={realExample.give} />
                <div className="flex shrink-0 items-center">
                  <ArrowRightIcon
                    size={24}
                    weight="bold"
                    aria-hidden
                    className="animate-arrow-nudge text-text-tertiary motion-reduce:animate-none"
                  />
                </div>
                <TradePet side="They offer" pet={realExample.offer} />
              </div>
              {/* Verdict bar. */}
              {(() => {
                const s = VERDICT_STYLE[realExample.verdict]
                const sign = realExample.deltaUsd >= 0 ? '+' : '−'
                return (
                  <div
                    className="mt-2 flex items-center justify-between gap-3 rounded-md p-3.5 sm:mt-3 sm:p-4"
                    style={{ backgroundColor: tint(s.fg, 9) }}
                  >
                    <span className="flex items-center gap-3">
                      <VerdictLetter letter={realExample.verdict[0]} color={s.fg} />
                      <span className="text-[14px] font-bold" style={{ color: s.fg }}>
                        {realExample.verdict}
                      </span>
                      <span className="text-[13px] text-text-secondary">{s.label}</span>
                    </span>
                    <span className="text-[14px] font-semibold tabular-nums" style={{ color: s.fg }}>
                      {sign}
                      {usdFmt.format(Math.abs(realExample.deltaUsd))}
                    </span>
                  </div>
                )
              })()}
            </>
          ) : (
            // Text fallback (games with no priced pets yet).
            <div className="flex flex-col gap-2">
              <div className={`flex items-center justify-between gap-3 px-4 py-3.5 ${VALUE_TILE}`}>
                <span className={VALUE_LABEL}>They offer</span>
                <span className="truncate text-[14px] font-semibold text-text-primary">
                  {example.offer}
                </span>
              </div>
              <div className={`flex items-center justify-between gap-3 px-4 py-3.5 ${VALUE_TILE}`}>
                <span className={VALUE_LABEL}>You give</span>
                <span className="truncate text-[14px] font-semibold text-text-primary">
                  {example.give}
                </span>
              </div>
              <div
                className="mt-1 flex items-center justify-between gap-3 rounded-md p-4"
                style={{ backgroundColor: tint('#6FE39A', 8) }}
              >
                <span className="flex items-center gap-3">
                  <VerdictLetter letter={example.letter} color="#6FE39A" />
                  <span className="text-[14px] font-semibold text-text-primary">
                    {example.verdict}
                  </span>
                </span>
                <span className="text-[12px] text-text-tertiary">{example.qualifier}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
