import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { socialTitle } from '@/lib/seo/title'
import { formatUsd } from '@/lib/value-listings/format'
import { loadItemListingsPage } from '../_valueItemOffers'
import { ItemListingsView } from './_ItemListingsView'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import GameSubNav from '@/components/marketplace/GameSubNav'
import { getSubnavCategories } from '@/lib/categories/subnav-categories'
import { hubNavExtras } from '../../values/_HubNavExtras'

/**
 * Shared by /{game}/{category}/item/{item} and …/item/{item}/{variant}.
 *
 * SEO (owner, 2026-10-02; bar raised 2026-10-10): an item page is indexable
 * with a self-canonical once the item has 5+ live listings (`model.indexable`,
 * ITEM_PAGE_MIN_LISTINGS); below that it is noindex,follow — with stock it
 * still gets its "Buy …" title, with none it keeps its fallbacks. A variant page canonicals to its item page. None of
 * these are in the sitemap yet (Bundle 1 owns the sitemap predicate).
 */
export interface ItemRouteParams {
  gameSlug: string
  categorySlug: string
  itemSlug: string
  variant?: string
}

export async function itemRouteMetadata(p: ItemRouteParams): Promise<Metadata> {
  const data = await loadItemListingsPage(p.gameSlug, p.categorySlug, p.itemSlug, p.variant ?? null)
  if (!data) return { title: 'Item Not Found', robots: { index: false, follow: true } }
  const { model, pair } = data
  const inStock = model.results.length > 0
  const title = inStock ? `Buy ${model.fullName} - ${pair.gameName}` : `${model.fullName} - ${pair.gameName}`
  const description = inStock
    ? `Buy ${model.fullName} for ${pair.gameName} from verified sellers: ${model.results.length} ${model.results.length === 1 ? 'listing' : 'listings'} from ${formatUsd(model.minPriceUsd!)}. Every order covered by SafeDrop Protection.`
    : `No ${model.fullName} listed right now. See other variants and similar ${pair.gameName} items from verified sellers.`
  return {
    title,
    description,
    alternates: { canonical: model.canonicalPath },
    ...(model.indexable ? {} : { robots: { index: false, follow: true } }),
    openGraph: { title: socialTitle(title), description, url: model.canonicalPath, type: 'website', images: model.item.imageUrl ? [model.item.imageUrl] : [] },
  }
}

export async function ItemRoutePage({ params }: { params: ItemRouteParams }) {
  const data = await loadItemListingsPage(params.gameSlug, params.categorySlug, params.itemSlug, params.variant ?? null)
  if (!data) notFound()
  // The game's tabs, Items active (GameBoost keeps them on an item page): one cached entry per game.
  const categories = await getSubnavCategories(data.pair.gameId)
  return (
    <GameHeroBackdrop gameSlug={params.gameSlug} size="market">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: data.pair.gameName, path: `/${params.gameSlug}` },
          { name: 'Buy Items', path: `/${params.gameSlug}/${data.pair.categorySlug}` },
          { name: data.model.item.name, path: data.model.canonicalPath },
        ])}
      />
      <GameSubNav
        gameSlug={params.gameSlug}
        gameName={data.pair.gameName}
        gameImageUrl={data.pair.gameImageUrl}
        currentCategorySlug={data.pair.categorySlug}
        categories={categories}
        extraTabs={hubNavExtras(params.gameSlug, data.pair.gameName)}
      />
      <ItemListingsView gameSlug={params.gameSlug} data={data} />
    </GameHeroBackdrop>
  )
}
