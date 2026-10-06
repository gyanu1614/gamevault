import { Suspense } from 'react'
import Link from '@/components/navigation/AppLink'
import { JsonLd, breadcrumbList, faqPage, itemList } from '@/lib/seo/jsonld'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubHero } from '@/components/content/HubHero'
import { HubBuyCta } from '@/components/content/HubBuyCta'
import { HubGuidesStrip } from '@/components/content/HubGuidesStrip'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameContentTheme, hasHubPage } from '@/lib/content/theme'
import { HUB_GROUND } from '@/components/values/styles'
import { ValuesEmptyState } from '@/components/values/ValuesEmptyState'
import { getValueItems, getValueTrends, getValuesFreshness } from '@/lib/values/data'
import { valueItemHasPage, valueListHub, type ValueListHubConfig } from '@/lib/values/hub-config'
import { ValuesSeo, VALUES_SEO_LINK as linkCls, type ValuesFaqItem } from '../_ValuesSeo'
import ValueListClient, { type ValueListRow } from './ValueListClient'
import { ValueListSkeleton } from './ValueListSkeleton'

/**
 * Value LIST hub for a game on the values_* pipeline (Murder Mystery 2 first):
 * Adopt Me's value-list page — same backdrop, nav, hero, toolbar, filter
 * tiles, card grid, pagination, SEO package and CTA — fed by values_items /
 * values_prices. Only the data and the rarity accents differ.
 *
 * Static-first: the hero ships in the first flush; the list streams in behind
 * a skeleton that mirrors it (an in-page Suspense, not a route loading.tsx —
 * a route-level boundary flushes a 200 before a page can 404, see c8cb309a).
 * Filters live in the URL and are applied after hydration (SearchParamsBridge
 * in the client), so the prerendered HTML holds the full first page.
 */

const usd = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

export default async function ValueListPage({ gameSlug }: { gameSlug: string }) {
  const theme = getGameContentTheme(gameSlug)
  const hub = valueListHub(gameSlug)!
  const hubNav = await getHubNavData(gameSlug)
  const buyHref = hubNav.itemsHref ?? `/${gameSlug}`

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: theme.name, path: `/${gameSlug}` },
            { name: 'Values', path: `/${gameSlug}/values` },
          ])}
        />

        <section>
          <HubHero title={theme.heroTitle} lead={theme.heroLead} />
        </section>

        {/* Inside the backdrop: only its `relative z-20` children stack above
            the band (same contract as the Adopt Me list). */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <Suspense fallback={<ValueListSkeleton />}>
            <ValueListBody gameSlug={gameSlug} hub={hub} buyHref={buyHref} />
          </Suspense>
        </section>

        <div className="pt-12">
          <HubGuidesStrip gameSlug={gameSlug} heading={`Guides For Pricing & Trading ${theme.name}`} />
        </div>
      </GameHeroBackdrop>

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

async function ValueListBody({
  gameSlug,
  hub,
  buyHref,
}: {
  gameSlug: string
  hub: ValueListHubConfig
  buyHref: string
}) {
  const theme = getGameContentTheme(gameSlug)
  const [items, trends, freshness] = await Promise.all([
    getValueItems(gameSlug, { kinds: ['item'] }),
    getValueTrends(gameSlug, 7),
    getValuesFreshness(gameSlug),
  ])

  const rows: ValueListRow[] = items.map((i) => {
    const priced = i.price?.cheapestUsd != null
    return {
      id: i.id,
      slug: i.slug,
      name: i.name,
      rarity: i.rarity,
      itemType: i.itemType,
      imageUrl: i.imageUrl,
      href: valueItemHasPage(gameSlug, { rarity: i.rarity, priced })
        ? `/${gameSlug}/values/${i.slug}`
        : null,
      cheapestUsd: i.price?.cheapestUsd ?? null,
      marketUsd: i.price?.averageUsd ?? null,
      listedNow: i.price?.sampleSize ?? 0,
      trendPct: trends.pctByItem[i.id] ?? null,
    }
  })

  if (rows.length === 0) {
    return (
      <ValuesEmptyState
        title="Values are temporarily unavailable"
        body={`The ${theme.name} value list could not be loaded. Please check again shortly.`}
      />
    )
  }

  // The most valuable items that HAVE a page: the crawlable ranked set.
  const ranked = rows
    .filter((r) => r.href && r.cheapestUsd != null)
    .sort((a, b) => (b.cheapestUsd ?? 0) - (a.cheapestUsd ?? 0))
  const top = ranked[0]
  const faq = valueListFaq(theme.name, hub.shortName, top)

  return (
    <>
      <JsonLd
        data={itemList(
          ranked.slice(0, 50).map((r) => ({ name: r.name, path: r.href! })),
        )}
      />
      <JsonLd data={faqPage(faq)} />

      <ValueListClient
        gameSlug={gameSlug}
        gameName={theme.name}
        rows={rows}
        hub={hub}
        hasTrends={Object.keys(trends.pctByItem).length > 0}
        freshness={{
          lastChangedAt: freshness.lastChangedAt,
          listingCount: freshness.listingCount,
          sourceCount: freshness.sourceCount,
        }}
      />

      <ValuesSeo
        gameSlug={gameSlug}
        gameName={theme.name}
        unit={theme.itemNoun}
        buyHref={buyHref}
        calculatorHref={null}
        faq={faq}
        intro={valueListIntro({
          gameSlug,
          gameName: theme.name,
          shortName: hub.shortName,
          buyHref,
          top,
          freeGuideHref: hasHubPage(gameSlug, 'freeItems') ? `/${gameSlug}/free-items` : null,
        })}
      />

      <HubBuyCta gameName={theme.name} gameSlug={gameSlug} buyHref={buyHref} />
    </>
  )
}

/** Plain-English intro for the SEO package — real numbers, no jargon. */
function valueListIntro({
  gameSlug,
  gameName,
  shortName,
  buyHref,
  top,
  freeGuideHref,
}: {
  gameSlug: string
  gameName: string
  shortName: string
  buyHref: string
  top: ValueListRow | undefined
  /** The game's honest free-items guide, when it publishes one. */
  freeGuideHref: string | null
}): { heading: string; body: React.ReactNode }[] {
  return [
    {
      heading: `What Is Your ${shortName} Item Worth?`,
      body: (
        <>
          Every knife, gun and pet here has a price in real US dollars — what
          people are paying right now, not a community &quot;value&quot; in made-up
          points. Search any item to see the cheapest price a trusted seller is
          asking, the typical market price, and how many are listed right now.
          {top && top.cheapestUsd != null && (
            <>
              {' '}The most expensive item on the list today is the {top.name}, from{' '}
              {usd(top.cheapestUsd)}.
            </>
          )}
        </>
      ),
    },
    {
      heading: 'How We Price Every Item',
      body: (
        <>
          We read live listings every day and only count sellers with hundreds of
          completed orders, so a fake cheap listing from a new account can&apos;t
          drag a value down. From those listings we publish two numbers: the
          cheapest real price and the typical market price. A value only moves
          when the market really moves. The full method is on the{' '}
          <Link href={`/${gameSlug}/values/methodology`} className={linkCls}>
            pricing methodology
          </Link>{' '}
          page.
        </>
      ),
    },
    {
      heading: `Why Godlies, Ancients And Chromas Hold Their Value`,
      body: (
        <>
          In {gameName} most of the money sits in a small set of items. Event
          Godlies and Ancients never come back once the event ends, so supply only
          shrinks, and a Chroma unboxes far less often than its normal version —
          which is why a Chroma can sell for many times its base weapon. Once you
          know what an item is worth you can{' '}
          <Link href={buyHref} className={linkCls}>
            buy {shortName} items
          </Link>{' '}
          at a fair price, or list your own, with SafeDrop covering every order.
          {freeGuideHref && (
            <>
              {' '}Want them without paying? Here is{' '}
              <Link href={freeGuideHref} className={linkCls}>
                every real way to get free {shortName} Godlies
              </Link>
              , with the odds.
            </>
          )}
        </>
      ),
    },
  ]
}

/** The list's FAQ — rendered by ValuesSeo and mirrored in FAQPage schema. */
function valueListFaq(gameName: string, shortName: string, top: ValueListRow | undefined): ValuesFaqItem[] {
  return [
    {
      q: `How much are ${shortName} items worth in real money?`,
      a: `Every item on this list shows its price in US dollars: the cheapest price a reputable seller is asking and the typical market price, from live listings checked every day.${
        top && top.cheapestUsd != null ? ` The most expensive item right now is the ${top.name}, from ${usd(top.cheapestUsd)}.` : ''
      } Most common knives and guns sell for well under a dollar.`,
    },
    {
      q: `Why don't you use ${shortName} value points?`,
      a: `Community value lists rate items in points that only make sense against each other, and they are set by hand. We show what an item actually sells for in real money, measured from live listings — a number you can act on whether you are buying, selling or checking a trade.`,
    },
    {
      q: `How often are these ${gameName} values updated?`,
      a: `Every day. A value only changes on the page when the market moves by more than 3% (or 5 cents on cheap items), so the list follows real moves instead of daily noise. Each item page shows a price chart built from those daily snapshots.`,
    },
    {
      q: `What does "listed now" mean?`,
      a: `It is how many live listings from reputable sellers back the item's price at the last daily check. More listings mean a more reliable price; an item with only a handful can move quickly.`,
    },
    {
      q: `How do I sell my ${shortName} items for money?`,
      a: `Check your item's value here, then list it on DropMarket. Buyers find listings through these same value pages, and every order is covered by SafeDrop — the buyer gets exactly what they ordered, or their money back.`,
    },
  ]
}
