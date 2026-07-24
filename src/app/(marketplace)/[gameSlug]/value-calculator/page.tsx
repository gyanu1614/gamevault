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

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  if (gameSlug !== 'steal-a-brainrot') return { title: 'Calculator Not Found' }

  return {
    title: 'Steal a Brainrot Value Calculator',
    description:
      'Calculate Steal a Brainrot income for every Brainrot and mutation. Compare per-second, per-minute, hourly, and daily earnings.',
    alternates: { canonical: '/steal-a-brainrot/value-calculator' },
    openGraph: {
      title: 'Steal a Brainrot Value Calculator',
      description:
        'Choose any Brainrot and mutation to calculate income per second, minute, hour, and day.',
      url: '/steal-a-brainrot/value-calculator',
      type: 'website',
    },
  }
}

async function getCalculatorData(): Promise<{
  brainrots: CalculatorBrainrot[]
  mutations: CalculatorMutation[]
  overrides: CalculatorOverride[]
}> {
  const supabase = await createClient()

  const [brainrotResult, mutationResult, overrideResult] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_catalog')
      .select('id,name,slug,rarity,base_income_per_second,image_url')
      .order('name', { ascending: true }),
    (supabase as any)
      .from('sab_mutation_catalog')
      .select('id,name,slug,income_multiplier,availability')
      .order('income_multiplier', { ascending: true }),
    (supabase as any)
      .from('sab_brainrot_mutation_calculator')
      .select('brainrot_id,mutation_id,calculated_income_per_second,income_source')
      .eq('is_verified_variant', true),
  ])

  if (brainrotResult.error) {
    console.error('Unable to load calculator Brainrots:', brainrotResult.error)
  }
  if (mutationResult.error) {
    console.error('Unable to load calculator mutations:', mutationResult.error)
  }
  if (overrideResult.error) {
    console.error('Unable to load verified mutation overrides:', overrideResult.error)
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
    availability: row.availability,
  }))

  const overrides = ((overrideResult.data ?? []) as OverrideRow[])
    .map((row) => {
      const incomePerSecond = asNumber(row.calculated_income_per_second)
      if (incomePerSecond == null) return null
      return {
        brainrotId: row.brainrot_id,
        mutationId: row.mutation_id,
        incomePerSecond,
        incomeSource: row.income_source,
      }
    })
    .filter((row): row is CalculatorOverride => row !== null)

  return { brainrots, mutations, overrides }
}

export default async function SabValueCalculatorPage({ params, searchParams }: PageProps) {
  const [{ gameSlug }, resolvedSearchParams] = await Promise.all([params, searchParams])
  if (gameSlug !== 'steal-a-brainrot') notFound()

  const { brainrots, mutations, overrides } = await getCalculatorData()

  return (
    <main className="min-h-screen pb-24">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Steal a Brainrot', path: '/steal-a-brainrot' },
          { name: 'Value Calculator', path: '/steal-a-brainrot/value-calculator' },
        ])}
      />

      <section className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14 lg:px-8">
          <nav className="mb-6 flex items-center gap-2 text-sm text-text-tertiary">
            <Link href="/steal-a-brainrot" className="transition-colors hover:text-text-primary">
              Steal a Brainrot
            </Link>
            <ArrowRight className="h-4 w-4" />
            <span className="text-text-primary">Value Calculator</span>
          </nav>

          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-lime-text">
              Free SAB calculator
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
              Steal a Brainrot Value Calculator
            </h1>
            <p className="mt-5 text-lg leading-8 text-text-secondary">
              Choose any Brainrot and mutation to calculate estimated income per second, minute, hour, and day.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <ValueCalculatorClient
          brainrots={brainrots}
          mutations={mutations}
          overrides={overrides}
          initialBrainrotSlug={resolvedSearchParams.brainrot}
          initialMutationSlug={resolvedSearchParams.mutation}
        />
      </section>
    </main>
  )
}
