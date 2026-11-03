import Link from '@/components/navigation/AppLink'
import { IconChevronRight } from '@tabler/icons-react'
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
 * The pet page body (owner, 2026-10-26/27/28, Eldorado as the reference):
 * the picture and its spec card with the delivery instructions under them on
 * the left; on the right the buy panel (name, trait picker, price, quantity,
 * Buy or Notify Me, ways to pay) and a small seller card. Then the three
 * promises, every offer as a full-width row, the details and the FAQ.
 * Filtered on the server, so the first HTML holds this pet's offers only. A
 * pet nobody sells still renders: Notify Me, then similar pets that have
 * offers, then a way to sell one. Under it, for every pet: its details, the
 * badge guide, buyer questions and links to related pets (all server HTML).
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
      {/* Phones get the back bar in the sub-navbar instead (owner, 2026-11-02); the breadcrumb JSON-LD stays for search. */}
      <nav aria-label="Breadcrumb" className="mb-6 text-text-tertiary max-md:hidden" style={{ fontSize: 'var(--fs-meta)' }}>
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href={`/${gameSlug}`} className="transition-colors hover:text-text-primary">
              {pair.gameName}
            </Link>
          </li>
          <li aria-hidden>
            <IconChevronRight size={14} stroke={2} />
          </li>
          <li>
            <Link href={browseHref} className="transition-colors hover:text-text-primary">
              Buy Items
            </Link>
          </li>
          <li aria-hidden>
            <IconChevronRight size={14} stroke={2} />
          </li>
          <li className="text-text-secondary" aria-current="page">
            {item.name}
          </li>
        </ol>
      </nav>

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

        <ItemDetails about={about} itemName={item.name} valueHref={valueHref} />
        <ItemFaq title={`Questions About Buying ${item.name}`} about={about} />
        <PopularCarousel id="related-items" heading={about.relatedHeading} items={stockedToGridItems(gameSlug, model.related)} gameSlug={gameSlug} />
      </div>
    </main>
  )
}
