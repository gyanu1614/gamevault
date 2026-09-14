/**
 * /dev/items-v2
 *
 * Scoped "Quiet Trust" theme-v2 test for the SAB items page.
 * Uses REAL data from steal-a-brainrot/items — identical fetching to
 * the production route. Only colours and component structure differ.
 *
 * Pass ?game=<slug>&category=<slug> to preview any game's items.
 * Defaults: game=steal-a-brainrot, category=items
 *
 * Original page at: /steal-a-brainrot/items (untouched)
 */

import React, { Suspense, cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GameSubNav, { type GameCategory } from '@/components/marketplace/GameSubNav'
import { loadItemsTaxonomy, listingToOffer } from '../../(marketplace)/[gameSlug]/[categorySlug]/_itemsData'
import { getCategoryStats } from '@/lib/seo/page-stats'
import { getPausedSellerIds } from '@/lib/actions/seller-presence'
import { SabNavExtras } from '../../(marketplace)/[gameSlug]/values/_SabNavExtras'
import ItemsPageClient from '../../(marketplace)/[gameSlug]/[categorySlug]/_ItemsPageClient'

interface Props {
  searchParams: Promise<{ game?: string; category?: string }>
}

async function getAllGameCategories(gameId: string): Promise<GameCategory[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('game_id', gameId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true }) as any
  return (data || []) as GameCategory[]
}

function excludePausedSellers(query: any, pausedIds: string[]) {
  if (pausedIds.length === 0) return query
  return query.not('seller_id', 'in', `(${pausedIds.join(',')})`)
}

export default async function ItemsV2Page({ searchParams }: Props) {
  const { game: gameSlug = 'steal-a-brainrot', category: categorySlug = 'buy-items' } =
    await searchParams

  const supabase = await createClient()

  const { data: game } = await supabase
    .from('games')
    .select('id, name, image_url, slug')
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .single() as any

  if (!game) notFound()

  const { data: category } = await supabase
    .from('categories')
    .select('id, name, slug, description, metadata')
    .eq('slug', categorySlug)
    .eq('game_id', game.id)
    .eq('is_active', true)
    .single() as any

  if (!category) notFound()

  const pausedSellerIds = await getPausedSellerIds()

  const taxonomySlug = (() => {
    const t = category.metadata?.type
    if (t === 'account') return 'accounts'
    if (t === 'service') return 'boosting'
    if (t === 'top_up') return 'top-up'
    return 'items'
  })()

  const [allCategories, taxonomy, viewerRes, listingsRaw, stats] = await Promise.all([
    getAllGameCategories(game.id),
    loadItemsTaxonomy(game.id, taxonomySlug),
    (await createClient()).auth.getUser(),
    (async () => {
      const sb = await createClient()
      let q: any = sb
        .from('listings')
        .select(`
          id, slug, title, price, original_price, delivery_time,
          quantity, is_unlimited, images, template_data, status,
          seller:profiles!listings_seller_id_fkey(
            id, username, shop_name, shop_slug, avatar_url, seller_tier,
            seller_rating, total_reviews, total_sales, is_verified
          ),
          category:categories!listings_category_id_fkey(slug, name)
        `)
        .eq('game_id', game.id)
        .eq('category_id', category.id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(200)
      q = excludePausedSellers(q, pausedSellerIds)
      const { data } = await q as any
      return (data ?? []) as any[]
    })(),
    getCategoryStats(game.id, category.id),
  ])

  const offers = listingsRaw.map((l) => listingToOffer(l, taxonomy))
  const viewer = viewerRes.data?.user

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-base)' }}>
      <GameSubNav
        gameSlug={gameSlug}
        gameName={game.name}
        gameImageUrl={game.image_url}
        currentCategorySlug={category.slug}
        categories={allCategories}
        extraTabs={gameSlug === 'steal-a-brainrot' ? <SabNavExtras /> : undefined}
      />

      <Suspense fallback={null}>
        <ItemsPageClient
          gameSlug={gameSlug}
          gameName={game.name}
          gameImageUrl={game.image_url ?? null}
          categoryLabel={category.name}
          tagline={
            category.description ||
            `Browse verified ${game.name} listings — every order covered by SafeDrop Buyer Protection.`
          }
          offers={offers}
          taxonomy={taxonomy}
          viewerId={viewer?.id ?? null}
          stats={stats}
        />
      </Suspense>
    </div>
  )
}
