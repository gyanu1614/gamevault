/**
 * /browse: universal marketplace browse (SEO shell + interactive client).
 *
 * Server component: renders the indexable content (H1, intro, the popular
 * games, every game A to Z as internal links, FAQ) plus breadcrumb + FAQ
 * JSON-LD, then mounts the client filter/listings UI (_BrowseClient).
 *
 * Redesigned 2026-10-15 (owner: the old look, less text, organised): the
 * 240-tile game wall became a popular row and a compact A to Z index.
 */

import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import type { Metadata } from 'next'
import { FireIcon } from '@phosphor-icons/react/dist/ssr/Fire'
import { GameControllerIcon } from '@phosphor-icons/react/dist/ssr/GameController'
import { ListBulletsIcon } from '@phosphor-icons/react/dist/ssr/ListBullets'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { StorefrontIcon } from '@phosphor-icons/react/dist/ssr/Storefront'
import { TagIcon } from '@phosphor-icons/react/dist/ssr/Tag'
import { FactStrip, InfoCtaBand, InfoHero, InfoSection } from '@/components/info'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { createAnonClient } from '@/lib/supabase/anon'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { SITE_URL } from '@/config/site'
import { foundingHref } from '@/lib/seo/founding-href'
import { seoMeta } from '@/lib/seo/fit'
import BrowseClient from './_BrowseClient'
import { gamesByLetter, popularGames, type BrowseGame } from './_browse-model'
import { PopularGames } from './_PopularGames'
import { GameIndex } from './_GameIndex'

/**
 * The server shell is a static game directory; the live listing grid is
 * client-fetched by _BrowseClient, so the shell itself can cache.
 */
export const revalidate = 900

export const metadata: Metadata = seoMeta({
  title: 'Browse the Marketplace: Accounts, Currency, Items & Boosts',
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
    description: 'Accounts, currency, items, top-ups and boosting across every game, protected by SafeDrop.',
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
    a: 'Game accounts, in-game currency, items and skins, direct top-ups, and boosting services across every game we support. Use the search and filters, or jump straight to a game from the A to Z list.',
  },
  {
    q: 'How fast is delivery?',
    a: 'Most currency, item and top-up orders arrive within minutes. Each listing shows its delivery time before you buy.',
  },
  {
    q: 'How much does it cost to sell?',
    a: 'Listing is free. Sellers pay a commission set per category, only when an order completes, and every rate is published on our Seller Fees page.',
  },
  {
    q: 'What does it cost to buy?',
    a: 'Lowest fees for buyers and sellers: the price you see at checkout is the price you pay. A small marketplace fee keeps SafeDrop Protection on every order, and the processing fee for your payment method is shown on its tile before you pay. The current terms are on our Fees page.',
  },
]

async function getBrowseDirectory(): Promise<BrowseGame[]> {
  const supabase = createAnonClient()
  const { data } = (await supabase
    .from('games')
    .select('id, slug, name, image_url, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })) as { data: Omit<BrowseGame, 'href'>[] | null }
  // The game hub: it always exists for an active game (2026-10-07 Bing scan:
  // a game with no enabled category got an invented /buy-currency link that 404s).
  return (data ?? []).map((g) => ({ ...g, href: `/${g.slug}` }))
}

export default async function BrowsePage() {
  const games = await getBrowseDirectory()
  const popular = popularGames(games)

  return (
    <main className="relative min-h-screen bg-bg-base pb-20">
      <JsonLd data={breadcrumbList([{ name: 'Home', path: '/' }, { name: 'Browse', path: '/browse' }])} />
      <JsonLd data={faqPage(FAQS)} />

      <InfoHero
        icon={StorefrontIcon}
        tone="lime"
        title="Browse the Marketplace"
        lead="Accounts, currency, items, top-ups and boosting across every game, with every order covered by SafeDrop Protection."
      />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <FactStrip
          label="Why buy on DropMarket"
          className="mt-12 sm:mt-14"
          items={[
            { icon: GameControllerIcon, tone: 'blue', title: `${games.length} Games`, body: 'Accounts, currency, items, top-ups and boosting.' },
            { icon: ShieldCheckIcon, tone: 'green', title: 'SafeDrop Protection', body: 'Item Guaranteed or Full Refund on every order.', href: '/safedrop' },
            { icon: TagIcon, tone: 'lime', title: 'Low Fees', body: 'Lowest fees for buyers and sellers, shown before you pay.', href: '/fees' },
          ]}
        />

        {popular.length > 0 && (
          <InfoSection id="popular-games" icon={FireIcon} tone="amber" title="Popular Games" sub="The most traded games on DropMarket.">
            <PopularGames games={popular} />
          </InfoSection>
        )}

        <InfoSection
          id="listings"
          icon={MagnifyingGlassIcon}
          tone="blue"
          title="All Listings"
          sub="Search every live offer, then narrow it by game, category and price."
        >
          <BrowseClient />
        </InfoSection>

        {games.length > 0 && (
          <InfoSection id="all-games" icon={ListBulletsIcon} title="All Games A to Z" sub={`Every game on DropMarket, ${games.length} in all.`}>
            <GameIndex groups={gamesByLetter(games)} total={games.length} />
          </InfoSection>
        )}

        <HubFaqSection title="Marketplace FAQ" subtitle="Buying, selling and delivery, in short." items={FAQS} />

        <InfoCtaBand
          icon={StorefrontIcon}
          tone="lime"
          title="Have Something to Sell?"
          body="List for free and reach buyers across every game."
          action={{ href: foundingHref('browse'), label: 'Become a Seller' }}
        />
      </div>
    </main>
  )
}
