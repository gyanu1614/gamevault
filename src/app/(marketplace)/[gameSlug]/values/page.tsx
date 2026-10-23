import type { Metadata } from 'next'
import { ValueListBuy } from '@/components/buy-rails/ValueListBuy'
import Link from '@/components/navigation/AppLink'
import { notFound } from 'next/navigation'
import { getCachedGridPrices } from '@/lib/sab/priceCache'
import { JsonLd, breadcrumbList, itemList, faqPage } from '@/lib/seo/jsonld'
import { ValuesSeo, valuesFaq } from './_ValuesSeo'
import ValuesDirectoryClient, {
  type BrainrotDirectoryItem,
  type CardMutation,
} from './_ValuesDirectoryClient'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubBuyCta } from '@/components/content/HubBuyCta'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData } from '@/lib/content/hubNav'
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'
import { HubHero } from '@/components/content/HubHero'
import { HubGuidesStrip } from '@/components/content/HubGuidesStrip'
import AdoptMeValuesPage from './_AdoptMeValuesPage'
import GenericValuesHubPage from './_generic/ValuesHubPage'
import ValueListPage from './_generic/ValueListPage'
import { ValueItemIndex } from '@/components/values/ValueItemIndex'
import { VALUES_PIPELINE_GAMES } from '@/lib/value-listings/catalogs'
import { valueListHub } from '@/lib/values/hub-config'
import { getGameContentTheme } from '@/lib/content/theme'
import { HUB_GROUND, VALUE_LABEL, VALUE_SURFACE_LINK } from '@/components/values/styles'
import { ValueArt } from '@/components/values/ValueArt'
import { RarityLabel } from '@/components/values/ValueCard'
import { ValuesEmptyState } from '@/components/values/ValuesEmptyState'
import { rarityMeta } from '@/lib/values/rarity'
import { socialTitle, stripBrand, DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import { seoMeta } from '@/lib/seo/fit'
import { getSabBrainrots } from './_sabBrainrots'
import {
  asNumber,
  filterSortBrainrots,
  SAB_DEFAULT_OBTAIN,
  SAB_DEFAULT_SORT,
  SAB_DEFAULT_VIEW,
  SAB_PAGE_SIZE,
} from './_sabListModel'
import { countFacets, initialValueList } from '@/lib/values/lazy-list'

// The publish step refreshes this page on every price move (values-revalidate);
// the window is a daily backstop (hourly rebuilt it on every visit an hour
// after the last render, re-reading the catalogue; 2026-10-20 usage audit).
export const revalidate = 86400
/**
 * Closed set: generateStaticParams lists every slug this route serves, so an
 * unknown slug is a static 404 with no function invocation (Step 7a — the
 * crawl of 233 `/{game}/…` hub URLs was rendering an empty page each).
 */
export const dynamicParams = false

/*
 * Games served by the generic values_* pipeline (VALUES_PIPELINE_GAMES, shared
 * with the listing matcher) render through config-driven pages: a value-LIST
 * hub (valueListHub: Murder Mystery 2) or Steal an Egg's sectioned hub. SAB
 * and Adopt Me still use their own tables until Phase 2 migrates them.
 */

/**
 * Prerender the game slug(s) this route serves; every other slug notFound()s
 * below, so there is nothing else to build.
 */
export function generateStaticParams() {
  return contentHubSlugsFor('values').map((gameSlug) => ({ gameSlug }))
}

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

async function generateMetadataRaw({
  params,
}: PageProps): Promise<Metadata> {
  const { gameSlug } = await params

  if (gameSlug === 'adopt-me') {
    const monthYear = new Date().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    // The branded string is reused on purpose for the social title; the
    // templated <title> gets it bare (the layout appends "| DropMarket").
    // Bing 2026-10-19: 14.2K impressions at 1.1% for "Adopt Me Value List …
    // — Pet Values in USD". The searches are "adopt me pet values" (top),
    // "adopt me values" and "value list": the title now says exactly that.
    const socialTitle = `Adopt Me Pet Values (${monthYear}) – Value List | DropMarket`
    return {
      title: stripBrand(socialTitle),
      description: `Every Adopt Me pet's value for ${monthYear}: trade points from real sale prices (Frost Dragon = 100) and USD prices for all 8 forms, checked daily.`,
      keywords: [
        'adopt me value list',
        'adopt me values',
        'adopt me pet values',
        'adopt me values in real money',
        'adopt me pet values usd',
        'adopt me fly ride values',
        'adopt me neon values',
        'adopt me mega values',
        'how much are adopt me pets worth',
        'sell adopt me pets for money',
      ],
      alternates: { canonical: '/adopt-me/values' },
      openGraph: {
        images: DEFAULT_OG_IMAGES,
        title: socialTitle,
        description:
          'Every Adopt Me pet, every form: trade value from real sale prices and cash value in USD, side by side.',
        url: '/adopt-me/values',
        type: 'website',
      },
    }
  }

  // Value-list hubs (MM2): "<short> value list (Month Year)" — the head term.
  const listHub = hasHubPage(gameSlug, 'values') ? valueListHub(gameSlug) : null
  if (listHub) {
    const theme = getGameContentTheme(gameSlug)
    const monthYear = new Date().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    const title = `${listHub.shortName} Value List (${monthYear}) — ${theme.name} Prices in USD`
    const description = `${theme.name} value list for ${monthYear}: what every Godly, Ancient, Vintage and Chroma actually sells for in real money, from live listings by reputable sellers. Updated daily — no value points.`
    return {
      title,
      description,
      alternates: { canonical: `/${gameSlug}/values` },
      openGraph: { images: DEFAULT_OG_IMAGES, title: socialTitle(title), description, url: `/${gameSlug}/values`, type: 'website' },
    }
  }

  // Games on the generic values pipeline build their metadata from config, so
  // a new game needs no edit here.
  if (VALUES_PIPELINE_GAMES.has(gameSlug)) {
    const theme = getGameContentTheme(gameSlug)
    const monthYear = new Date().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    const title = `${theme.name} Value List (${monthYear}) — Egg & Account Prices`
    return {
      title,
      description: `${theme.name} values for ${monthYear}: what sealed eggs sell for by area and what accounts go for by income, priced from live marketplace listings.`,
      alternates: { canonical: `/${gameSlug}/values` },
      openGraph: { images: DEFAULT_OG_IMAGES, title, url: `/${gameSlug}/values`, type: 'website' },
    }
  }

  if (!hasHubPage(gameSlug, 'values')) {
    return { title: 'Values Not Found' }
  }

  // Target the #1 query shape "[game] value list [Month Year]". The dated
  // modifier is a real freshness signal (prices update daily), and "value
  // list" is the exact head term competitors title on. Computed at request
  // time so it stays current without edits.
  const now = new Date()
  const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const title = `Steal a Brainrot Value List (${monthYear}) — Prices & Income`

  return {
    title,
    description: `Steal a Brainrot value list for ${monthYear}: live cash values, income, rarity, obtainability, and mutation prices for every Brainrot — updated daily from real DropMarket marketplace data.`,
    alternates: { canonical: '/steal-a-brainrot/values' },
    openGraph: {
      images: DEFAULT_OG_IMAGES,
      title,
      description:
        'Compare Brainrot values, income, rarity, mutations, and live marketplace pricing — updated daily.',
      url: '/steal-a-brainrot/values',
      type: 'website',
    },
  }
}

const USD_FMT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export interface MoverItem {
  slug: string
  name: string
  rarity: string
  imageUrl: string | null
  price: number
  changePct: number
}

/**
 * "Biggest movers": the cards' own 7-day trends (getSabBrainrots →
 * _listTrends, the plain price), largest move first, so the box and the cards
 * show the same numbers. Empty — and the box hidden — until two snapshot days
 * exist: a change needs two points to be true. (It used to read the history
 * in one unpaged request, which stopped at 1,000 of ~4,600 rows.)
 */
function biggestMovers(brainrots: BrainrotDirectoryItem[], limit = 3): MoverItem[] {
  return brainrots
    .filter((b) => b.trendPct != null)
    .map((b) => ({
      slug: b.slug,
      name: b.name,
      rarity: b.rarity ?? '',
      imageUrl: b.image_url,
      price: asNumber(b.average_usd) ?? asNumber(b.display_price_usd) ?? 0,
      changePct: b.trendPct as number,
    }))
    .filter((m) => m.price > 0)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, limit)
}

export default async function BrainrotValuesPage({ params }: PageProps) {
  const { gameSlug } = await params

  // Adopt Me has its own page (different economy: variants, dual-axis, no
  // income). Delegate rather than branch inline so the SAB path stays intact.
  if (gameSlug === 'adopt-me') {
    return <AdoptMeValuesPage />
  }

  // Games on the generic values_* pipeline render through the shared hub
  // components — no per-game page component. dynamicParams = false closes the
  // set, but Vercel does not enforce it: gate on the hub config too.
  if (VALUES_PIPELINE_GAMES.has(gameSlug)) {
    if (!hasHubPage(gameSlug, 'values')) notFound()
    return valueListHub(gameSlug) ? (
      <ValueListPage gameSlug={gameSlug} />
    ) : (
      <GenericValuesHubPage gameSlug={gameSlug} />
    )
  }

  if (!hasHubPage(gameSlug, 'values')) {
    notFound()
  }

  const [brainrots, hubNav] = await Promise.all([getSabBrainrots(), getHubNavData(gameSlug)])
  const movers = biggestMovers(brainrots)

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <ValueListBuy gameSlug={gameSlug}>
      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
      <HubNav data={hubNav} />
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Steal a Brainrot', path: '/steal-a-brainrot' },
          { name: 'Values', path: '/steal-a-brainrot/values' },
        ])}
      />
      {/* ItemList — reads the directory as a ranked, crawlable set of value
          pages, passing equity to the per-Brainrot [slug] pages (which carry
          the Product schema). Only priced Brainrots, highest value first, 50. */}
      {brainrots.length > 0 && (
        <JsonLd
          data={itemList(
            brainrots
              .filter((b) => b.display_price_usd != null)
              .sort(
                (a, b) =>
                  Number(b.display_price_usd ?? 0) - Number(a.display_price_usd ?? 0),
              )
              .slice(0, 50)
              .map((b) => ({
                name: b.name,
                path: `/steal-a-brainrot/values/${b.slug}`,
              })),
          )}
        />
      )}
      {/* FAQPage — mirrors the visible FAQ rendered by ValuesSeo below. */}
      {brainrots.length > 0 && (
        <JsonLd
          data={faqPage(
            valuesFaq({ gameName: 'Steal a Brainrot', unit: 'Brainrot' }),
          )}
        />
      )}

      <section>
        {/* pt clears the fixed HubNav; visible breadcrumb removed (JSON-LD
            above keeps the SERP breadcrumb). */}
        {/* Shared hub hero — same type scale + spacing as every other hub
            (see HubHero). The stat block and standalone "Priced from real
            sales" badge that used to live here were removed: the badge rides
            the results line, the stats were redundant with the list itself. */}
        <HubHero
          title="Steal a Brainrot - Value"
          lead={
            <>
              Real cash values from live marketplace listings, reputable
              sellers only — not community guesses. Every Brainrot, its income
              per second, and what it trades for right now.
            </>
          }
        />
      </section>

      {/* Biggest movers — only rendered once we hold 2+ days of real
          snapshots, so it never shows invented movement. */}
      {movers.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-2 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[20px] font-semibold tracking-tight text-text-primary sm:text-[24px]">
              Biggest movers this week
            </h2>
            <span className={VALUE_LABEL}>Based on live listings · 7d</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {movers.map((m) => {
              const up = m.changePct >= 0
              const rarity = rarityMeta('steal-a-brainrot', m.rarity)
              return (
                <Link
                  key={m.slug}
                  href={`/steal-a-brainrot/values/${m.slug}`}
                  className={`flex items-center gap-4 p-5 sm:gap-5 sm:p-6 ${VALUE_SURFACE_LINK}`}
                >
                  {m.imageUrl && (
                    <ValueArt
                      src={m.imageUrl}
                      alt={m.name}
                      aria-hidden
                      size={68}
                      pixelated
                      className="shrink-0"
                    />
                  )}
                  <span className="flex min-w-0 flex-col gap-1.5">
                    {m.rarity && <RarityLabel label={rarity.label} color={rarity.color} />}
                    <span className="truncate text-[17px] font-semibold tracking-tight text-text-primary sm:text-[19px]">
                      {m.name}
                    </span>
                    <span className="flex items-baseline gap-2.5">
                      <span className="text-[16px] font-semibold tabular-nums text-text-primary sm:text-[18px]">
                        {USD_FMT.format(m.price)}
                      </span>
                      <span
                        className={`text-[12px] font-semibold tabular-nums ${up ? 'text-success' : 'text-error'}`}
                      >
                        {up ? '+' : '−'}
                        {Math.abs(m.changePct).toFixed(1)}%
                      </span>
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-10 sm:px-6 lg:px-8">
        {brainrots.length === 0 ? (
          <ValuesEmptyState
            title="Values are temporarily unavailable"
            body="The Brainrot database could not be loaded. Please check again shortly."
          />
        ) : (
          // The default view's first page only; the client fetches the rest
          // (lib/values/lazy-list.ts — the full list made this page 1.7 MB).
          <ValuesDirectoryClient
            initial={initialValueList(
              filterSortBrainrots(brainrots, {
                query: '',
                view: SAB_DEFAULT_VIEW,
                obtainability: SAB_DEFAULT_OBTAIN,
                sort: SAB_DEFAULT_SORT,
              }),
              {
                pageSize: SAB_PAGE_SIZE,
                facets: countFacets(brainrots, { rarity: (b) => b.rarity, obtain: (b) => b.obtainability, new: (b) => (b.isNew ? 'new' : null) }),
              },
            )}
          />
        )}
      </section>

      {/* SEO content package — answer-first intro, "how we price", + a rendered
          FAQ (schema emitted above). Turns the head-term value page from
          thin/list-only into competitor-depth content. */}
      {brainrots.length > 0 && (
        <ValuesSeo
          gameSlug="steal-a-brainrot"
          gameName="Steal a Brainrot"
          unit="Brainrot"
          buyHref="/steal-a-brainrot/buy-items"
        />
      )}

      {/* Every brainrot page linked in the server HTML (the directory above
          is client-rendered and paged). */}
      <ValueItemIndex
        className="pt-12"
        title="All Steal a Brainrot Values A–Z"
        items={brainrots.map((b) => ({ href: `/steal-a-brainrot/values/${b.slug}`, name: b.name }))}
      />

      {/* Guides strip — flows this high-authority page's equity into blog
          content (self-hides if the game has no tagged posts). */}
      <div className="pt-12">
        <HubGuidesStrip
          gameSlug="steal-a-brainrot"
          heading="Steal a Brainrot Blog & Guides"
        />
      </div>

      {/* Buy CTA — price/tool pages carry the BUY band (price-checkers buy);
          the seller band lives on the blog surfaces. */}
      {brainrots.length > 0 && (
        <HubBuyCta gameName="Steal a Brainrot" gameSlug="steal-a-brainrot" buyHref="/steal-a-brainrot/buy-items" />
      )}
      </GameHeroBackdrop>
      </ValueListBuy>
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

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(
  ...args: Parameters<typeof generateMetadataRaw>
): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
