import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JsonLd, breadcrumbList, ownStockProduct } from '@/lib/seo/jsonld'
import { socialTitle } from '@/lib/seo/title'
import { formatUsd } from '@/lib/value-listings/format'
import { loadItemListingsPage } from '../_valueItemOffers'
import { ItemListingsView } from './_ItemListingsView'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import GameSubNav from '@/components/marketplace/GameSubNav'
import { getSubnavCategories } from '@/lib/categories/subnav-categories'
import { hubNavExtras } from '../../values/_HubNavExtras'
import { getItemFacts } from '@/lib/values/item-facts-data'
import { rarityMeta } from '@/lib/values/rarity'
import { itemAbout } from '@/features/item-buy/model/about'

/**
 * Shared by /{game}/{category}/item/{item} and …/item/{item}/{variant}.
 *
 * SEO (owner, 2026-10-27): an item page is indexable with a self-canonical
 * from its first live listing (`model.indexable`, ITEM_PAGE_MIN_LISTINGS);
 * with none it is noindex,follow and keeps its fallbacks. Title = the search
 * phrase plus the cheapest price ("Adopt Me Parrot for Sale – From $54.99");
 * Product JSON-LD only from our own stock. A variant page canonicals to its
 * item page.
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
  const n = model.results.length
  const title = inStock
    ? `${pair.gameName} ${model.fullName} for Sale – From ${formatUsd(model.minPriceUsd!)}`
    : `${model.fullName} - ${pair.gameName}`
  const description = inStock
    ? `${pair.gameName} ${model.fullName} for sale from verified sellers: ${n} ${n === 1 ? 'offer' : 'offers'} from ${formatUsd(model.minPriceUsd!)}. Every order covered by SafeDrop Protection.`
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
  const { model, pair } = data
  // The game's tabs, Items active (GameBoost keeps them on an item page): one cached entry per game.
  // Facts: one row under the item's tags; a miss means no details, never a broken page.
  const [categories, facts] = await Promise.all([getSubnavCategories(pair.gameId), getItemFacts(params.gameSlug, model.item.slug)])
  const about = itemAbout({
    gameSlug: params.gameSlug,
    gameName: pair.gameName,
    itemName: model.item.name,
    rarity: model.item.rarity ? rarityMeta(params.gameSlug, model.item.rarity).label : null,
    facts,
  })
  // Every trait's offers: the page sells all of them, whatever the URL's trait.
  const productLd = ownStockProduct({
    name: `${pair.gameName} ${model.item.name}`,
    description: `${pair.gameName} ${model.item.name} for sale from verified sellers, covered by SafeDrop Protection.`,
    brand: pair.gameName,
    url: model.canonicalPath,
    image: model.item.imageUrl,
    stock: model.stock,
    offerPrices: model.itemRows.map((r) => Number(r.price)),
  })
  return (
    <GameHeroBackdrop gameSlug={params.gameSlug} size="market">
      {productLd ? <JsonLd data={productLd} /> : null}
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
      <ItemListingsView gameSlug={params.gameSlug} data={data} about={about} />
    </GameHeroBackdrop>
  )
}
