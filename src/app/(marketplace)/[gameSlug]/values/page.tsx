import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Calculator, Search, ShoppingCart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import ValuesDirectoryClient, {
  type BrainrotDirectoryItem,
} from './_ValuesDirectoryClient'
import { ValuesHeader } from './_ValuesHeader'
import { SabHeroBackdrop } from './_SabHeroBackdrop'
import { SabSubNav } from './_SabSubNav'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

type DirectoryTradePriceRow = {
  brainrot_id: string
  market_value_usd: number | string | null
  confidence_label: string | null
  is_trade_ready: boolean
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

  const [brainrotResult, priceResult] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_market_catalog')
      .select(
        'id,name,slug,rarity,obtainability,base_income_per_second,image_url,display_price_usd,display_price_label,display_price_source,confidence_label',
      )
      .order('name', { ascending: true }),

    (supabase as any)
      .from('sab_public_price_catalog')
      .select(
        'brainrot_id,market_value_usd,confidence_label,is_trade_ready',
      )
      .eq('mutation_slug', 'default'),
  ])

  if (brainrotResult.error) {
    console.error(
      'Unable to load SAB values directory:',
      brainrotResult.error,
    )
    return []
  }

  if (priceResult.error) {
    console.error(
      'Unable to load SAB directory market prices:',
      priceResult.error,
    )
  }

  const priceByBrainrot = new Map(
    ((priceResult.data ?? []) as DirectoryTradePriceRow[])
      .filter(
        (row) =>
          row.market_value_usd != null &&
          Number.isFinite(Number(row.market_value_usd)),
      )
      .map((row) => [row.brainrot_id, row]),
  )

  return (
    (brainrotResult.data ?? []) as BrainrotDirectoryItem[]
  ).map((brainrot) => {
    const price = priceByBrainrot.get(brainrot.id)

    if (!price) return brainrot

    return {
      ...brainrot,
      display_price_usd: Number(price.market_value_usd),
      display_price_label: 'Average Current Market Price',
      display_price_source: 'public_market_estimate',
      confidence_label:
        price.confidence_label ?? brainrot.confidence_label,
    }
  })
}

export default async function BrainrotValuesPage({ params }: PageProps) {
  const { gameSlug } = await params

  if (gameSlug !== 'steal-a-brainrot') {
    notFound()
  }

  const brainrots = await getBrainrots()

  return (
    <main className="relative min-h-screen bg-[#0C0F0E] pb-24">
      <SabHeroBackdrop>
      <ValuesHeader gameName="Steal a Brainrot" buyHref="/steal-a-brainrot/buy-items" />
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Steal a Brainrot', path: '/steal-a-brainrot' },
          { name: 'Values', path: '/steal-a-brainrot/values' },
        ])}
      />

      <SabSubNav />

      <section>
        <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
          <nav className="mb-4 flex items-center gap-1.5 text-[12.5px] text-[#6D7A72]">
            <Link
              href="/steal-a-brainrot"
              className="transition-colors hover:text-[#F1F3F1]"
            >
              Brainrot
            </Link>
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="text-[#E6EAE7]">Values</span>
          </nav>

          {/* Two-column hero: copy left, actions right (fills the empty space). */}
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#4FB477]">
                DropMarket value database
              </p>
              <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-[#F1F3F1] sm:text-[28px] lg:text-[32px]">
                Steal a Brainrot Values
              </h1>
              <p className="mt-2 text-[13px] leading-6 text-[#9BA8A0] sm:text-sm">
                Compare every Brainrot by rarity, base income, obtainability,
                mutation income, and verified marketplace pricing.
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row lg:flex-col lg:items-end">
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/steal-a-brainrot/calculator"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1B6B3F] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_-4px_rgba(27,107,63,0.6)] transition hover:bg-[#1f7a48]"
                >
                  <Calculator className="h-4 w-4" />
                  Open value calculator
                </Link>
                <Link
                  href="/steal-a-brainrot/buy-items"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#26332C] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-[#E6EAE7] transition hover:border-[#2A3A31] hover:bg-white/[0.06]"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Browse marketplace
                </Link>
              </div>
              <div className="inline-flex items-center gap-2 self-start rounded-lg border border-[#1E2723] bg-[#111613] px-4 py-2.5 text-sm text-[#9BA8A0] lg:self-end">
                <Search className="h-4 w-4 text-[#4FB477]" />
                <span className="tabular-nums">{brainrots.length.toLocaleString()}</span> Brainrots in the database
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        {brainrots.length === 0 ? (
          <div className="rounded-lg border border-[#1E2723] bg-[#121613] px-6 py-12 text-center">
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
      </SabHeroBackdrop>
    </main>
  )
}
