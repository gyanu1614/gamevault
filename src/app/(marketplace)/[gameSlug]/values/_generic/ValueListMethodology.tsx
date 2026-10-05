import { Suspense } from 'react'
import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { HubSection } from '@/components/values/HubSection'
import { HUB_GROUND, VALUE_BTN_SECONDARY, VALUE_LABEL, VALUE_SURFACE } from '@/components/values/styles'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { FaqCards } from '@/components/marketplace/FaqCards'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { getGameContentTheme } from '@/lib/content/theme'
import { getValuesFreshness } from '@/lib/values/data'
import { DEFAULT_PRICE_CHANGE_RULE } from '@/lib/pricing/change-rule'
import {
  REPUTABLE_MIN_REVIEWS,
  REPUTABLE_MIN_REVIEWS_HIGH,
  REPUTABLE_MIN_REVIEWS_MID,
  REPUTABLE_TIER_HIGH_USD,
  REPUTABLE_TIER_MID_USD,
} from '@/lib/sab/reputable-pricing'
import { valueListHub } from '@/lib/values/hub-config'
import { Block } from '../../[categorySlug]/_ItemsSkeleton'

/**
 * Methodology for a value-list hub (Murder Mystery 2 first) — Adopt Me's
 * "reference / database" template: left-aligned header in a 3xl column,
 * titled section cards, FAQ cards, back link.
 *
 * Every number in the copy comes from the code that enforces it (review bars,
 * change threshold), so the page cannot drift from the pipeline. It says what
 * we do NOT do as plainly as what we do: no community value points, asking
 * prices not completed sales, one marketplace.
 */

/** "A, B and C". */
const listPhrase = (words: readonly string[]) =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`

const pct = Math.round(DEFAULT_PRICE_CHANGE_RULE.minRelative * 100)
const cents = Math.round(DEFAULT_PRICE_CHANGE_RULE.minAbsoluteUsd * 100)

function methodologyFaq(gameName: string, shortName: string): { q: string; a: string }[] {
  return [
    {
      q: `Do you use ${shortName} value points?`,
      a: `No. Community value lists rate items in points set by hand, and points only compare items with each other. Every number on DropMarket is a price in US dollars measured from live listings — what an item actually sells for.`,
    },
    {
      q: `Which sellers count towards a ${gameName} value?`,
      a: `Only established sellers: ${REPUTABLE_MIN_REVIEWS}+ reviews for items under $${REPUTABLE_TIER_MID_USD}, ${REPUTABLE_MIN_REVIEWS_MID}+ for items from $${REPUTABLE_TIER_MID_USD} to $${REPUTABLE_TIER_HIGH_USD}, and ${REPUTABLE_MIN_REVIEWS_HIGH.toLocaleString('en-US')}+ above $${REPUTABLE_TIER_HIGH_USD} when enough of them list the item. An item needs at least three such listings before we publish a value.`,
    },
    {
      q: 'What is the difference between Cheapest and Market?',
      a: 'Cheapest is the lowest price a reputable seller is asking that has other listings close above it — what a buyer can actually pay today. Market is the typical price: the middle of the cheapest handful of reputable listings.',
    },
    {
      q: 'How often do values change?',
      a: `We re-price every item every day. A value only moves on the site when it shifts by more than ${pct}% or ${cents} cents (whichever is larger) against the last published value, so pages follow real moves rather than daily noise.`,
    },
    {
      q: 'Why do some items have no price?',
      a: 'Because fewer than three reputable listings back them. We would rather show a gap than a number we cannot stand behind; the item gets a price as soon as the evidence is there.',
    },
  ]
}

export default async function ValueListMethodology({ gameSlug }: { gameSlug: string }) {
  const theme = getGameContentTheme(gameSlug)
  const hub = valueListHub(gameSlug)!
  const hubNav = await getHubNavData(gameSlug)
  const faq = methodologyFaq(theme.name, hub.shortName)

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: theme.name, path: `/${gameSlug}` },
          { name: 'Values', path: `/${gameSlug}/values` },
          { name: 'Methodology', path: `/${gameSlug}/values/methodology` },
        ])}
      />
      <JsonLd data={faqPage(faq)} />

      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />

        <div className={`mx-auto w-full max-w-3xl px-4 pb-8 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-[12.5px] text-text-tertiary">
            <Link href={`/${gameSlug}/values`} className="transition-colors hover:text-text-primary">
              Values
            </Link>
            <CaretRightIcon size={12} weight="bold" aria-hidden />
            <span className="text-text-secondary">Methodology</span>
          </nav>

          <p className={`mb-2 ${VALUE_LABEL}`}>DropMarket Value Database</p>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-text-primary sm:text-[32px]">
            How We Value {theme.name} Items
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            Every {hub.shortName} value on DropMarket is a price in real US dollars, read
            from live listings by reputable sellers and refreshed every day. This page
            explains exactly how — and where the limits are — so you can trust the
            number and cite it.
          </p>
        </div>
      </GameHeroBackdrop>

      <div className="relative z-10 mx-auto w-full max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <HubSection title="Real Money, Not Value Points">
          Most {hub.shortName} value lists publish one number per item in community
          &ldquo;value&rdquo; points, set by hand. Points are useful for comparing two
          items, but they cannot tell you what an item is worth — and they go stale
          between updates. We do not use them, or copy them. Every value here is a{' '}
          <strong className="text-text-primary">price in US dollars</strong>, measured
          from what reputable sellers are asking right now.
        </HubSection>

        <Suspense fallback={<SectionSkeleton />}>
          <SourcesSection gameSlug={gameSlug} gameName={theme.name} />
        </Suspense>

        <HubSection title="Reputable Sellers Only">
          A listing only counts if the seller has a real track record — a cheap price
          from a brand-new account is usually bait, not a deal. The bar rises with the
          money at stake:
          <ul className="mt-3 space-y-1.5">
            <li>
              • <strong className="text-text-primary">{REPUTABLE_MIN_REVIEWS}+ reviews</strong> for
              items under ${REPUTABLE_TIER_MID_USD}
            </li>
            <li>
              • <strong className="text-text-primary">{REPUTABLE_MIN_REVIEWS_MID}+ reviews</strong> from
              ${REPUTABLE_TIER_MID_USD} to ${REPUTABLE_TIER_HIGH_USD}
            </li>
            <li>
              • <strong className="text-text-primary">{REPUTABLE_MIN_REVIEWS_HIGH.toLocaleString('en-US')}+ reviews</strong>{' '}
              above ${REPUTABLE_TIER_HIGH_USD}, when enough such sellers list the item
            </li>
          </ul>
          <p className="mt-3">
            An item needs at least <strong className="text-text-primary">three</strong> reputable
            listings before we publish a value. Below that the list says &ldquo;No Price
            Yet&rdquo; — a gap is more honest than a guess.
          </p>
        </HubSection>

        <HubSection title="Cheapest vs Market Price">
          From the reputable listings we publish two numbers:
          <ul className="mt-3 space-y-1.5">
            <li>
              • <strong className="text-[#54DDBE]">Cheapest</strong> — the lowest price a
              reputable seller is asking that has other listings close above it. A lone
              low listing far under everything else is skipped: it is usually a
              mislabelled item or a fake.
            </li>
            <li>
              • <strong className="text-text-primary">Market</strong> — the typical price:
              the middle of the cheapest handful of reputable listings. What you should
              expect to pay if you are not hunting for the floor.
            </li>
          </ul>
          <p className="mt-3">
            We also drop placeholder prices (a listing at ten times the next one, kept up
            while a shop is out of stock) and anything priced below a cent per item.
          </p>
        </HubSection>

        <HubSection title="When A Value Changes">
          Prices wobble by a few cents every day. A value only moves on the site when it
          shifts by more than <strong className="text-text-primary">{pct}%</strong> or{' '}
          <strong className="text-text-primary">{cents} cents</strong>, whichever is
          larger, compared with the value we last published — not with yesterday. Small
          drifts still add up: a steady climb publishes as soon as it crosses the line.
          Every day&apos;s price is kept in the item&apos;s history, which draws the
          7D / 30D / 90D chart on its page.
        </HubSection>

        <HubSection title="Updated Daily">
          A fresh read of the market runs every day. Each item page shows when its value
          last moved, and the list shows a 7-day change once a week of history has
          built up — we never backfill history we did not record.
        </HubSection>

        <HubSection title="Chromas, Sets And Commons">
          {hub.pageRarities.includes('Chroma') && (
            <>
              A <strong className="text-text-primary">Chroma</strong> is priced as its own
              item, never as a multiple of its base weapon — they sell in different
              markets, and each item page links the two so you can compare.{' '}
            </>
          )}
          Sets are not priced yet. Every item on the list has a price where the
          evidence allows, but only {listPhrase(hub.pageRarities)} items get their own
          page: a page for a five-cent common would not help anyone.
        </HubSection>

        <HubSection title="Limitations You Should Know About">
          <p>
            These are <strong className="text-text-primary">asking prices on active
            listings</strong>, not completed sales — we do not have sales history for{' '}
            {theme.name}, and we do not pretend otherwise.
          </p>
          <p>
            We currently read <strong className="text-text-primary">one marketplace</strong>{' '}
            for {theme.name}; the second source we use for other games does not carry it
            yet. One source means less protection against a distorted market, so treat
            an item with only a handful of listings as a rough guide, not a quote.
          </p>
        </HubSection>

        <section className="pt-2">
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">
            Methodology — Frequently Asked Questions
          </h2>
          <FaqCards items={faq} square defaultOpen={0} className="mt-4" />
        </section>

        <div className="flex flex-wrap gap-3 pb-6 pt-2">
          <Link href={`/${gameSlug}/values`} className={VALUE_BTN_SECONDARY}>
            Browse All {hub.shortName} Values
            <ArrowRightIcon size={15} weight="bold" aria-hidden />
          </Link>
        </div>
      </div>

      <HubFooter
        gameName={hubNav.current.name}
        gameSlug={hubNav.current.slug}
        tools={hubNav.tools}
        itemsHref={hubNav.itemsHref}
        accountsHref={hubNav.accountsHref}
      />
    </main>
  )
}

/** The one data-backed section: live counts from the published set. */
async function SourcesSection({ gameSlug, gameName }: { gameSlug: string; gameName: string }) {
  const freshness = await getValuesFreshness(gameSlug)
  return (
    <HubSection title="Where The Prices Come From">
      <p>
        Every day we read the live {gameName} listings on a third-party marketplace —
        each asking price and each seller&apos;s review count. We currently price{' '}
        <strong className="text-text-primary">{freshness.pricedItems.toLocaleString('en-US')}</strong>{' '}
        items from{' '}
        <strong className="text-text-primary">{freshness.listingCount.toLocaleString('en-US')}</strong>{' '}
        reputable listings. Item names, rarities, origins and images come from the
        community wiki (images under CC BY-SA, credited on each page); the wiki&apos;s
        trading values are not used.
      </p>
    </HubSection>
  )
}

/** SourcesSection's footprint while its counts load. */
function SectionSkeleton() {
  return (
    <div className={`${VALUE_SURFACE} p-5 sm:p-6`} aria-busy>
      <Block className="h-5 w-56" />
      <div className="mt-4 space-y-2.5">
        <Block className="h-3.5 w-full" />
        <Block className="h-3.5 w-11/12" />
        <Block className="h-3.5 w-4/5" />
        <Block className="h-3.5 w-2/3" />
      </div>
    </div>
  )
}
