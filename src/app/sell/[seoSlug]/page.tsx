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
import { ShieldCheck, Coins, BadgeCheck, ArrowRight, ChevronDown, Tag, Wallet, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSellPage, getAllSellPageSlugs, SellPage } from '@/lib/seo/sellPages'
import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'
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

const HOW_STEPS = [
  {
    icon: Tag,
    title: 'List it free',
    desc: 'Create your listing in minutes. No upfront cost — you only pay commission when it sells.',
  },
  {
    icon: ShieldCheck,
    title: 'Buyer pays into SafeDrop',
    desc: 'The buyer pays up front before you deliver. You never hand over goods hoping to get paid.',
  },
  {
    icon: Wallet,
    title: 'Get paid safely',
    desc: 'Once the buyer confirms, your proceeds are released — protected from chargebacks.',
  },
] as const

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
        <section className="relative pt-16 pb-12 px-4 overflow-hidden">
          <div className="mx-auto max-w-5xl text-center relative">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lime/10 border border-lime-tint-border text-sm font-medium text-lime-text mb-6 backdrop-blur-sm">
              <ShieldCheck className="w-3.5 h-3.5" />
              Get paid safely — protected by SafeDrop
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold text-foreground mb-5 leading-tight [text-shadow:0_2px_20px_rgba(0,0,0,0.55)]">
              <span className="mr-3">{page.emoji}</span>
              {page.headline}
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 [text-shadow:0_1px_12px_rgba(0,0,0,0.7)]">
              {page.subCopy}
            </p>

            {/* Seller value chips */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-10 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Free to list
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Commission only when it sells — from 5%
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Chargeback-protected payouts
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/early-seller"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-lime hover:bg-lime-hover text-text-inverse font-semibold text-sm transition-all duration-200 hover:shadow-glow"
              >
                Start selling
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/fees"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.10] text-sm font-medium text-foreground transition-all duration-200"
              >
                See the fees
              </Link>
            </div>
          </div>
        </section>

        {/* ---- How selling works ---- */}
        <section className="py-12 px-4">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-xl font-display font-bold text-foreground mb-6 text-center">
              How selling works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {HOW_STEPS.map((step, i) => (
                <div
                  key={step.title}
                  className="relative rounded-2xl bg-white/[0.04] border border-border-subtle p-6"
                >
                  <span className="absolute top-4 right-5 text-4xl font-black text-white/[0.05] leading-none select-none">
                    {i + 1}
                  </span>
                  <step.icon className="w-7 h-7 text-lime-text mb-3" />
                  <h3 className="font-semibold text-foreground text-sm mb-1.5">{step.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Live market activity (proof buyers are here) ---- */}
        {listings.length > 0 && (
          <section className="py-12 px-4">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-xl font-display font-bold text-foreground mb-2">
                There&apos;s a live market for {page.assetLabel}s
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {listings.length}+ active listings right now — price yours against what&apos;s already selling.
              </p>

              {/* Desktop table */}
              <div className="hidden md:block rounded-2xl overflow-hidden border border-border-subtle bg-bg-overlay">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Listing</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Seller</th>
                      <th className="text-right px-5 py-3 font-medium text-muted-foreground">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((listing) => (
                      <tr key={listing.id} className="border-b border-white/[0.04]">
                        <td className="px-5 py-3.5">
                          <span className="font-medium text-foreground line-clamp-1">{listing.title}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-muted-foreground">{listing.seller?.username}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="font-mono font-bold text-foreground text-base">
                            ${listing.price.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden space-y-3">
                {listings.slice(0, 5).map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.04] border border-border-subtle"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{listing.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{listing.seller?.username}</p>
                    </div>
                    <p className="font-mono font-bold text-foreground shrink-0">${listing.price.toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <Link
                  href={marketHref}
                  className="inline-flex items-center gap-2 text-sm text-lime-text hover:text-lime-text font-medium transition-colors"
                >
                  Browse the live market
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ---- Seller trust signals ---- */}
        <section className="py-10 px-4 border-y border-border-subtle bg-bg-overlay">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  icon: Coins,
                  title: 'Keep more of every sale',
                  desc: 'Commission from 5% — a fraction of the 17–26% the big marketplaces skim. Free to list; you only pay when it sells.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Paid safely, no chargebacks',
                  desc: 'Buyers pay into SafeDrop up front. Funds release to you on confirmation and can\'t be clawed back weeks later.',
                },
                {
                  icon: BadgeCheck,
                  title: 'A marketplace with real buyers',
                  desc: 'Verified buyers and sellers, live ratings, and 24/7 human support — so your listings sell to real people.',
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <item.icon className="w-7 h-7 text-lime-text shrink-0" />
                  <div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- FAQ ---- */}
        <section className="py-14 px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-display font-bold text-foreground mb-8 text-center">
              Selling FAQs
            </h2>
            <div className="space-y-3">
              {page.faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group rounded-2xl bg-white/[0.04] border border-border-subtle overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none font-medium text-foreground text-sm select-none hover:text-lime-text transition-colors">
                    {faq.q}
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border-subtle pt-3">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---- CTA ---- */}
        <section className="py-14 px-4">
          <div className="mx-auto max-w-3xl text-center">
            <div className="rounded-2xl bg-gradient-to-br from-lime/[0.12] to-cyan-500/[0.06] border border-lime-tint-border p-10">
              <h2 className="text-2xl font-display font-bold text-foreground mb-3">
                Ready to sell your {page.assetLabel}?
              </h2>
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                Join the founding-seller programme — lower fees, early access, and a founding badge. It takes a minute, and you add payout details later.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/early-seller"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-lime hover:bg-lime-hover text-text-inverse font-semibold text-sm transition-all duration-200"
                >
                  Start selling
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href={marketHref}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.10] text-sm font-medium text-foreground transition-all duration-200"
                >
                  Browse the market
                </Link>
              </div>
            </div>
          </div>
        </section>
      </HeroBackdrop>
    </>
  )
}
