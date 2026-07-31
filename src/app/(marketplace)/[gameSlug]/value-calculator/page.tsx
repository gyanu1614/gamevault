import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import ValueCalculatorClient, {
  type CalculatorBrainrot,
  type CalculatorMutation,
  type CalculatorOverride,
  type CalculatorPrice,
} from './_ValueCalculatorClient'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ gameSlug: string }>
  searchParams: Promise<{
    brainrot?: string
    mutation?: string
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

type OverrideRow = {
  brainrot_id: string
  mutation_id: string
  calculated_income_per_second: number | string | null
  income_source: string
}

type PriceRow = {
  brainrot_id: string
  mutation_id: string
  market_value_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
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
    return { title: 'Calculator Not Found' }
  }

  return {
    title: 'Steal a Brainrot Value Calculator',
    description:
      'Check current market prices and calculate mutation income for Steal a Brainrot items.',
    alternates: {
      canonical: '/steal-a-brainrot/value-calculator',
    },
    openGraph: {
      title: 'Steal a Brainrot Value Calculator',
      description:
        'Choose a Brainrot and mutation to compare its current market price and income.',
      url: '/steal-a-brainrot/value-calculator',
      type: 'website',
    },
  }
}

async function getAllCalculatorPrices(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PriceRow[]> {
  const pageSize = 1000
  const rows: PriceRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await (supabase as any)
      .from('sab_public_price_catalog_corrected')
      .select(
        'brainrot_id,mutation_id,market_value_usd,market_low_usd,market_high_usd,confidence_label,external_sample_size,price_updated_at,is_trade_ready',
      )
      .range(from, from + pageSize - 1)

    if (error) {
      console.error(
        'Unable to load value-calculator market prices:',
        error,
      )
      break
    }

    const page = (data ?? []) as PriceRow[]
    rows.push(...page)

    if (page.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function getCalculatorData(): Promise<{
  brainrots: CalculatorBrainrot[]
  mutations: CalculatorMutation[]
  overrides: CalculatorOverride[]
  prices: CalculatorPrice[]
}> {
  const supabase = await createClient()

  const [
    brainrotResult,
    mutationResult,
    overrideResult,
    priceRows,
  ] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_catalog')
      .select(
        'id,name,slug,rarity,base_income_per_second,image_url',
      )
      .order('name', { ascending: true }),

    (supabase as any)
      .from('sab_mutation_catalog')
      .select('id,name,slug,income_multiplier,availability')
      .order('income_multiplier', { ascending: true }),

    (supabase as any)
      .from('sab_brainrot_mutation_calculator')
      .select(
        'brainrot_id,mutation_id,calculated_income_per_second,income_source',
      )
      .eq('is_verified_variant', true),

    getAllCalculatorPrices(supabase),
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

  if (overrideResult.error) {
    console.error(
      'Unable to load verified mutation overrides:',
      overrideResult.error,
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

  const overrides = (
    (overrideResult.data ?? []) as OverrideRow[]
  )
    .map((row) => {
      const incomePerSecond = asNumber(
        row.calculated_income_per_second,
      )

      if (incomePerSecond == null) return null

      return {
        brainrotId: row.brainrot_id,
        mutationId: row.mutation_id,
        incomePerSecond,
        incomeSource: row.income_source,
      }
    })
    .filter(
      (row): row is CalculatorOverride => row !== null,
    )

  const prices = priceRows
    .map((row): CalculatorPrice | null => {
      const marketValueUsd = asNumber(row.market_value_usd)

      if (marketValueUsd == null) {
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
        confidenceLabel:
          row.confidence_label ?? 'insufficient',
        sampleSize: row.external_sample_size ?? 0,
        priceUpdatedAt: row.price_updated_at,
        isTradeReady: row.is_trade_ready,
      }
    })
    .filter((row): row is CalculatorPrice => row !== null)

  return {
    brainrots,
    mutations,
    overrides,
    prices,
  }
}

export default async function SabValueCalculatorPage({
  params,
  searchParams,
}: PageProps) {
  const [{ gameSlug }, resolvedSearchParams] =
    await Promise.all([params, searchParams])

  if (gameSlug !== 'steal-a-brainrot') notFound()

  const {
    brainrots,
    mutations,
    overrides,
    prices,
  } = await getCalculatorData()

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
            name: 'Value Calculator',
            path: '/steal-a-brainrot/value-calculator',
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
              Value Calculator
            </span>
          </nav>

          <div className="max-w-3xl">
            <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
              Market value and income
            </p>
            <h1 className="text-[22px] font-black leading-tight tracking-tight text-text-primary sm:text-[28px] lg:text-[32px]">
              Steal a Brainrot Value Calculator
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-text-secondary sm:text-sm">
              Select a Brainrot and mutation to view its current
              market price, typical range, and compact income
              estimates.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-8 lg:px-8">
        <ValueCalculatorClient
          brainrots={brainrots}
          mutations={mutations}
          overrides={overrides}
          prices={prices}
          initialBrainrotSlug={
            resolvedSearchParams.brainrot
          }
          initialMutationSlug={
            resolvedSearchParams.mutation
          }
        />
      </section>
    </main>
  )
}
