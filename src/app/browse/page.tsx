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

import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getGameIcon } from '@/features/home/lib/game-icons'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { SITE_URL } from '@/config/site'
import BrowseClient from './_BrowseClient'

export const metadata: Metadata = {
  title: 'Browse the Marketplace — Accounts, Currency, Items & Boosts',
  description:
    'Browse every game on DropMarket — buy and sell accounts, in-game currency, items, top-ups and boosting. Every order is covered by SafeDrop Buyer Protection: sellers are paid only after you confirm delivery.',
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
    title: 'Browse the DropMarket Marketplace',
    description:
      'Accounts, currency, items, top-ups and boosting across every game — protected by SafeDrop.',
    type: 'website',
    url: `${SITE_URL}/browse`,
  },
}

/* The five core buying categories, keyed by the DB metadata.type each
   game's categories carry. Used to build per-game deep links + the
   "Browse by category" shortcut row. */
const CATEGORY_SHORTCUTS = [
  { label: 'Currency', type: 'currency', blurb: 'Coins, gold, V-Bucks and more' },
  { label: 'Items', type: 'items', blurb: 'Skins, gear and rare drops' },
  { label: 'Accounts', type: 'account', blurb: 'Ready-to-play game accounts' },
  { label: 'Top-Ups', type: 'top_up', blurb: 'Direct balance top-ups' },
  { label: 'Boosting', type: 'service', blurb: 'Rank-ups from pro players' },
] as const

const FAQS = [
  {
    q: 'Is it safe to buy game accounts and items on DropMarket?',
    a: 'Yes. Every order is held by SafeDrop Buyer Protection — the seller is paid only after you confirm you received exactly what was described. If something is wrong, you get your money back.',
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
    a: 'Sellers pay a 5–10% fee — far below the 17–26% the big marketplaces charge — so listings start cheaper here and stay cheaper.',
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
  const supabase = await createClient()

  const { data: games } = (await supabase
    .from('games')
    .select('id, slug, name, image_url, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })) as { data: GameRow[] | null }

  const list = games ?? []
  if (list.length === 0) return { games: [] as (GameRow & { href: string })[] }

  // First active category per game → the card links to a real page.
  const { data: cats } = (await supabase
    .from('categories')
    .select('game_id, slug, display_order')
    .in('game_id', list.map((g) => g.id))
    .eq('is_active', true)
    .order('display_order', { ascending: true })) as unknown as {
      data: { game_id: string; slug: string }[] | null
    }

  const firstCat = new Map<string, string>()
  for (const c of cats ?? []) {
    if (!firstCat.has(c.game_id)) firstCat.set(c.game_id, c.slug)
  }

  return {
    games: list.map((g) => ({
      ...g,
      href: firstCat.has(g.id) ? `/${g.slug}/${firstCat.get(g.id)}` : `/${g.slug}/buy-currency`,
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
          across every game — every order covered by{' '}
          <Link href="/safedrop" className="font-semibold text-lime-text hover:underline">
            SafeDrop Buyer Protection
          </Link>
          . Sellers are paid only after you confirm delivery.
        </p>
      </header>

      {/* Category shortcuts — internal link row. */}
      <section aria-labelledby="browse-categories" className="mb-10">
        <h2 id="browse-categories" className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">
          Browse by Category
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORY_SHORTCUTS.map((c) => (
            <Link
              key={c.type}
              href={`/browse?category=${c.type}`}
              className="group rounded-xl border border-border-subtle bg-bg-overlay p-3.5 transition-colors hover:border-lime-tint-border hover:bg-bg-raised-hover"
            >
              <span className="block text-[15px] font-bold text-text-primary group-hover:text-lime-text">
                {c.label}
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-text-tertiary">{c.blurb}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Game directory — the SEO payload: an internal link to every
          active game's marketplace page. */}
      {games.length > 0 && (
        <section aria-labelledby="browse-games" className="mb-12">
          <h2 id="browse-games" className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">
            Browse by Game
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {games.map((g) => (
              <Link
                key={g.slug}
                href={g.href}
                className="group flex items-center gap-2.5 rounded-xl border border-border-subtle bg-bg-overlay p-2.5 transition-colors hover:border-lime-tint-border hover:bg-bg-raised-hover"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.image_url || getGameIcon(g.slug)}
                  alt=""
                  loading="lazy"
                  className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-white/[0.08]"
                />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text-primary group-hover:text-lime-text">
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
        <dl className="space-y-5">
          {FAQS.map((f) => (
            <div key={f.q} className="rounded-xl border border-border-subtle bg-bg-overlay p-4">
              <dt className="text-[15px] font-semibold text-text-primary">{f.q}</dt>
              <dd className="mt-1.5 text-[14px] leading-relaxed text-text-secondary">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  )
}
