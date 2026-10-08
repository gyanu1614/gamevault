import type { Metadata } from 'next'
import Link from '@/components/navigation/AppLink'
import { notFound } from 'next/navigation'
import { createValueListReadClient } from '@/lib/values/read-client'
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
  filterSortBrainrots,
  SAB_DEFAULT_OBTAIN,
  SAB_DEFAULT_SORT,
  SAB_DEFAULT_VIEW,
  SAB_PAGE_SIZE,
} from './_sabListModel'
import { countFacets, initialValueList } from '@/lib/values/lazy-list'

export const revalidate = 3600
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
    const socialTitle = `Adopt Me Value List (${monthYear}) — Pet Values in USD | DropMarket`
    return {
      title: stripBrand(socialTitle),
      description: `Adopt Me value list for ${monthYear}: real cash values and community trade values for every pet and potion variant (Fly Ride, Neon, Mega) — the only list that shows what a pet is worth in real money.`,
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
          'Every Adopt Me pet, every variant — community trade value and DropMarket cash value side by side.',
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
 * "Biggest movers" — 7-day percentage change per item, computed from real
 * daily snapshots in sab_price_history (default mutation only).
 *
 * Deliberately gated: returns [] unless we hold at least two distinct
 * snapshot days, because a "change" needs two points to be true. History
 * cannot be backfilled, so this stays empty until enough days accumulate and
 * the section self-hides rather than inventing movement.
 */
async function getBiggestMovers(limit = 3): Promise<MoverItem[]> {
  const supabase = createValueListReadClient('steal-a-brainrot')

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 8)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data, error } = await (supabase as any)
    .from('sab_price_history')
    .select(
      'brainrot_id,history_date,median_usd,sab_mutations!inner(slug),sab_brainrots!inner(slug,name,rarity,image_url)',
    )
    .eq('sab_mutations.slug', 'default')
    .gte('history_date', sinceStr)
    .order('history_date', { ascending: true })

  if (error || !data) return []

  type Row = {
    brainrot_id: string
    history_date: string
    median_usd: number | string | null
    sab_brainrots?: {
      slug: string
      name: string
      rarity: string | null
      image_url: string | null
    } | null
  }

  const days = new Set<string>()
  const byItem = new Map<
    string,
    { first: number; last: number; meta: NonNullable<Row['sab_brainrots']> }
  >()

  for (const row of data as Row[]) {
    const value = Number(row.median_usd)
    const meta = row.sab_brainrots
    if (!Number.isFinite(value) || value <= 0 || !meta) continue
    days.add(row.history_date)
    const existing = byItem.get(row.brainrot_id)
    // Rows arrive oldest-first, so `first` sticks and `last` keeps updating.
    if (existing) existing.last = value
    else byItem.set(row.brainrot_id, { first: value, last: value, meta })
  }

  // A change needs two distinct days of evidence.
  if (days.size < 2) return []

  return [...byItem.values()]
    .filter((x) => x.first > 0 && x.last !== x.first)
    .map((x) => ({
      slug: x.meta.slug,
      name: x.meta.name,
      rarity: x.meta.rarity ?? '',
      imageUrl: x.meta.image_url,
      price: x.last,
      changePct: ((x.last - x.first) / x.first) * 100,
    }))
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

  const [brainrots, hubNav, movers] = await Promise.all([
    getSabBrainrots(),
    getHubNavData(gameSlug),
    getBiggestMovers(3),
  ])

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
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
                facets: countFacets(brainrots, { rarity: (b) => b.rarity, obtain: (b) => b.obtainability }),
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
