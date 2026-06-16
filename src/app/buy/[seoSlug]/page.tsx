/**
 * Programmatic SEO Landing Pages — /buy/[seoSlug]
 *
 * Server-rendered pages targeting high-volume search queries like:
 *   "buy roblox accounts", "buy valorant points", "sell game accounts"
 *
 * Each page renders:
 *   - SEO meta + structured data (Schema.org Product + FAQPage)
 *   - Hero with keyword-rich headline
 *   - Live price table from DB
 *   - Trust signals
 *   - FAQ accordion
 *   - CTA
 */

import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Shield, Zap, Star, ArrowRight, CheckCircle2, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getLandingPage, getAllLandingPageSlugs, LandingPage } from '@/lib/seo/landingPages'
import type { ListingWithRelations } from '@/types/database'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gamevault.gg'

/* ------------------------------------------------------------------ */
/* Static params                                                        */
/* ------------------------------------------------------------------ */

export async function generateStaticParams() {
  return getAllLandingPageSlugs().map((slug) => ({ seoSlug: slug }))
}

/* ------------------------------------------------------------------ */
/* Metadata                                                             */
/* ------------------------------------------------------------------ */

export async function generateMetadata(
  { params }: { params: { seoSlug: string } },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const page = getLandingPage(params.seoSlug)
  if (!page) return {}

  const url = `${BASE_URL}/buy/${page.slug}`

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: 'GameVault',
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
/* Data fetching                                                        */
/* ------------------------------------------------------------------ */

async function getListings(page: LandingPage) {
  const supabase = await createClient()

  let query = supabase
    .from('listings')
    .select(
      `
      id, title, price, currency, images, delivery_time, is_unlimited, quantity, views, sales,
      seller:profiles!listings_seller_id_fkey(id, username, avatar_url, seller_rating),
      game:games!listings_game_id_fkey(id, name, slug, emoji),
      category:categories!listings_category_id_fkey(id, name, slug, icon)
    `,
    )
    .eq('status', 'active')
    .order('sales', { ascending: false })
    .limit(12)

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
/* Schema.org JSON-LD                                                   */
/* ------------------------------------------------------------------ */

function buildStructuredData(page: LandingPage, listings: ListingWithRelations[]) {
  const url = `${BASE_URL}/buy/${page.slug}`

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  }

  const itemListSchema = listings.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: page.headline,
        url,
        numberOfItems: listings.length,
        itemListElement: listings.slice(0, 6).map((l, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: l.title,
          url: `${BASE_URL}/listings/${l.id}`,
          offers: {
            '@type': 'Offer',
            price: l.price.toFixed(2),
            priceCurrency: l.currency || 'USD',
            availability: 'https://schema.org/InStock',
            seller: {
              '@type': 'Person',
              name: l.seller?.username,
            },
          },
        })),
      }
    : null

  return { faqSchema, itemListSchema }
}

/* ------------------------------------------------------------------ */
/* Page component                                                       */
/* ------------------------------------------------------------------ */

export default async function SEOLandingPage({
  params,
}: {
  params: { seoSlug: string }
}) {
  const page = getLandingPage(params.seoSlug)
  if (!page) notFound()

  const listings = await getListings(page)
  const { faqSchema, itemListSchema } = buildStructuredData(page, listings)

  const minPrice = listings.length > 0 ? Math.min(...listings.map((l) => l.price)) : null

  return (
    <>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {itemListSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />
      )}

      <main className="min-h-screen">
        {/* ---- Hero ---- */}
        <section className="relative pt-16 pb-12 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-lime/[0.07] via-transparent to-transparent pointer-events-none" />
          <div className="mx-auto max-w-5xl text-center relative">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lime/10 border border-lime-tint-border text-sm font-medium text-lime-text mb-6">
              <Shield className="w-3.5 h-3.5" />
              VaultShield Buyer Protection
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold text-foreground mb-5 leading-tight">
              <span className="mr-3">{page.emoji}</span>
              {page.headline}
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              {page.subCopy}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
              {minPrice !== null && (
                <span className="text-sm text-muted-foreground">
                  Starting from{' '}
                  <span className="font-mono font-bold text-foreground text-base">
                    ${minPrice.toFixed(2)}
                  </span>
                </span>
              )}
              <div className="flex items-center gap-1.5 text-sm text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                {listings.length > 0
                  ? `${listings.length}+ listings available`
                  : 'New listings added daily'}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {page.gameSlug && (
                <Link
                  href={`/${page.gameSlug}${page.categorySlug ? `/${page.categorySlug}` : ''}`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-lime hover:bg-lime-hover text-text-inverse font-semibold text-sm transition-all duration-200 hover:shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)]"
                >
                  Browse All Listings
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <Link
                href="/seller/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.10] text-sm font-medium text-foreground transition-all duration-200"
              >
                Sell Instead
              </Link>
            </div>
          </div>
        </section>

        {/* ---- Price table / listing grid ---- */}
        {listings.length > 0 && (
          <section className="py-12 px-4">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-xl font-display font-bold text-foreground mb-6">
                Current Listings
              </h2>

              {/* Desktop table */}
              <div className="hidden md:block rounded-2xl overflow-hidden border border-border-subtle bg-bg-overlay">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Listing</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Seller</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Delivery</th>
                      <th className="text-right px-5 py-3 font-medium text-muted-foreground">Price</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((listing) => (
                      <tr
                        key={listing.id}
                        className="border-b border-white/[0.04] hover:bg-bg-overlay transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <span className="font-medium text-foreground line-clamp-1">{listing.title}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{listing.seller?.username}</span>
                            {listing.seller?.seller_rating > 0 && (
                              <span className="flex items-center gap-0.5 text-amber-400 text-xs">
                                <Star className="w-3 h-3 fill-current" />
                                {listing.seller.seller_rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            {listing.delivery_time?.toLowerCase().includes('instant') && (
                              <Zap className="w-3.5 h-3.5 text-lime-text" />
                            )}
                            {listing.delivery_time}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="font-mono font-bold text-foreground text-base">
                            ${listing.price.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/listings/${listing.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime/10 hover:bg-lime/20 border border-lime-tint-border text-lime-text text-xs font-semibold transition-colors"
                          >
                            Buy
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden space-y-3">
                {listings.slice(0, 6).map((listing) => (
                  <Link
                    key={listing.id}
                    href={`/listings/${listing.id}`}
                    className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.04] border border-border-subtle hover:border-lime-tint-border transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{listing.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{listing.seller?.username}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-foreground">${listing.price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{listing.delivery_time}</p>
                    </div>
                  </Link>
                ))}
              </div>

              {page.gameSlug && (
                <div className="mt-6 text-center">
                  <Link
                    href={`/${page.gameSlug}${page.categorySlug ? `/${page.categorySlug}` : ''}`}
                    className="inline-flex items-center gap-2 text-sm text-lime-text hover:text-lime-text font-medium transition-colors"
                  >
                    View all listings
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---- Trust signals ---- */}
        <section className="py-10 px-4 border-y border-border-subtle bg-bg-overlay">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  icon: '🛡️',
                  title: 'VaultShield Escrow',
                  desc: 'Your payment is held securely until you confirm delivery. No delivery = full refund.',
                },
                {
                  icon: '⚡',
                  title: 'Instant Delivery',
                  desc: 'Most sellers deliver within minutes. Delivery time is displayed on every listing.',
                },
                {
                  icon: '⭐',
                  title: 'Verified Sellers',
                  desc: 'All sellers pass identity verification and maintain a public rating history.',
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <span className="text-3xl leading-none shrink-0">{item.icon}</span>
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
              Frequently Asked Questions
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
                Ready to buy?
              </h2>
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                Browse live listings, pay securely with VaultShield escrow, and receive your purchase fast.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {page.gameSlug ? (
                  <Link
                    href={`/${page.gameSlug}${page.categorySlug ? `/${page.categorySlug}` : ''}`}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-lime hover:bg-lime-hover text-text-inverse font-semibold text-sm transition-all duration-200"
                  >
                    Browse Listings
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-lime hover:bg-lime-hover text-text-inverse font-semibold text-sm transition-all duration-200"
                  >
                    Explore GameVault
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
                <Link
                  href="/seller/register"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.10] text-sm font-medium text-foreground transition-all duration-200"
                >
                  Become a Seller
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
