import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

type BrainrotMarketRow = {
  id: string
  name: string
  slug: string
  rarity: string
  obtainability: string
  base_income_per_second: number | string | null
  image_url: string | null
  display_price_usd: number | string | null
  display_price_label: string
  display_price_source: string
  confidence_label: string
}

function formatMoney(value: number | string | null): string | null {
  if (value == null) return null
  const amount = Number(value)
  if (!Number.isFinite(amount)) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount < 10 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatIncome(value: number | string | null): string {
  if (value == null) return 'Unknown'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 'Unknown'
  return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}/s`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  if (gameSlug !== 'steal-a-brainrot') return { title: 'Values Not Found' }

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

async function getBrainrots(): Promise<BrainrotMarketRow[]> {
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

  return (data ?? []) as BrainrotMarketRow[]
}

export default async function BrainrotValuesPage({ params }: PageProps) {
  const { gameSlug } = await params
  if (gameSlug !== 'steal-a-brainrot') notFound()

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
        <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14 lg:px-8">
          <nav className="mb-6 flex items-center gap-2 text-sm text-text-tertiary">
            <Link href="/steal-a-brainrot" className="transition-colors hover:text-text-primary">
              Steal a Brainrot
            </Link>
            <ArrowRight className="h-4 w-4" />
            <span className="text-text-primary">Values</span>
          </nav>

          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-lime-text">
              DropMarket value database
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
              Steal a Brainrot Values
            </h1>
            <p className="mt-5 text-lg leading-8 text-text-secondary">
              Compare every Brainrot by rarity, base income, obtainability, mutation income, and verified marketplace pricing.
            </p>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-overlay px-4 py-3 text-sm text-text-secondary">
            <Search className="h-4 w-4 text-lime-text" />
            {brainrots.length.toLocaleString()} Brainrots in the database
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {brainrots.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-bg-overlay px-6 py-12 text-center">
            <h2 className="text-xl font-bold text-text-primary">Values are temporarily unavailable</h2>
            <p className="mt-2 text-text-secondary">The Brainrot database could not be loaded. Please check again shortly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {brainrots.map((brainrot) => {
              const displayPrice = formatMoney(brainrot.display_price_usd)

              return (
                <Link
                  key={brainrot.id}
                  href={`/steal-a-brainrot/values/${brainrot.slug}`}
                  className="group overflow-hidden rounded-2xl border border-border-subtle bg-bg-overlay transition hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className="aspect-square overflow-hidden bg-black/20">
                    {brainrot.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brainrot.image_url}
                        alt={`${brainrot.name} Steal a Brainrot`}
                        loading="lazy"
                        className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-text-tertiary">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="p-3 sm:p-4">
                    <h2 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-text-primary sm:text-base">
                      {brainrot.name}
                    </h2>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-text-tertiary">
                      <span>{brainrot.rarity}</span>
                      <span>{formatIncome(brainrot.base_income_per_second)}</span>
                    </div>
                    <div className="mt-3 border-t border-border-subtle pt-3">
                      {displayPrice ? (
                        <p className="text-sm font-bold text-text-primary">
                          {brainrot.display_price_label} {displayPrice}
                        </p>
                      ) : (
                        <p className="text-xs leading-5 text-text-tertiary">Not enough verified market data</p>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
