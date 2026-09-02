import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedGridPrices } from '@/lib/sab/priceCache'
import { JsonLd, breadcrumbList, itemList, faqPage } from '@/lib/seo/jsonld'
import { ValuesSeo, valuesFaq } from './_ValuesSeo'
import ValuesDirectoryClient, {
  type BrainrotDirectoryItem,
  type CardMutation,
} from './_ValuesDirectoryClient'
import { SabHeroBackdrop } from './_SabHeroBackdrop'
import { SabSellerCta } from '../_SabSellerCta'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { HubHero } from '@/components/content/HubHero'
import { HubGuidesStrip } from '@/components/content/HubGuidesStrip'
import AdoptMeValuesPage from './_AdoptMeValuesPage'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

type DirectoryTradePriceRow = {
  brainrot_id: string
  market_value_usd: number | string | null
  /** Low/high of the real listings behind the value — the trust-signal range. */
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  /**
   * Reputable-seller prices: cheapest (lowest 100+ review listing) and average
   * (typical reputable price). When present these are the buyer-facing pair —
   * "Cheapest" + "Market price". Null until a row is priced by the reputable path.
   */
  cheapest_usd: number | string | null
  average_usd: number | string | null
  confidence_label: string | null
  is_trade_ready: boolean
  /** Observed listings/sales behind the price — our popularity signal. */
  external_sample_size: number | string | null
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { gameSlug } = await params

  if (gameSlug === 'adopt-me') {
    const monthYear = new Date().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    const title = `Adopt Me Value List (${monthYear}) — Pet Values in USD | DropMarket`
    return {
      title,
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
        title,
        description:
          'Every Adopt Me pet, every variant — community trade value and DropMarket cash value side by side.',
        url: '/adopt-me/values',
        type: 'website',
      },
    }
  }

  if (gameSlug !== 'steal-a-brainrot') {
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

/**
 * Page through an entire table in 1000-row chunks. Supabase/PostgREST caps a
 * single select at 1000 rows, so `sab_brainrot_mutation_calculator` (~7k rows =
 * 498 brainrots × 14 mutations) silently returned only its first 1000 — which is
 * why most cards showed no mutation chip. A stable `.order()` keeps pages
 * gap-free. `build(query)` applies table-specific columns/filters to each page.
 */
async function selectAllRows<T>(
  build: (from: number, to: number) => any,
): Promise<T[]> {
  const PAGE = 1000
  const rows: T[] = []
  for (let page = 0; ; page += 1) {
    const from = page * PAGE
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) {
      console.error('selectAllRows:', error)
      break
    }
    if (!data?.length) break
    rows.push(...(data as T[]))
    if (data.length < PAGE) break
  }
  return rows
}

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
  const supabase = await createClient()

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

async function getBrainrots(): Promise<BrainrotDirectoryItem[]> {
  const supabase = await createClient()

  // Default-mutation prices + all priced mutations come from the cached, tagged
  // reader (sab_price_display, indexed → ~5ms). Tagged so the whole grid
  // refreshes the moment a crawl republishes; served from cache in between.
  const gridPricesPromise = getCachedGridPrices()

  const [
    brainrotResult,
    calculatorResult,
    popularityResult,
  ] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_market_catalog')
      .select(
        'id,name,slug,rarity,obtainability,base_income_per_second,image_url,display_price_usd,display_price_label,display_price_source,confidence_label',
      )
      .order('name', { ascending: true }),

    // Mutation display metadata (name, income multiplier, per-mutation income) for
    // every brainrot+mutation — drives the picker labels and the income line.
    // PAGINATED: ~7k rows (498 × 14) blow past PostgREST's 1000-row cap, which
    // previously truncated it so most cards showed no mutation chip.
    selectAllRows<{
      brainrot_id: string
      mutation_slug: string
      mutation_name: string | null
      income_multiplier: number | string | null
      calculated_income_per_second: number | string | null
    }>((from, to) =>
      (supabase as any)
        .from('sab_brainrot_mutation_calculator')
        .select(
          'brainrot_id,mutation_slug,mutation_name,income_multiplier,calculated_income_per_second',
        )
        .order('brainrot_id', { ascending: true })
        .range(from, to),
    ).then((data: unknown[]) => ({ data, error: null })),

    // Real marketplace popularity (Eldorado usePopularItems ranking). Read
    // straight from sab_brainrots so the hand-edited catalog view needn't change.
    // The Popular tab sorts by this; null-rank items sort after ranked ones.
    (supabase as any)
      .from('sab_brainrots')
      .select('id,popularity_rank')
      .not('popularity_rank', 'is', null),
  ])

  const { defaults: defaultPriceRows, mutations: mutationPriceRows } =
    await gridPricesPromise

  if (brainrotResult.error) {
    console.error(
      'Unable to load SAB values directory:',
      brainrotResult.error,
    )
    return []
  }

  const priceByBrainrot = new Map(
    (defaultPriceRows as DirectoryTradePriceRow[])
      .filter(
        (row) =>
          row.market_value_usd != null &&
          Number.isFinite(Number(row.market_value_usd)),
      )
      .map((row) => [row.brainrot_id, row]),
  )

  const rankByBrainrot = new Map(
    ((popularityResult?.data ?? []) as { id: string; popularity_rank: number }[])
      .map((row) => [row.id, row.popularity_rank] as const),
  )

  // Per-mutation prices (real cheapest/average) keyed by brainrot then slug.
  const mutationPriceByBrainrot = new Map<
    string,
    Map<string, { cheapest_usd: number | null; average_usd: number | null }>
  >()
  for (const row of mutationPriceRows as {
    brainrot_id: string
    mutation_slug: string
    cheapest_usd: number | string | null
    average_usd: number | string | null
  }[]) {
    const inner = mutationPriceByBrainrot.get(row.brainrot_id) ?? new Map()
    inner.set(row.mutation_slug, {
      cheapest_usd: row.cheapest_usd != null ? Number(row.cheapest_usd) : null,
      average_usd: row.average_usd != null ? Number(row.average_usd) : null,
    })
    mutationPriceByBrainrot.set(row.brainrot_id, inner)
  }

  // Mutation display metadata (name, multiplier, income) keyed by brainrot+slug.
  const mutationMetaByBrainrot = new Map<
    string,
    Map<
      string,
      { name: string; multiplier: number | null; income: number | null }
    >
  >()
  for (const row of (calculatorResult?.data ?? []) as {
    brainrot_id: string
    mutation_slug: string
    mutation_name: string | null
    income_multiplier: number | string | null
    calculated_income_per_second: number | string | null
  }[]) {
    const inner = mutationMetaByBrainrot.get(row.brainrot_id) ?? new Map()
    inner.set(row.mutation_slug, {
      name: row.mutation_name ?? row.mutation_slug,
      multiplier:
        row.income_multiplier != null ? Number(row.income_multiplier) : null,
      income:
        row.calculated_income_per_second != null
          ? Number(row.calculated_income_per_second)
          : null,
    })
    mutationMetaByBrainrot.set(row.brainrot_id, inner)
  }

  /**
   * Build the card's mutation list: EVERY mutation the item has metadata for,
   * carrying its real cheapest/average when priced (null → the card shows "No
   * Sales" for that mutation; we never estimate). Ordered by income multiplier
   * so Default leads and premiums ascend.
   */
  const buildMutations = (brainrotId: string): CardMutation[] => {
    const meta = mutationMetaByBrainrot.get(brainrotId)
    if (!meta) return []
    const prices = mutationPriceByBrainrot.get(brainrotId)
    return [...meta.entries()]
      .map(([slug, m]) => ({
        slug,
        name: m.name,
        multiplier: m.multiplier,
        income: m.income,
        cheapest_usd: prices?.get(slug)?.cheapest_usd ?? null,
        average_usd: prices?.get(slug)?.average_usd ?? null,
      }))
      .sort((a, b) => (a.multiplier ?? 0) - (b.multiplier ?? 0))
  }

  return (
    (brainrotResult.data ?? []) as BrainrotDirectoryItem[]
  ).map((brainrot) => {
    const price = priceByBrainrot.get(brainrot.id)
    const popularityRank = rankByBrainrot.get(brainrot.id) ?? null
    const mutations = buildMutations(brainrot.id)

    if (!price) return { ...brainrot, popularity_rank: popularityRank, mutations }

    return {
      ...brainrot,
      popularity_rank: popularityRank,
      mutations,
      display_price_usd: Number(price.market_value_usd),
      display_price_label: 'Average Current Market Price',
      display_price_source: 'public_market_estimate',
      confidence_label:
        price.confidence_label ?? brainrot.confidence_label,
      // The real-listings range behind the value — shown on the row as a trust
      // signal ("real listings $613–$799"), proving the headline value is
      // grounded in actual market data rather than a community guess. These come
      // straight from the corrected view, which already fences out fakes/stale
      // listings, so no extra trust logic is needed here.
      market_low_usd:
        price.market_low_usd != null ? Number(price.market_low_usd) : null,
      market_high_usd:
        price.market_high_usd != null ? Number(price.market_high_usd) : null,
      // Reputable cheapest + average — the buyer-facing "Cheapest" + "Market
      // price" pair. Null until the reputable path prices this row.
      cheapest_usd:
        price.cheapest_usd != null ? Number(price.cheapest_usd) : null,
      average_usd:
        price.average_usd != null ? Number(price.average_usd) : null,
      // How many real listings/sales we observed for this item. The only
      // popularity signal we actually hold — our own marketplace counts
      // (active_listing_count etc.) are still all zero.
      sample_size: Number(price.external_sample_size ?? 0),
    }
  })
}

export default async function BrainrotValuesPage({ params }: PageProps) {
  const { gameSlug } = await params

  // Adopt Me has its own page (different economy: variants, dual-axis, no
  // income). Delegate rather than branch inline so the SAB path stays intact.
  if (gameSlug === 'adopt-me') {
    return <AdoptMeValuesPage />
  }

  if (gameSlug !== 'steal-a-brainrot') {
    notFound()
  }

  const [brainrots, hubNav, movers] = await Promise.all([
    getBrainrots(),
    getHubNavData(gameSlug),
    getBiggestMovers(3),
  ])

  return (
    <main className="relative min-h-screen bg-[#0C0F0E]">
      <SabHeroBackdrop>
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
              Real cash values from completed DropMarket sales — not community
              guesses. Every Brainrot, its income per second, and what it trades
              for right now.
            </>
          }
        />
      </section>

      {/* Biggest movers — only rendered once we hold 2+ days of real
          snapshots, so it never shows invented movement. */}
      {movers.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-2 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[20px] font-semibold tracking-tight text-[#F1F3F1] sm:text-[24px]">
              Biggest movers this week
            </h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#5E685E]">
              Based on completed sales · 7d
            </span>
          </div>
          <div className="grid gap-px border border-[#1A211A] bg-[#1A211A] sm:grid-cols-3">
            {movers.map((m) => {
              const up = m.changePct >= 0
              return (
                <Link
                  key={m.slug}
                  href={`/steal-a-brainrot/values/${m.slug}`}
                  className="flex items-center gap-4 bg-[#0B0F0C] p-5 transition-colors hover:bg-[#111A12] sm:gap-5 sm:p-6"
                >
                  {m.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-16 w-16 shrink-0 object-contain sm:h-[76px] sm:w-[76px]"
                    />
                  )}
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#5E685E]">
                      {m.rarity}
                    </span>
                    <span className="truncate text-[17px] font-bold tracking-tight text-[#F2F6F0] sm:text-[19px]">
                      {m.name}
                    </span>
                    <span className="flex items-baseline gap-2.5">
                      <span className="font-mono text-[16px] font-bold tabular-nums text-[#E4EAE2] sm:text-[18px]">
                        {USD_FMT.format(m.price)}
                      </span>
                      <span
                        className="font-mono text-[12px] font-semibold tabular-nums"
                        style={{ color: up ? '#8FBF9C' : '#C97B6B' }}
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
          <div className="border border-[#1E2723] bg-[#121613] px-6 py-12 text-center">
            <h2 className="text-xl font-semibold text-[#F1F3F1]">
              Values are temporarily unavailable
            </h2>
            <p className="mt-2 text-[#9BA8A0]">
              The Brainrot database could not be loaded. Please check again
              shortly.
            </p>
          </div>
        ) : (
          <ValuesDirectoryClient brainrots={brainrots} />
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

      {/* Guides strip — flows this high-authority page's equity into blog
          content (self-hides if the game has no tagged posts). */}
      <div className="pt-12">
        <HubGuidesStrip
          gameSlug="steal-a-brainrot"
          heading="Guides for pricing &amp; trading Steal a Brainrot"
        />
      </div>

      {/* Seller door at the bottom of the value list — the other half of the
          dual buy/sell intent (buyers get HubBuyCta elsewhere). */}
      {brainrots.length > 0 && (
        <SabSellerCta gameSlug="steal-a-brainrot" gameName="Steal a Brainrot" src="sab-values" />
      )}
      </SabHeroBackdrop>
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
