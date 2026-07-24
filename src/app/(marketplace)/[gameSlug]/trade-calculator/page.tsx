import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import TradeCalculatorClient, {
  type TradeBrainrot,
  type TradeMutation,
  type TradePrice,
} from './_TradeCalculatorClient'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

type BrainrotRow = {
  id: string
  name: string
  slug: string
  rarity: string
  image_url: string | null
}

type MutationRow = {
  id: string
  name: string
  slug: string
  income_multiplier: number | string
}

type TradePriceRow = {
  brainrot_id: string
  mutation_id: string
  market_value_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  price_source_type: string | null
  price_source_name: string | null
  confidence_label: string | null
  external_sample_size: number | null
  price_updated_at: string | null
  is_trade_ready: boolean
}

function asNumber(
  value: number | string | null | undefined,
): number | null {
  if (value == null) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { gameSlug } = await params

  if (gameSlug !== 'steal-a-brainrot') {
    return { title: 'Trade Calculator Not Found' }
  }

  return {
    title: 'Steal a Brainrot Trade Calculator',
    description:
      'Compare Steal a Brainrot trades using cash-market estimates, completed sales, listing ranges, mutations, and confidence-aware Win, Fair, or Loss results.',
    alternates: {
      canonical: '/steal-a-brainrot/trade-calculator',
    },
    openGraph: {
      title: 'Steal a Brainrot Trade Calculator',
      description:
        'Compare both sides of a SAB trade using mutation-specific cash-market values.',
      url: '/steal-a-brainrot/trade-calculator',
      type: 'website',
    },
  }
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
        'brainrot_id,mutation_id,market_value_usd,market_low_usd,market_high_usd,price_source_type,price_source_name,confidence_label,external_sample_size,price_updated_at,is_trade_ready',
      )
      .eq('is_trade_ready', true)
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('Unable to load SAB cash trade prices:', error)
      break
    }

    const page = (data ?? []) as TradePriceRow[]
    rows.push(...page)

    if (page.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function getTradeCalculatorData(): Promise<{
  brainrots: TradeBrainrot[]
  mutations: TradeMutation[]
  prices: TradePrice[]
}> {
  const supabase = await createClient()

  const [brainrotResult, mutationResult, priceRows] =
    await Promise.all([
      (supabase as any)
        .from('sab_brainrot_catalog')
        .select('id,name,slug,rarity,image_url')
        .order('name', { ascending: true }),

      (supabase as any)
        .from('sab_mutation_catalog')
        .select('id,name,slug,income_multiplier')
        .order('income_multiplier', { ascending: true }),

      getAllTradePrices(supabase),
    ])

  if (brainrotResult.error) {
    console.error(
      'Unable to load trade calculator Brainrots:',
      brainrotResult.error,
    )
  }

  if (mutationResult.error) {
    console.error(
      'Unable to load trade calculator mutations:',
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
    imageUrl: row.image_url,
  }))

  const mutations = (
    (mutationResult.data ?? []) as MutationRow[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    multiplier: Number(row.income_multiplier),
  }))

  const prices = priceRows
    .map((row): TradePrice | null => {
      const marketValueUsd = asNumber(row.market_value_usd)

      if (!row.is_trade_ready || marketValueUsd == null) {
        return null
      }

      return {
        brainrotId: row.brainrot_id,
        mutationId: row.mutation_id,
        marketValueUsd,
        marketLowUsd:
          asNumber(row.market_low_usd) ?? marketValueUsd,
        marketHighUsd:
          asNumber(row.market_high_usd) ?? marketValueUsd,
        sourceType: row.price_source_type ?? 'unknown',
        sourceName: row.price_source_name,
        confidenceLabel:
          row.confidence_label ?? 'insufficient',
        sampleSize: row.external_sample_size ?? 0,
        priceUpdatedAt: row.price_updated_at,
        isTradeReady: row.is_trade_ready,
      }
    })
    .filter((row): row is TradePrice => row !== null)

  return { brainrots, mutations, prices }
}

export default async function SabTradeCalculatorPage({
  params,
}: PageProps) {
  const { gameSlug } = await params

  if (gameSlug !== 'steal-a-brainrot') {
    notFound()
  }

  const { brainrots, mutations, prices } =
    await getTradeCalculatorData()

  return (
    <main className="min-h-screen pb-24">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          {
            name: 'Steal a Brainrot',
            path: '/steal-a-brainrot',
          },
          {
            name: 'Trade Calculator',
            path: '/steal-a-brainrot/trade-calculator',
          },
        ])}
      />

      <section className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-7xl px-4 pb-7 pt-5 sm:px-6 sm:pb-8 sm:pt-6 lg:px-8">
          <nav className="mb-4 flex items-center gap-2 text-[12.5px] text-text-tertiary">
            <Link
              href="/steal-a-brainrot"
              className="transition-colors hover:text-text-primary"
            >
              Steal a Brainrot
            </Link>

            <ArrowRight className="h-4 w-4" />
            <span className="text-text-primary">
              Trade Calculator
            </span>
          </nav>

          <div className="max-w-3xl">
            <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
              Cash-market trade checker
            </p>

            <h1 className="text-[22px] font-black leading-tight tracking-tight text-text-primary sm:text-[28px] lg:text-[32px]">
              Steal a Brainrot Trade Calculator
            </h1>

            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-text-secondary sm:text-sm">
              Compare mutation-specific cash-market estimates,
              completed sales, and verified price ranges to check
              whether a trade is a Win, Fair, Loss, or Uncertain.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6 sm:py-8 lg:px-8">
        <TradeCalculatorClient
          brainrots={brainrots}
          mutations={mutations}
          prices={prices}
        />
      </section>
    </main>
  )
}
