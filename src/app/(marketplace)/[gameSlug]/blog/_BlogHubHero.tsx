/**
 * Blog hub hero — headline + lead + CTAs on the left, a live "Market Snapshot"
 * card on the right built from the real hub stats (most popular pet, highest
 * value, biggest mover). No invented data: it renders exactly the HubStat rows
 * the page already computes, and falls back to the plain centred hero when there
 * are no stats. Rows fade in with a small stagger (reduced-motion safe).
 *
 * Shared by every game's blog hub; the copy is composed from the game name.
 */

import Link from 'next/link'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { HubHero } from '@/components/content/HubHero'
import { HUB_NAV_CLEAR } from '@/components/content/hubNavGeometry'
import type { HubStat, HubTeaserItem } from './_hubData'
import { MarketSnapshotBento } from './_MarketSnapshotBento'

export function BlogHubHero({
  gameName,
  gameSlug,
  title,
  lead,
  stats = [],
  pets = [],
  hasCalculator = false,
}: {
  gameName: string
  gameSlug: string
  title?: string
  lead: string
  /** Real hub stats — the same rows the compact strip used. */
  stats?: HubStat[]
  /** Top priced pets (with images) for the hero's live-market collage. */
  pets?: HubTeaserItem[]
  /** Whether this game has a WFL calculator (second CTA). */
  hasCalculator?: boolean
}) {
  const heading = title ?? `${gameName} Guides & Values`

  // No stats → keep the original centred hero (graceful for new games).
  if (stats.length === 0) {
    return (
      <section>
        <HubHero title={heading} lead={lead} />
      </section>
    )
  }

  return (
    <section className={`mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bhh-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .bhh-anim { animation: bhh-in 520ms cubic-bezier(0.16,1,0.3,1) both; }
        @media (prefers-reduced-motion: reduce) { .bhh-anim { animation: none; } }
      `,
        }}
      />
      <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        {/* Left — copy + CTAs */}
        <div className="bhh-anim">
          <span className="inline-flex items-center gap-2 text-caption font-bold uppercase tracking-[0.14em] text-[#CFE0D6]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3FA96A] opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#4FB477]" />
            </span>
            Live Prices · Refreshed Daily
          </span>
          <h1 className="mt-4 text-balance text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[#F6FAF4] sm:text-[46px]">
            {heading}
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-body leading-7 text-[#B8C4BC] sm:text-body-lg">
            {lead}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/${gameSlug}/values`}
              className="inline-flex items-center gap-2 rounded-md bg-[#1B6B3F] px-5 py-3 text-body-sm font-bold text-white transition hover:bg-[#1f7a48]"
            >
              Value List
              <ArrowForwardIcon sx={{ fontSize: 18 }} />
            </Link>
            {hasCalculator && (
              <Link
                href={`/${gameSlug}/calculator`}
                className="inline-flex items-center gap-2 rounded-md border border-[#2C3A31] bg-white/[0.03] px-5 py-3 text-body-sm font-semibold text-[#E6EAE7] transition hover:border-[#3A4A40] hover:bg-white/[0.06]"
              >
                WFL Calculator
              </Link>
            )}
          </div>
        </div>

        {/* Right — live-market collage: a mosaic of the top priced pets over a
            dimmed pet-art backdrop, plus the highest-value + trending stats
            (see MarketSnapshotBento). */}
        <MarketSnapshotBento
          stats={stats}
          pets={pets}
          valuesHref={`/${gameSlug}/values`}
        />
      </div>
    </section>
  )
}
