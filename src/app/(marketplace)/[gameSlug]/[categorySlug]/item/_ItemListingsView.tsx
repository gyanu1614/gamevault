import Link from '@/components/navigation/AppLink'
import { IconChevronRight } from '@tabler/icons-react'
import { TrackOnMount } from '@/components/value-listings/TrackOnMount'
import { ItemBuyClient } from '@/features/item-buy/ItemBuyClient'
import { PictureBox } from '@/features/item-buy/PictureBox'
import { initialTrait, traitNoun } from '@/features/item-buy/model/offers'
import { traitDefs } from '@/features/item-buy/model/traits'
import { formatUsd } from '@/lib/value-listings/format'
import { rarityMeta } from '@/lib/values/rarity'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import type { loadItemListingsPage } from '../_valueItemOffers'

type Data = NonNullable<Awaited<ReturnType<typeof loadItemListingsPage>>>

/**
 * The pet page body (owner, 2026-10-26, GameBoost/Eldorado as the
 * reference): the picture in a box with the trust strip, the buy box (seller,
 * price, trait picker, Buy or Notify Me), then the trait's other offers.
 * Filtered on the server, so the first HTML holds this pet's offers only. A
 * pet nobody sells still renders: Notify Me, then similar pets that have
 * offers, then a way to sell one.
 */
export function ItemListingsView({ gameSlug, data }: { gameSlug: string; data: Data }) {
  const { pair, catalog, model, offers, offerVariants } = data
  const { item } = model
  const traits = traitDefs(gameSlug, catalog)
  const r = item.rarity ? rarityMeta(gameSlug, item.rarity) : null
  const rarity = r?.label ? { label: r.label, color: r.color } : null
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
        rarity={rarity}
        noun={traitNoun(gameSlug)}
        traits={traits}
        offers={offers}
        offerVariants={offerVariants}
        initialTrait={initialTrait(traits, model.variant)}
        basePath={model.canonicalPath}
        picture={<PictureBox imageUrl={item.imageUrl ?? null} name={`${pair.gameName} ${item.name}`} />}
      />

      {offers.length === 0 ? (
        <>
          <TrackOnMount event={{ event: 'fallback_shown', surface: 'item_buy', game: gameSlug, item: item.slug, variant: model.variant }} />
          {model.similar.length > 0 ? (
            <section aria-labelledby="similar-items" className="mt-12 sm:mt-14">
              <h2 id="similar-items" className="mb-5 text-[20px] font-bold tracking-[-0.01em] text-text-primary sm:text-[24px]">
                Similar Items For Sale
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--gap-grid)' }}>
                {model.similar.map((s) => (
                  <li key={s.slug}>
                    <Link href={s.href} className={cn('flex h-full items-center gap-3 rounded-lg p-3', MARKET_CARD, MARKET_CARD_HOVER)}>
                      {s.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- catalogue art */
                        <img src={s.imageUrl} alt="" aria-hidden width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-md object-contain" />
                      ) : null}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
                          {s.name}
                        </span>
                        <span className="block tabular-nums text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
                          {s.count} {s.count === 1 ? 'Offer' : 'Offers'} from {formatUsd(s.minPriceUsd)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
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
    </main>
  )
}
