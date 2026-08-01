/**
 * Interlink sections for the blog hub: a live-values strip, a calculator
 * worked-example, and the single buy CTA. All in the Values forest palette;
 * only the layouts come from the content design.
 *
 * Each teaser self-hides when it has nothing real to show — the values strip
 * needs priced items, so a game with no catalog simply omits it rather than
 * printing an empty box.
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { HubTeaserItem } from './_hubData'

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
      <div className="border border-[#1A211A] bg-[#0B0F0C]">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1A211A] bg-[#0E130F] px-4 py-4 sm:px-5">
          <span className="flex items-center gap-2.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#4FB477]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8FBF9C]">
              Live Values
            </span>
          </span>
          <Link
            href={`/${gameSlug}/values`}
            className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#D7DED4] transition-colors hover:text-[#F1F3F1]"
          >
            See all values →
          </Link>
        </div>

        {/* Items — mobile rail, desktop 4-up hairline grid */}
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-3 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:gap-px sm:overflow-visible sm:bg-[#1A211A] sm:p-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <Link
              key={item.slug}
              href={`/${gameSlug}/values/${item.slug}`}
              className="flex w-[270px] shrink-0 snap-start items-center gap-3 border border-[#1A211A] bg-[#0B0F0C] p-4 transition-colors hover:bg-[#101710] sm:w-auto sm:min-w-0 sm:border-0"
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote item art
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-11 w-11 shrink-0 border border-[#1A211A] bg-[#0E140F] object-contain"
                />
              ) : (
                <span className="h-11 w-11 shrink-0 border border-[#23291F] bg-[#0E140F]" />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-[#E4EAE2]">
                    {item.name}
                  </span>
                  {item.variant && (
                    <span className="shrink-0 border border-[#26332C] bg-white/[0.04] px-1 py-px font-mono text-[10px] font-semibold text-[#8FBF9C]">
                      {item.variant}
                    </span>
                  )}
                </span>
                <span className="truncate text-[11px] text-[#7C8A80]">
                  {item.qualifier}
                </span>
              </span>
              {/* Price + 7-day change in a right column so a long qualifier
                  never squeezes it. Change is coloured (green up / red down)
                  and only appears where we hold history. */}
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="font-mono text-[14px] font-bold tabular-nums text-[#8FBF9C]">
                  {item.priceLabel}
                </span>
                {item.changePct != null && (
                  <span
                    className={`font-mono text-[11px] font-semibold tabular-nums ${
                      item.changePct >= 0 ? 'text-[#5BC77E]' : 'text-[#E0736B]'
                    }`}
                  >
                    {item.changePct >= 0 ? '▲' : '▼'}{' '}
                    {Math.abs(item.changePct).toFixed(0)}%
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>

        {/* Footnote — the qualifier the design (and our data rules) require.
            Figtree (text), not mono — mono is reserved for numbers/prices. */}
        <div className="border-t border-[#1A211A] bg-[#0A0D0B] px-4 py-3.5 sm:px-5">
          <p className="text-[12px] leading-relaxed text-[#7C8A80]">
            {footnote}
          </p>
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

const VERDICT_STYLE: Record<
  CalcRealExample['verdict'],
  { fg: string; border: string; bg: string; label: string }
> = {
  WIN: { fg: '#6FE39A', border: '#2C6B44', bg: '#0E1B12', label: 'You gain value' },
  FAIR: { fg: '#8FBF9C', border: '#2A3A31', bg: '#0E140F', label: 'Balanced trade' },
  LOSE: { fg: '#E0736B', border: '#5A2E2B', bg: '#1A0F0E', label: 'You lose value' },
}

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
    <div className="flex flex-1 flex-col items-center gap-2.5 border border-[#1E2723] bg-[#0C110D] p-4 text-center">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7C8A80]">
        {side}
      </span>
      {pet.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote pet art
        <img
          src={pet.imageUrl}
          alt=""
          className="h-16 w-16 shrink-0 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
        />
      ) : (
        <span className="h-16 w-16 shrink-0 border border-[#22302A] bg-[#0E140F]" />
      )}
      <span className="text-[14px] font-bold leading-tight text-[#F2F6F0]">
        {pet.name}
      </span>
      <span className="font-mono text-[14px] font-bold text-[#8FBF9C]">
        {usdFmt.format(pet.usd)}
      </span>
    </div>
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
      <div className="grid gap-px overflow-hidden border border-[#1A211A] bg-[#1A211A] lg:grid-cols-[1fr_1fr]">
        {/* Copy side — all Figtree, white, readable. */}
        <div className="bg-[#0B0F0C] p-5 sm:p-8">
          <div className="mb-3 flex items-center gap-2.5 sm:mb-4">
            <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#8FBF9C]">
              Trade Calculator
            </span>
          </div>
          <h3 className="mb-2.5 text-[20px] font-semibold leading-snug tracking-tight text-[#F1F3F1] sm:mb-3 sm:text-[24px]">
            {example.title}
          </h3>
          <p className="mb-5 line-clamp-2 max-w-md text-[15px] leading-relaxed text-[#B4BEB6] sm:mb-6 sm:line-clamp-none">
            {example.body}
          </p>
          <Link
            href={`/${gameSlug}/calculator`}
            className="group inline-flex items-center gap-1.5 bg-[#1B6B3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f7a48]"
          >
            Open the calculator
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Visual side — real pet-icon mini-trade with a moving arrow, or the
            text fallback for games without priced pets yet. */}
        <div className="flex flex-col justify-center bg-[#0A0D0B] p-5 sm:p-8">
          {realExample ? (
            <>
              {/* Two pets with an animated arrow between them. */}
              <div className="flex items-stretch gap-2 sm:gap-3">
                <TradePet side="You give" pet={realExample.give} />
                <div className="flex shrink-0 items-center">
                  <ArrowRight className="h-6 w-6 animate-arrow-nudge text-[#4FB477] motion-reduce:animate-none" />
                </div>
                <TradePet side="They offer" pet={realExample.offer} />
              </div>
              {/* Verdict bar. */}
              {(() => {
                const s = VERDICT_STYLE[realExample.verdict]
                const sign = realExample.deltaUsd >= 0 ? '+' : '−'
                return (
                  <div
                    className="mt-2 flex items-center justify-between gap-3 border p-3.5 sm:mt-3 sm:p-4"
                    style={{ borderColor: s.border, backgroundColor: s.bg }}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 items-center justify-center border text-[15px] font-bold"
                        style={{ borderColor: s.fg, color: s.fg }}
                      >
                        {realExample.verdict[0]}
                      </span>
                      <span className="text-[14px] font-bold" style={{ color: s.fg }}>
                        {realExample.verdict}
                      </span>
                      <span className="text-[13px] text-[#98A69C]">{s.label}</span>
                    </span>
                    <span className="font-mono text-[14px] font-bold" style={{ color: s.fg }}>
                      {sign}
                      {usdFmt.format(Math.abs(realExample.deltaUsd))}
                    </span>
                  </div>
                )
              })()}
            </>
          ) : (
            // Text fallback (games with no priced pets yet) — now white + Figtree.
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 border border-[#1E2723] bg-[#0C110D] px-4 py-3.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7C8A80]">
                  They offer
                </span>
                <span className="truncate text-[14px] font-bold text-[#F2F6F0]">
                  {example.offer}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border border-[#1E2723] bg-[#0C110D] px-4 py-3.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7C8A80]">
                  You give
                </span>
                <span className="truncate text-[14px] font-bold text-[#F2F6F0]">
                  {example.give}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 border border-[#23331F] bg-[#0D140E] p-4">
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center border border-[#4FB477] text-[15px] font-bold text-[#8FBF9C]">
                    {example.letter}
                  </span>
                  <span className="text-[14px] font-bold text-[#F2F6F0]">
                    {example.verdict}
                  </span>
                </span>
                <span className="text-[12px] uppercase tracking-[0.06em] text-[#7C8A80]">
                  {example.qualifier}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/* Buy CTA moved to the shared @/components/content/HubBuyCta (per-game bg hero
   + used at the end of every hub page). */
