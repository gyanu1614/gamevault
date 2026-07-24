import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import TradeCalculatorClient, {
  type TradeBrainrot,
  type TradeMutation,
  type TradeOverride,
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
  base_income_per_second: number | string | null
  image_url: string | null
}

type MutationRow = {
  id: string
  name: string
  slug: string
  income_multiplier: number | string
}

type OverrideRow = {
  brainrot_id: string
  mutation_id: string
  calculated_income_per_second: number | string | null
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params

  if (gameSlug !== 'steal-a-brainrot') {
    return { title: 'Trade Calculator Not Found' }
  }

  return {
    title: 'Steal a Brainrot Trade Calculator',
    description:
      'Compare both sides of a Steal a Brainrot trade using mutation-adjusted income values. See Win, Fair, or Loss instantly.',
    alternates: { canonical: '/steal-a-brainrot/trade-calculator' },
    openGraph: {
      title: 'Steal a Brainrot Trade Calculator',
      description:
        'Add Brainrots and mutations to both sides of a trade and compare the total value difference.',
      url: '/steal-a-brainrot/trade-calculator',
      type: 'website',
    },
  }
}

async function getTradeCalculatorData(): Promise<{
  brainrots: TradeBrainrot[]
  mutations: TradeMutation[]
  overrides: TradeOverride[]
}> {
  const supabase = await createClient()

  const [brainrotResult, mutationResult, overrideResult] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_catalog')
      .select('id,name,slug,rarity,base_income_per_second,image_url')
      .order('name', { ascending: true }),
    (supabase as any)
      .from('sab_mutation_catalog')
      .select('id,name,slug,income_multiplier')
      .order('income_multiplier', { ascending: true }),
    (supabase as any)
      .from('sab_brainrot_mutation_calculator')
      .select('brainrot_id,mutation_id,calculated_income_per_second')
      .eq('is_verified_variant', true),
  ])

  if (brainrotResult.error) {
    console.error('Unable to load trade calculator Brainrots:', brainrotResult.error)
  }

  if (mutationResult.error) {
    console.error('Unable to load trade calculator mutations:', mutationResult.error)
  }

  if (overrideResult.error) {
    console.error('Unable to load trade calculator overrides:', overrideResult.error)
  }

  const brainrots = ((brainrotResult.data ?? []) as BrainrotRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    rarity: row.rarity,
    baseIncomePerSecond: asNumber(row.base_income_per_second),
    imageUrl: row.image_url,
  }))

  const mutations = ((mutationResult.data ?? []) as MutationRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    multiplier: Number(row.income_multiplier),
  }))

  const overrides = ((overrideResult.data ?? []) as OverrideRow[])
    .map((row) => {
      const incomePerSecond = asNumber(row.calculated_income_per_second)
      if (incomePerSecond == null) return null

      return {
        brainrotId: row.brainrot_id,
        mutationId: row.mutation_id,
        incomePerSecond,
      }
    })
    .filter((row): row is TradeOverride => row !== null)

  return { brainrots, mutations, overrides }
}

export default async function SabTradeCalculatorPage({ params }: PageProps) {
  const { gameSlug } = await params

  if (gameSlug !== 'steal-a-brainrot') {
    notFound()
  }

  const { brainrots, mutations, overrides } = await getTradeCalculatorData()

  return (
    <main className="min-h-screen pb-24">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Steal a Brainrot', path: '/steal-a-brainrot' },
          { name: 'Trade Calculator', path: '/steal-a-brainrot/trade-calculator' },
        ])}
      />

      <section className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14 lg:px-8">
          <nav className="mb-6 flex items-center gap-2 text-sm text-text-tertiary">
            <Link
              href="/steal-a-brainrot"
              className="transition-colors hover:text-text-primary"
            >
              Steal a Brainrot
            </Link>
            <ArrowRight className="h-4 w-4" />
            <span className="text-text-primary">Trade Calculator</span>
          </nav>

          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-lime-text">
              Free SAB trade checker
            </p>

            <h1 className="text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
              Steal a Brainrot Trade Calculator
            </h1>

            <p className="mt-5 text-lg leading-8 text-text-secondary">
              Add Brainrots to both sides, choose mutations and quantities, then compare the total mutation-adjusted income value.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8">
        <TradeCalculatorClient
          brainrots={brainrots}
          mutations={mutations}
          overrides={overrides}
        />
      </section>
    </main>
  )
}
