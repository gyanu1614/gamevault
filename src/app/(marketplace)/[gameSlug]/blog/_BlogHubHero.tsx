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
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { HubHero } from '@/components/content/HubHero'
import { HUB_NAV_CLEAR } from '@/components/content/hubNavGeometry'
import type { HubStat, HubTeaserItem } from './_hubData'
import { MarketSnapshotBento } from './_MarketSnapshotBento'
import { VALUE_BTN_PRIMARY, VALUE_BTN_SECONDARY } from '@/components/values/styles'

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
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#4FB477]" />
            Live Prices · Refreshed Daily
          </span>
          <h1 className="mt-4 text-balance text-[32px] font-bold leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[42px]">
            {heading}
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-body leading-7 text-text-secondary sm:text-body-lg">
            {lead}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/${gameSlug}/values`}
              className={VALUE_BTN_PRIMARY}
            >
              Value List
              <ArrowRightIcon size={16} weight="bold" aria-hidden />
            </Link>
            {hasCalculator && (
              <Link
                href={`/${gameSlug}/calculator`}
                className={VALUE_BTN_SECONDARY}
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
