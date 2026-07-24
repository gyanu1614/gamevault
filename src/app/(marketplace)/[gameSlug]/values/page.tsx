import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Calculator, Search, ShoppingCart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import ValuesDirectoryClient, {
  type BrainrotDirectoryItem,
} from './_ValuesDirectoryClient'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { gameSlug } = await params

  if (gameSlug !== 'steal-a-brainrot') {
    return { title: 'Values Not Found' }
  }

  return {
    title: 'Steal a Brainrot Values, Prices & Income',
    description:
      'Browse Steal a Brainrot values, income, rarity, obtainability, mutations, and live DropMarket pricing for every Brainrot.',
    alternates: { canonical: '/steal-a-brainrot/values' },
    openGraph: {
      title: 'Steal a Brainrot Values, Prices & Income',
      description:
        'Compare Brainrot values, income, rarity, mutations, and live marketplace pricing.',
      url: '/steal-a-brainrot/values',
      type: 'website',
    },
  }
}

async function getBrainrots(): Promise<BrainrotDirectoryItem[]> {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('sab_brainrot_market_catalog')
    .select(
      'id,name,slug,rarity,obtainability,base_income_per_second,image_url,display_price_usd,display_price_label,display_price_source,confidence_label',
    )
    .order('name', { ascending: true })

  if (error) {
    console.error('Unable to load SAB values directory:', error)
    return []
  }

  return (data ?? []) as BrainrotDirectoryItem[]
}

export default async function BrainrotValuesPage({ params }: PageProps) {
  const { gameSlug } = await params

  if (gameSlug !== 'steal-a-brainrot') {
    notFound()
  }

  const brainrots = await getBrainrots()

  return (
    <main className="min-h-screen pb-24">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Steal a Brainrot', path: '/steal-a-brainrot' },
          { name: 'Values', path: '/steal-a-brainrot/values' },
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
            <span className="text-text-primary">Values</span>
          </nav>

          <div className="max-w-3xl">
            <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
              DropMarket value database
            </p>

            <h1 className="text-[22px] font-black leading-tight tracking-tight text-text-primary sm:text-[28px] lg:text-[32px]">
              Steal a Brainrot Values
            </h1>

            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-text-secondary sm:text-sm">
              Compare every Brainrot by rarity, base income, obtainability,
              mutation income, and verified marketplace pricing.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/steal-a-brainrot/value-calculator"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime-text px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
            >
              <Calculator className="h-4 w-4" />
              Open value calculator
            </Link>

            <Link
              href="/steal-a-brainrot/buy-items"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-subtle px-5 py-2.5 text-sm font-semibold text-text-primary transition hover:border-white/20"
            >
              <ShoppingCart className="h-4 w-4" />
              Browse marketplace
            </Link>
          </div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-overlay px-4 py-3 text-sm text-text-secondary">
            <Search className="h-4 w-4 text-lime-text" />
            {brainrots.length.toLocaleString()} Brainrots in the database
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-8 lg:px-8">
        {brainrots.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-bg-overlay px-6 py-12 text-center">
            <h2 className="text-xl font-bold text-text-primary">
              Values are temporarily unavailable
            </h2>
            <p className="mt-2 text-text-secondary">
              The Brainrot database could not be loaded. Please check again
              shortly.
            </p>
          </div>
        ) : (
          <ValuesDirectoryClient brainrots={brainrots} />
        )}
      </section>
    </main>
  )
}
