import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { CalculatorSeo, CALCULATOR_FAQ } from './_CalculatorSeo'
import { SabHeroBackdrop } from '../values/_SabHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubGuidesStrip } from '@/components/content/HubGuidesStrip'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData } from '@/lib/content/hubNav'
import { asNumber } from '@/lib/sab/format'
import { HubBuyCta } from '@/components/content/HubBuyCta'
import CalculatorClient, {
  type CalcBrainrot,
  type CalcMutation,
  type CalcPrice,
} from './_CalculatorClient'
import AdoptMeCalculatorPage from './_AdoptMeCalculatorPage'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ gameSlug: string }>
  searchParams: Promise<{
    brainrot?: string
    mutation?: string
    tab?: string
  }>
}

type BrainrotRow = {
  id: string
  name: string
  slug: string
  rarity: string
  base_income_per_second: number | string | null
  image_url: string | null
}

type MutationRow = {
  id: string
  name: string
  slug: string
  income_multiplier: number | string
  availability: string
}

type CashPriceRow = {
  brainrot_id: string
  mutation_id: string
  market_value_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  /** Reputable cheapest/average — the new buyer-facing prices. When present,
   * cheapest is what the calculator should sum (a trade is valued at what you'd
   * actually pay), falling back to average, then the legacy market value. */
  cheapest_usd?: number | string | null
  average_usd?: number | string | null
  confidence_label: string | null
  external_sample_size: number | null
  price_updated_at: string | null
  is_trade_ready: boolean
}

type TradePriceRow = {
  brainrot_id: string
  mutation_id: string
  market_value_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  confidence_label: string | null
  external_sample_size: number | null
  is_trade_ready: boolean
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { gameSlug } = await params

  if (gameSlug === 'adopt-me') {
    const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const title = `Adopt Me WFL Calculator (${monthYear}) — Win, Fair or Loss + Real Money`
    return {
      title,
      description: `Free Adopt Me WFL calculator: add both sides of a trade, pick each pet's variant, and see if it's a Win, Fair or Loss — in trade value AND in real money (USD). The only Adopt Me trade checker that shows the cash side. Updated ${monthYear}.`,
      alternates: { canonical: '/adopt-me/calculator' },
      keywords: [
        'adopt me wfl calculator',
        'adopt me trade calculator',
        'adopt me win fair loss',
        'is this adopt me trade fair',
        'adopt me trade value calculator',
        'adopt me trade calculator real money',
      ],
      openGraph: {
        title,
        description: 'Check whether an Adopt Me trade is a Win, Fair or Loss — in trade value and in real money.',
        url: '/adopt-me/calculator',
        type: 'website',
      },
    }
  }

  if (gameSlug !== 'steal-a-brainrot') {
    return { title: 'Calculator Not Found' }
  }

  const monthYear = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return {
    title: `Steal a Brainrot WFL Calculator (${monthYear}) — Win, Fair or Loss Trade Checker`,
    description: `Free Steal a Brainrot WFL calculator: put both sides of a trade in and see instantly whether it's a Win, Fair or Loss. Priced from real completed sales and live listings, every mutation covered, refreshed every few hours — ${monthYear}.`,
    alternates: {
      canonical: '/steal-a-brainrot/calculator',
    },
    openGraph: {
      title:
        'Steal a Brainrot Value & Trade Calculator',
      description:
        'Look up mutation cash prices and check whether a trade is a Win, Fair, or Loss.',
      url: '/steal-a-brainrot/calculator',
      type: 'website',
    },
  }
}

async function getAllCashPrices(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CashPriceRow[]> {
  const pageSize = 1000
  const rows: CashPriceRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await (supabase as any)
      .from('sab_price_display')
      .select(
        'brainrot_id,mutation_id,market_value_usd,market_low_usd,market_high_usd,cheapest_usd,average_usd,confidence_label,external_sample_size,price_updated_at,is_trade_ready',
      )
      .range(from, from + pageSize - 1)

    if (error) {
      console.error(
        'Unable to load calculator cash prices:',
        error,
      )
      break
    }

    const page = (data ?? []) as CashPriceRow[]
    rows.push(...page)

    if (page.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function getAllTradePrices(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<TradePriceRow[]> {
  const pageSize = 1000
  const rows: TradePriceRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await (supabase as any)
      .from('sab_trade_price_catalog')
      .select(
        'brainrot_id,mutation_id,market_value_usd,market_low_usd,market_high_usd,confidence_label,external_sample_size,is_trade_ready',
      )
      .eq('is_trade_ready', true)
      .range(from, from + pageSize - 1)

    if (error) {
      console.error(
        'Unable to load calculator trade prices:',
        error,
      )
      break
    }

    const page = (data ?? []) as TradePriceRow[]
    rows.push(...page)

    if (page.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function getCalculatorData(): Promise<{
  brainrots: CalcBrainrot[]
  mutations: CalcMutation[]
  cashPrices: CalcPrice[]
  tradePrices: CalcPrice[]
  lastUpdated: string | null
}> {
  const supabase = await createClient()

  const [
    brainrotResult,
    mutationResult,
    cashPriceRows,
    tradePriceRows,
  ] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_catalog')
      .select(
        'id,name,slug,rarity,base_income_per_second,image_url',
      )
      .order('name', { ascending: true }),

    (supabase as any)
      .from('sab_mutation_catalog')
      .select(
        'id,name,slug,income_multiplier,availability',
      )
      .order('income_multiplier', { ascending: true }),

    getAllCashPrices(supabase),
    getAllTradePrices(supabase),
  ])

  if (brainrotResult.error) {
    console.error(
      'Unable to load calculator Brainrots:',
      brainrotResult.error,
    )
  }

  if (mutationResult.error) {
    console.error(
      'Unable to load calculator mutations:',
      mutationResult.error,
    )
  }

  const brainrots = (
    (brainrotResult.data ?? []) as BrainrotRow[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    rarity: row.rarity,
    baseIncomePerSecond: asNumber(row.base_income_per_second),
    imageUrl: row.image_url,
  }))

  const mutations = (
    (mutationResult.data ?? []) as MutationRow[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    multiplier: Number(row.income_multiplier),
    availability: row.availability,
  }))

  const toPrice = (
    row: CashPriceRow | TradePriceRow,
  ): CalcPrice | null => {
    // Prefer the reputable CHEAPEST (what you'd actually pay), then average,
    // then the legacy market value — so the calculator matches the item page.
    const cheapest = asNumber((row as CashPriceRow).cheapest_usd)
    const average = asNumber((row as CashPriceRow).average_usd)
    const marketValueUsd =
      cheapest ?? average ?? asNumber(row.market_value_usd)
    if (marketValueUsd == null) return null

    return {
      brainrotId: row.brainrot_id,
      mutationId: row.mutation_id,
      marketValueUsd,
      marketLowUsd:
        asNumber(row.market_low_usd) ?? marketValueUsd,
      marketHighUsd:
        asNumber(row.market_high_usd) ?? marketValueUsd,
      confidenceLabel: row.confidence_label ?? 'insufficient',
      sampleSize: row.external_sample_size ?? 0,
      isTradeReady: row.is_trade_ready,
    }
  }

  const cashPrices = cashPriceRows
    .map(toPrice)
    .filter((row): row is CalcPrice => row !== null)

  const tradePrices = tradePriceRows
    .map(toPrice)
    .filter(
      (row): row is CalcPrice =>
        row !== null && row.isTradeReady,
    )

  // Newest crawl timestamp across all priced rows — powers the "Updated X ago"
  // freshness stamp. Prices refresh every ~3h, so this is never stale for long.
  let lastUpdated: string | null = null
  for (const row of cashPriceRows) {
    const ts = row.price_updated_at
    if (ts && (lastUpdated == null || ts > lastUpdated)) lastUpdated = ts
  }

  return { brainrots, mutations, cashPrices, tradePrices, lastUpdated }
}

export default async function SabCalculatorPage({
  params,
  searchParams,
}: PageProps) {
  const [{ gameSlug }, resolvedSearchParams] =
    await Promise.all([params, searchParams])

  // Adopt Me WFL calculator (dual trade + cash verdict). ?tab=cash on Adopt Me
  // deep-links to the values list instead of a separate cash tab (see nav).
  if (gameSlug === 'adopt-me') {
    return <AdoptMeCalculatorPage />
  }

  if (gameSlug !== 'steal-a-brainrot') notFound()

  const { brainrots, mutations, cashPrices, tradePrices, lastUpdated } =
    await getCalculatorData()

  // Top brainrots by default cash value — the value table + internal links.
  const defaultMutationId =
    mutations.find((m) => m.slug === 'default')?.id ?? mutations[0]?.id
  const defaultPriceByBrainrot = new Map<string, number>()
  for (const p of cashPrices) {
    if (p.mutationId === defaultMutationId && p.marketValueUsd != null) {
      defaultPriceByBrainrot.set(p.brainrotId, p.marketValueUsd)
    }
  }
  const topValues = brainrots
    .map((b) => ({
      slug: b.slug,
      name: b.name,
      rarity: b.rarity,
      priceUsd: defaultPriceByBrainrot.get(b.id) ?? null,
    }))
    .filter((r) => r.priceUsd != null)
    .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
    .slice(0, 40)

  const monthYear = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const hubNav = await getHubNavData('steal-a-brainrot')

  return (
    <main className="relative min-h-screen bg-[#0C0F0E]">
      <SabHeroBackdrop height={420}>
      <HubNav data={hubNav} calcMode={resolvedSearchParams.tab === 'cash' ? 'cash' : 'trade'} />
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          {
            name: 'Steal a Brainrot',
            path: '/steal-a-brainrot',
          },
          {
            name: 'Calculator',
            path: '/steal-a-brainrot/calculator',
          },
        ])}
      />
      {/* SoftwareApplication — marks the calculator as a free web tool (parity
          with the Adopt Me calculator, which already emits this). */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Steal a Brainrot WFL Calculator',
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        }}
      />

      <CalculatorClient
        brainrots={brainrots}
        mutations={mutations}
        cashPrices={cashPrices}
        tradePrices={tradePrices}
        initialBrainrotSlug={resolvedSearchParams.brainrot}
        initialMutationSlug={resolvedSearchParams.mutation}
        // WFL is the page's job now. Cash prices already have a whole page
        // (/values), so they stay available here as the secondary tab but no
        // longer greet everyone who lands on the calculator.
        initialTab={resolvedSearchParams.tab === 'cash' ? 'cash' : 'trade'}
      />

      {/* Guides strip — routes a trader who just checked a price into the
          guides that explain the result (self-hides with no tagged posts). */}
      <div className="pt-12">
        <HubGuidesStrip
          gameSlug="steal-a-brainrot"
          heading="Trading Guides That Explain Your Result"
        />
      </div>

      {/* Buy CTA — price/tool pages carry the BUY band; the seller band lives
          on the blog surfaces. */}
      <HubBuyCta gameName="Steal a Brainrot" gameSlug="steal-a-brainrot" buyHref="/steal-a-brainrot/buy-items" />

      <CalculatorSeo monthYear={monthYear} topValues={topValues} lastUpdated={lastUpdated} />
      <JsonLd data={faqPage(CALCULATOR_FAQ)} />
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
