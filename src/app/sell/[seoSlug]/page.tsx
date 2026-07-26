/**
 * Programmatic SEO Landing Pages — /sell/[seoSlug]  (SELLER intent)
 *
 * Sibling of /buy/[seoSlug]. Server-rendered pages targeting seller queries
 * like "sell roblox account", "sell fortnite account", "sell game currency".
 *
 * Each page renders:
 *   - SEO meta + structured data (FAQPage + HowTo)
 *   - Hero with a seller pitch (low fees, safe payouts)
 *   - "How selling works" 3-step strip
 *   - Live market activity for the game/category (proof buyers are here)
 *   - Seller-side trust signals
 *   - FAQ accordion
 *   - CTA into the founding-seller programme (/early-seller)
 */

import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSellPage, getAllSellPageSlugs, SellPage } from '@/lib/seo/sellPages'
import { getGameIcon } from '@/features/home/lib/game-icons'
import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'
import { FaqCards } from '@/components/marketplace/FaqCards'
import { HowSellingWorks } from './_HowSellingWorks'
import type { ListingWithRelations } from '@/types/database'

import { SITE_URL } from '@/config/site'

const BASE_URL = SITE_URL

/* ------------------------------------------------------------------ */
/* Static params                                                        */
/* ------------------------------------------------------------------ */

export async function generateStaticParams() {
  return getAllSellPageSlugs().map((slug) => ({ seoSlug: slug }))
}

/* ------------------------------------------------------------------ */
/* Metadata                                                             */
/* ------------------------------------------------------------------ */

export async function generateMetadata(
  { params }: { params: { seoSlug: string } },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const page = getSellPage(params.seoSlug)
  if (!page) return {}

  const url = `${BASE_URL}/sell/${page.slug}`

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: 'DropMarket',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Data fetching — live market activity for this game/category         */
/* ------------------------------------------------------------------ */

async function getMarketListings(page: SellPage) {
  const supabase = await createClient()

  let query = supabase
    .from('listings')
    .select(
      `
      id, slug, title, price, currency, delivery_time, sales,
      seller:profiles!listings_seller_id_fkey(id, username, seller_rating),
      game:games!listings_game_id_fkey(id, name, slug, emoji),
      category:categories!listings_category_id_fkey(id, name, slug, icon)
    `,
    )
    .eq('status', 'active')
    .order('sales', { ascending: false })
    .limit(8)

  if (page.gameSlug) {
    const { data: game } = await supabase
      .from('games')
      .select('id')
      .eq('slug', page.gameSlug)
      .single() as { data: { id: string } | null; error: unknown }
    if (game) query = query.eq('game_id', game.id)
  }

  if (page.categorySlug) {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', page.categorySlug)
      .single() as { data: { id: string } | null; error: unknown }
    if (category) query = query.eq('category_id', category.id)
  }

  const { data, error } = await query
  if (error) return []
  return (data ?? []) as unknown as ListingWithRelations[]
}

/* ------------------------------------------------------------------ */
/* Schema.org JSON-LD — FAQPage + HowTo                                 */
/* ------------------------------------------------------------------ */

function buildStructuredData(page: SellPage) {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  }

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to sell your ${page.assetLabel} on DropMarket`,
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'List it free',
        text: `Create your ${page.assetLabel} listing in minutes. Listing is free — you only pay commission when it sells.`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Buyer pays into SafeDrop',
        text: 'The buyer pays up front into SafeDrop before you deliver, so you never hand over goods hoping to be paid.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Get paid safely',
        text: 'Once the buyer confirms delivery, your proceeds are released to your Seller Balance — protected from chargebacks.',
      },
    ],
  }

  return { faqSchema, howToSchema }
}

/* ------------------------------------------------------------------ */
/* Page component                                                       */
/* ------------------------------------------------------------------ */

export default async function SellSEOLandingPage({
  params,
}: {
  params: { seoSlug: string }
}) {
  const page = getSellPage(params.seoSlug)
  if (!page) notFound()

  const listings = await getMarketListings(page)
  const { faqSchema, howToSchema } = buildStructuredData(page)

  const marketHref = page.gameSlug
    ? `/${page.gameSlug}${page.categorySlug ? `/${page.categorySlug}` : ''}`
    : '/browse'

  // Real game logo (from the shared /games registry) instead of an emoji.
  const logoSrc = page.gameSlug ? getGameIcon(page.gameSlug) : null

  return (
    <>
      {/* Preload the hero backdrop so it's cached before .hero-backdrop mounts. */}
      <HeroBackdropPreload name="home" />

      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />

      {/* Shared DropMarket hero backdrop (same art + scrim as the homepage),
          spanning the hero band and fading into the page below it. */}
      <HeroBackdrop name="home">
        {/* ---- Hero ---- */}
        <section className="relative px-4 pt-14 pb-16 sm:pt-16 sm:pb-20">
          <div className="mx-auto max-w-3xl text-center">
            {logoSrc && (
              <Image
                src={logoSrc}
                alt={`${page.assetLabel} logo`}
                width={72}
                height={72}
                className="mx-auto mb-6 h-16 w-16 rounded-2xl object-cover shadow-[0_10px_30px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
              />
            )}

            <h1 className="font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-foreground [text-shadow:0_2px_24px_rgba(0,0,0,0.6)] sm:text-5xl md:text-6xl">
              {page.headline}
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground [text-shadow:0_1px_12px_rgba(0,0,0,0.7)] sm:text-lg">
              {page.subCopy}
            </p>

            {/* Value props — floating, no boxes */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              {['Free to list', 'Commission from 5% — only when it sells', 'Chargeback-protected payouts'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/early-seller"
                className="inline-flex items-center gap-2 rounded-lg bg-lime px-6 py-3 text-sm font-semibold text-text-inverse transition-all duration-200 hover:bg-lime-hover hover:shadow-glow"
              >
                Start selling
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/fees"
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                See the fees
              </Link>
            </div>
          </div>
        </section>

        {/* ---- How selling works — animated flow (client) ---- */}
        <section className="px-4 py-14">
          <HowSellingWorks />
        </section>

        {/* ---- Live market — floating divide-y rows (proof buyers are here) ---- */}
        {listings.length > 0 && (
          <section className="px-4 py-8">
            <div className="mx-auto max-w-2xl">
              <div className="mb-1 flex items-baseline justify-between gap-4">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Live market for {page.assetLabel}s
                </h2>
                <Link
                  href={marketHref}
                  className="inline-flex items-center gap-1 text-sm font-medium text-lime-text transition-transform hover:translate-x-0.5"
                >
                  Browse all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                {listings.length}+ active listings right now — price yours against what&apos;s already selling.
              </p>
              <div className="divide-y divide-white/[0.06]">
                {listings.slice(0, 5).map((listing) => (
                  <div key={listing.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium text-foreground">{listing.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{listing.seller?.username}</p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                      ${listing.price.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---- About — unique, keyword-rich prose (SEO depth) ---- */}
        <section className="px-4 py-10">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-6 font-display text-xl font-semibold text-foreground sm:text-2xl">
              About selling your {page.assetLabel}
            </h2>
            <div className="space-y-7">
              {page.about.map((sec) => (
                <div key={sec.heading}>
                  <h3 className="mb-2 text-[15px] font-semibold text-foreground">{sec.heading}</h3>
                  <div className="space-y-3 text-[15px] leading-[1.65] text-muted-foreground">
                    {sec.body
                      .split(/\n{2,}/)
                      .map((p) => p.trim())
                      .filter(Boolean)
                      .map((p, j) => (
                        <p key={j}>{p}</p>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- FAQ — items-page FaqCards style ---- */}
        <section className="px-4 py-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-display text-2xl font-semibold text-foreground">
              Selling FAQs
            </h2>
            <FaqCards items={page.faqs} defaultOpen={-1} />
          </div>
        </section>

        {/* ---- Closing CTA — floating, no box ---- */}
        <section className="relative overflow-hidden px-4 py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(50% 60% at 50% 40%, rgba(198,255,61,0.08), transparent 70%)',
            }}
          />
          <div className="relative mx-auto max-w-xl text-center">
            <h2 className="mb-3 font-display text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">
              Ready to sell your {page.assetLabel}?
            </h2>
            <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
              Join the founding-seller programme — lower fees, early access, and a founding badge. Takes a minute; add payout details later.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/early-seller"
                className="inline-flex items-center gap-2 rounded-lg bg-lime px-6 py-3 text-sm font-semibold text-text-inverse transition-all duration-200 hover:bg-lime-hover hover:shadow-glow"
              >
                Start selling
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={marketHref}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Browse the market
              </Link>
            </div>
          </div>
        </section>
      </HeroBackdrop>
    </>
  )
}
