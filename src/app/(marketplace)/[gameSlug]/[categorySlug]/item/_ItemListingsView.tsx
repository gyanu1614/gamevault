import Link from '@/components/navigation/AppLink'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr/ArrowLeft'
import { BackButton } from '@/components/marketplace/BackButton'
import { TrackOnMount } from '@/components/value-listings/TrackOnMount'
import { ItemBuyClient } from '@/features/item-buy/ItemBuyClient'
import { TrustRow } from '@/features/item-buy/TrustRow'
import { traitNoun } from '@/features/item-buy/model/offers'
import { defaultDeliveryNote, deliveryMethodLabel } from '@/features/item-buy/model/item-kind'
import { rarityMeta } from '@/lib/values/rarity'
import { traitDefs } from '@/features/item-buy/model/traits'
import { ItemDetails, ItemFaq } from '@/features/item-buy/ItemAbout'
import { PopularCarousel } from '@/features/item-buy/PopularCarousel'
import { stockedToGridItems } from '@/features/item-buy/model/popular'
import { ITEM_SECTION_GAP } from '@/features/item-buy/layout'
import { cn } from '@/lib/utils'
import { hasHubPage } from '@/lib/content/theme'
import type { ItemAbout } from '@/features/item-buy/model/about'
import type { loadItemListingsPage } from '../_valueItemOffers'

type Data = NonNullable<Awaited<ReturnType<typeof loadItemListingsPage>>>

/**
 * The pet page body (owner, 2026-10-26 to 11-03; Eldorado and GameBoost as the
 * references): a back button, the frosted panel with the pet, its facts and
 * delivery instructions, the buy column beside it, then every offer as a
 * full-width row, more pets, the buyer questions and About. Filtered on the
 * server, so the first HTML holds this pet's offers only. A pet nobody sells
 * still renders: Notify Me, then similar pets that have offers, then a way to
 * sell one (all server HTML).
 */
export function ItemListingsView({ gameSlug, data, about }: { gameSlug: string; data: Data; about: ItemAbout }) {
  const { pair, catalog, model, offers, offerVariants } = data
  const { item } = model
  const traits = traitDefs(gameSlug, catalog)
  const browseHref = `/${gameSlug}/${pair.categorySlug}`
  const rarity = item.rarity ? rarityMeta(gameSlug, item.rarity) : null
  // A quiet internal link from the About sentence (never a button): only when the item has a public value page.
  const valueHref = hasHubPage(gameSlug, 'values') && item.hasPage !== false ? `/${gameSlug}/values/${item.slug}` : null

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6 md:pt-0 lg:px-8">
      {/* Breadcrumbs only for search (JSON-LD in the route); a back button on screen, GameBoost's (owner, 2026-11-03). Phones have theirs in the sub-navbar. */}
      <div className="relative">
        <BackButton
          href={browseHref}
          className="mb-4 bg-[rgba(28,29,35,0.66)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-xl hover:bg-[rgba(46,47,54,0.8)] max-md:hidden min-[1400px]:absolute min-[1400px]:-left-[60px] min-[1400px]:top-0 min-[1400px]:mb-0"
        >
          <ArrowLeftIcon aria-hidden size={18} weight="bold" />
        </BackButton>

        <ItemBuyClient
          gameSlug={gameSlug}
          gameName={pair.gameName}
          itemSlug={item.slug}
          itemName={item.name}
          imageUrl={item.imageUrl ?? null}
          noun={traitNoun(gameSlug)}
          traits={traits}
          offers={offers}
          offerVariants={offerVariants}
          urlVariant={model.variant}
          basePath={model.canonicalPath}
          rarity={rarity ? { label: rarity.label, color: rarity.color } : null}
          deliveryMethod={deliveryMethodLabel(gameSlug)}
          deliveryFallback={defaultDeliveryNote(gameSlug, pair.gameName)}
          trust={<TrustRow />}
        />
      </div>

      <div className={cn(ITEM_SECTION_GAP, 'flex flex-col gap-14 sm:gap-20')}>
        {offers.length === 0 ? (
          <div>
            <TrackOnMount event={{ event: 'fallback_shown', surface: 'item_buy', game: gameSlug, item: item.slug, variant: model.variant }} />
            <PopularCarousel id="similar-items" heading="Similar Items For Sale" items={stockedToGridItems(gameSlug, model.similar)} gameSlug={gameSlug} />
            <p className="mt-6 text-text-secondary" style={{ fontSize: 'var(--fs-body)' }}>
              Have a {item.name}?{' '}
              <Link href={`/${gameSlug}/sell?src=item-buy-page`} className="font-semibold text-lime-text hover:underline">
                Sell it on DropMarket
              </Link>
              <span aria-hidden className="mx-2 text-text-tertiary">·</span>
              <Link href={browseHref} className="font-semibold text-text-primary hover:underline">
                Browse All {pair.gameName} Items
              </Link>
            </p>
          </div>
        ) : null}

        <PopularCarousel id="related-items" heading={about.relatedHeading} items={stockedToGridItems(gameSlug, model.related)} gameSlug={gameSlug} />
        <ItemFaq title={`Questions About Buying ${item.name}`} about={about} />
        <ItemDetails about={about} itemName={item.name} valueHref={valueHref} />
      </div>
    </main>
  )
}
