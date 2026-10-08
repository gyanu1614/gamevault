/**
 * /browse — universal marketplace browse (SEO shell + interactive client).
 *
 * Server component: renders indexable content (H1, intro, a game directory
 * with internal links, category shortcuts, popular searches, FAQ) plus
 * breadcrumb + FAQ JSON-LD, then mounts the client filter/listings UI
 * (_BrowseClient) below the fold. Previously this route was a bare
 * 'use client' shell — crawlers saw nothing, so it never ranked and the
 * game/category graph wasn't linked from a hub.
 */

import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { FaqCards } from '@/components/marketplace/FaqCards'
import type { Metadata } from 'next'
import Link from '@/components/navigation/AppLink'
import { createAnonClient } from '@/lib/supabase/anon'
import { getGameIcon } from '@/features/home/lib/game-icons'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { SITE_URL } from '@/config/site'
import BrowseClient from './_BrowseClient'
import { seoMeta } from '@/lib/seo/fit'

/**
 * The server shell is a static game/category directory; the live listing grid
 * is client-fetched by _BrowseClient, so the shell itself can cache.
 */
export const revalidate = 900

export const metadata: Metadata = seoMeta({
  title: 'Browse the Marketplace — Accounts, Currency, Items & Boosts',
  description:
    'Browse every game on DropMarket. Buy and sell accounts, in-game currency, items, top-ups and boosting. Every order is covered by SafeDrop Protection: Item Guaranteed or Full Refund.',
  keywords: [
    'buy game accounts',
    'sell game accounts',
    'in-game currency marketplace',
    'buy game items',
    'game boosting marketplace',
    'cheap game top-ups',
  ],
  alternates: { canonical: `${SITE_URL}/browse` },
  openGraph: {
    images: DEFAULT_OG_IMAGES,
    title: 'Browse the DropMarket Marketplace',
    description:
      'Accounts, currency, items, top-ups and boosting across every game — protected by SafeDrop.',
    type: 'website',
    url: `${SITE_URL}/browse`,
  },
})

const FAQS = [
  {
    q: 'Is it safe to buy game accounts and items on DropMarket?',
    a: 'Yes. Every order is covered by SafeDrop Protection: you get exactly what was described, or you get your money back. Confirm and the order is complete.',
  },
  {
    q: 'What can I buy on the marketplace?',
    a: 'Game accounts, in-game currency, items and skins, direct top-ups, and boosting services across every game we support. Use the search and filters below, or jump straight to a game from the directory.',
  },
  {
    q: 'How fast is delivery?',
    a: 'Most currency, item and top-up orders are delivered within minutes by verified sellers. Delivery time is shown on each listing before you buy.',
  },
  {
    q: 'How much does it cost to sell?',
    a: 'Sellers pay some of the lowest fees in the market — set per category and published on our Seller Fees page — so listings start cheaper here and stay cheaper.',
  },
  {
    q: 'What does it cost to buy?',
    a: 'Lowest fees for buyers and sellers: the price you see at checkout is the price you pay. A small marketplace fee keeps SafeDrop Protection on every order, and the processing fee for the payment method you pick is quoted on its tile before you pay — the current terms are on our Fees page.',
  },
]

interface GameRow {
  id: string
  slug: string
  name: string
  image_url: string | null
  sort_order: number | null
}

async function getBrowseDirectory() {
  const supabase = createAnonClient()

  const { data: games } = (await supabase
    .from('games')
    .select('id, slug, name, image_url, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })) as { data: GameRow[] | null }

  const list = games ?? []
  if (list.length === 0) return { games: [] as (GameRow & { href: string })[] }

  return {
    games: list.map((g) => ({
      ...g,
      // The game hub: it always exists for an active game (2026-10-07 Bing
      // scan: a game with no enabled category got an invented /buy-currency
      // link that 404s).
      href: `/${g.slug}`,
    })),
  }
}

export default async function BrowsePage() {
  const { games } = await getBrowseDirectory()

  const breadcrumb = breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Browse', path: '/browse' },
  ])

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:pt-32">
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqPage(FAQS.map((f) => ({ q: f.q, a: f.a })))} />

      {/* SEO hero — real H1 + intro, server-rendered. */}
      <header className="mb-8 max-w-3xl">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl lg:text-5xl">
          Browse the Marketplace
        </h1>
        <p className="mt-3 text-body-lg text-text-secondary">
          Buy and sell game <strong className="font-semibold text-text-primary">accounts</strong>,{' '}
          <strong className="font-semibold text-text-primary">currency</strong>,{' '}
          <strong className="font-semibold text-text-primary">items</strong>, top-ups and boosting
          across every game, every order covered by{' '}
          <Link href="/safedrop" className="font-semibold text-lime-text hover:underline">
            SafeDrop Protection
          </Link>
          . Item Guaranteed or Full Refund.
        </p>
      </header>

      {/* Game directory — the SEO payload: an internal link to every
          active game's marketplace page. */}
      {games.length > 0 && (
        <section aria-labelledby="browse-games" className="mb-12">
          <h2 id="browse-games" className="mb-4 text-[18px] font-bold tracking-[-0.01em] text-text-primary sm:text-[20px]">
            Browse by Game
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {games.map((g) => (
              <Link
                key={g.slug}
                href={g.href}
                className={`group flex items-center gap-2.5 rounded-lg p-2.5 ${MARKET_CARD} ${MARKET_CARD_HOVER}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.image_url || getGameIcon(g.slug)}
                  alt={`${g.name} logo`}
                  aria-hidden
                  loading="lazy"
                  className="h-9 w-9 shrink-0 rounded-md object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-text-primary">
                  {g.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Interactive filter + listings (client). */}
      <section aria-labelledby="browse-listings" className="mb-14 scroll-mt-28" id="listings">
        <h2 id="browse-listings" className="mb-4 text-xl font-bold text-text-primary sm:text-2xl">
          All Listings
        </h2>
        <BrowseClient />
      </section>

      {/* FAQ — indexable content + matching JSON-LD above. */}
      <section aria-labelledby="browse-faq" className="max-w-3xl">
        <h2 id="browse-faq" className="mb-5 text-xl font-bold text-text-primary sm:text-2xl">
          Frequently Asked Questions
        </h2>
        {/* Shared FAQ cards (every answer stays in the HTML). */}
        <FaqCards items={FAQS} defaultOpen={0} />
      </section>
    </main>
  )
}
