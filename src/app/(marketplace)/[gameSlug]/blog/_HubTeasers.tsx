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
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8FBF9C]">
              Live Values
            </span>
          </span>
          <Link
            href={`/${gameSlug}/values`}
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#D7DED4] transition-colors hover:text-[#F1F3F1]"
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
                <span className="truncate text-[13px] font-semibold text-[#E4EAE2]">
                  {item.name}
                </span>
                <span className="truncate font-mono text-[10px] text-[#5E685E]">
                  {item.qualifier}
                </span>
              </span>
              {/* Price in its own right column so a long qualifier never
                  squeezes it — the design keeps these two separate. */}
              <span className="shrink-0 font-mono text-[14px] font-bold tabular-nums text-[#8FBF9C]">
                {item.priceLabel}
              </span>
            </Link>
          ))}
        </div>

        {/* Footnote — the qualifier the design (and our data rules) require */}
        <div className="border-t border-[#1A211A] bg-[#0A0D0B] px-4 py-3.5 sm:px-5">
          <p className="font-mono text-[11px] leading-relaxed text-[#5E685E]">
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

export function CalculatorTeaser({
  gameSlug,
  example,
}: {
  gameSlug: string
  example: CalcExample
}) {
  return (
    <section className="pt-12 sm:pt-16">
      <div className="grid gap-px overflow-hidden border border-[#1A211A] bg-[#1A211A] lg:grid-cols-[1fr_1fr]">
        {/* Copy side */}
        <div className="bg-[#0B0F0C] p-5 sm:p-8">
          <div className="mb-3 flex items-center gap-2.5 sm:mb-4">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8FBF9C]">
              Trade Calculator
            </span>
          </div>
          <h3 className="mb-2.5 text-[20px] font-semibold leading-snug tracking-tight text-[#F1F3F1] sm:mb-3 sm:text-[24px]">
            {example.title}
          </h3>
          {/* Clamped on mobile — the full pitch is a scroll cost on a teaser. */}
          <p className="mb-5 line-clamp-2 max-w-md text-sm leading-relaxed text-[#98A398] sm:mb-6 sm:line-clamp-none">
            {example.body}
          </p>
          <Link
            href={`/${gameSlug}/calculator`}
            className="inline-flex items-center gap-1.5 bg-[#1B6B3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f7a48]"
          >
            Open the calculator
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Worked example side — tighter rows on mobile. */}
        <div className="flex flex-col gap-1.5 bg-[#0A0D0B] p-5 sm:gap-2 sm:p-8">
          <div className="flex items-center justify-between gap-3 border border-[#1A211A] bg-[#0B0F0C] px-3.5 py-2.5 sm:px-4 sm:py-3.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#5E685E]">
              They offer
            </span>
            <span className="truncate font-mono text-[12px] font-semibold text-[#D7DED4] sm:text-[13px]">
              {example.offer}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border border-[#1A211A] bg-[#0B0F0C] px-3.5 py-2.5 sm:px-4 sm:py-3.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#5E685E]">
              You give
            </span>
            <span className="truncate font-mono text-[12px] font-semibold text-[#D7DED4] sm:text-[13px]">
              {example.give}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 border border-[#23331F] bg-[#0D140E] p-3.5 sm:mt-2 sm:p-4">
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center border border-[#4FB477] font-mono text-[15px] font-bold text-[#8FBF9C]">
                {example.letter}
              </span>
              <span className="text-[13px] font-semibold text-[#E4EAE2]">
                {example.verdict}
              </span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#5E685E]">
              {example.qualifier}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* Buy CTA moved to the shared @/components/content/HubBuyCta (per-game bg hero
   + used at the end of every hub page). */
