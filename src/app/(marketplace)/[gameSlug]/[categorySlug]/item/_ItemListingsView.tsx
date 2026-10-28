import Link from '@/components/navigation/AppLink'
import { IconChevronRight } from '@tabler/icons-react'
import { TrackOnMount } from '@/components/value-listings/TrackOnMount'
import { ItemBuyClient } from '@/features/item-buy/ItemBuyClient'
import { TrustpilotRow } from '@/features/item-buy/TrustpilotRow'
import { traitNoun } from '@/features/item-buy/model/offers'
import { traitDefs } from '@/features/item-buy/model/traits'
import { ItemDetails, ItemFaq, StockedItemLinks } from '@/features/item-buy/ItemAbout'
import type { ItemAbout } from '@/features/item-buy/model/about'
import { formatUsd } from '@/lib/value-listings/format'
import type { loadItemListingsPage } from '../_valueItemOffers'

type Data = NonNullable<Awaited<ReturnType<typeof loadItemListingsPage>>>

/**
 * The pet page body (owner, 2026-10-26/27, GameBoost/Eldorado as the
 * reference): the picture with the pet's facts and the other offers on the
 * left; on the right the buy panel (name, price, trait box, quantity, Buy or
 * Notify Me, trust promises) and a small seller card.
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

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6 md:pt-0 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
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
        trustpilot={<TrustpilotRow />}
      />

      {offers.length === 0 ? (
        <>
          <TrackOnMount event={{ event: 'fallback_shown', surface: 'item_buy', game: gameSlug, item: item.slug, variant: model.variant }} />
          <StockedItemLinks id="similar-items" heading="Similar Items For Sale" items={model.similar} />
          <p className="mt-10 text-text-secondary" style={{ fontSize: 'var(--fs-body)' }}>
            Have a {item.name}?{' '}
            <Link href={`/${gameSlug}/sell?src=item-buy-page`} className="font-semibold text-lime-text hover:underline">
              Sell it on DropMarket
            </Link>
            <span aria-hidden className="mx-2 text-text-tertiary">·</span>
            <Link href={browseHref} className="font-semibold text-text-primary hover:underline">
              Browse All {pair.gameName} Items
            </Link>
          </p>
        </>
      ) : null}

      <ItemDetails about={about} />
      <ItemFaq title={`Questions About Buying ${item.name}`} about={about} />
      <StockedItemLinks id="related-items" heading={about.relatedHeading} items={model.related} />
    </main>
  )
}
