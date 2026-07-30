import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import ValuesDirectoryClient, {
  type BrainrotDirectoryItem,
} from './_ValuesDirectoryClient'
import { SabHeroBackdrop } from './_SabHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { getHubNavData } from '@/lib/content/hubNav'

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

  const [brainrots, hubNav] = await Promise.all([
    getBrainrots(),
    getHubNavData(gameSlug),
  ])

  // Real "highest tracked value" for the hero stat — the top default-mutation
  // price across the catalog. Omitted (—) if nothing is priced yet.
  const highestValue = brainrots.reduce<number>((max, b) => {
    const v = Number(b.display_price_usd)
    return Number.isFinite(v) && v > max ? v : max
  }, 0)
  const highestValueLabel =
    highestValue > 0
      ? highestValue.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
        })
      : null

  return (
    <main className="relative min-h-screen bg-[#0C0F0E] pb-24">
      <SabHeroBackdrop>
      <HubNav data={hubNav} />
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Steal a Brainrot', path: '/steal-a-brainrot' },
          { name: 'Values', path: '/steal-a-brainrot/values' },
        ])}
      />

      <section>
        {/* pt clears the fixed HubNav; visible breadcrumb removed (JSON-LD
            above keeps the SERP breadcrumb). */}
        <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-[92px] sm:px-6 lg:px-8">

          {/* Design hero: live badge + big title, stat block on the right.
              Stats show only metrics we can source — no fabricated 24h volume
              or seller counts. */}
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 border border-[#23331F] bg-[#0E1A11] px-3 py-2">
                <span className="h-1.5 w-1.5 animate-pulse bg-[#3FA35C]" />
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#8FBF9C]">
                  Priced from real sales
                </span>
              </div>
              <h1 className="text-[32px] font-bold leading-[1.04] tracking-[-0.03em] text-[#F2F6F0] sm:text-[40px] lg:text-[52px]">
                Steal a Brainrot value list
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#98A398] sm:text-[17px]">
                Real cash values from completed DropMarket sales — not community
                guesses. Every Brainrot, its income per second, and what it
                trades for right now.
              </p>
            </div>

            <div className="grid w-full shrink-0 grid-cols-2 gap-px overflow-hidden border border-[#1A211A] bg-[#1A211A] sm:w-auto sm:min-w-[380px]">
              <div className="bg-[#0A0D0B] p-5">
                <div className="mb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#5E685E]">
                  Tracked
                </div>
                <div className="text-[24px] font-bold text-[#F2F6F0] tabular-nums">
                  {brainrots.length.toLocaleString()}
                </div>
              </div>
              <div className="bg-[#0A0D0B] p-5">
                <div className="mb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#5E685E]">
                  Highest
                </div>
                <div className="text-[24px] font-bold text-[#8FBF9C] tabular-nums">
                  {highestValueLabel ?? '—'}
                </div>
              </div>
              <div className="col-span-2 bg-[#0A0D0B] p-5">
                <div className="mb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#5E685E]">
                  Priced from
                </div>
                <div className="text-[20px] font-bold text-[#F2F6F0]">
                  Completed sales &amp; active listings
                </div>
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
