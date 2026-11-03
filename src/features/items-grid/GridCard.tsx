import Link from '@/components/navigation/AppLink'
import { IconSparkles } from '@tabler/icons-react'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { TraitMarks } from '@/features/item-buy/TraitMarks'
import type { GridItem } from './model/grid'
import { ItemPicture } from './ItemPicture'
import { NotifyMeButton } from './NotifyMeButton'

/**
 * One catalogue item on the Items page. Picture on top, then the name centred
 * and the price (owner, 2026-11-02, Eldorado's item grid as the reference: two
 * to a row on phones, four on wide screens; 2026-11-03: no row of traits, no
 * rarity line, it read "Legendary" on every card and the pet page shows it;
 * shorter on phones). The one trait mark left is on a search or trait-filter card, a
 * small badge on the picture, because that is all that tells "Parrot" FR and
 * "Parrot" NFR apart. The item NAME is the link and stretches over the whole
 * card, so the anchor text crawlers read is the item name; hover lightens in
 * place, nothing moves. Nobody sells it yet: Notify Me (in-stock email) sits
 * above the stretched link.
 */
export function GridCard({ item, gameSlug }: { item: GridItem; gameSlug: string }) {
  const inStock = item.offers > 0 && item.minPrice != null

  return (
    <article className={cn('group relative flex h-full flex-col overflow-hidden rounded-lg', MARKET_CARD, MARKET_CARD_HOVER)}>
      <div className="p-2 pb-0 sm:p-2.5 sm:pb-0">
        <div className="relative grid h-[92px] place-items-center overflow-hidden rounded-md bg-white/[0.04] transition-colors group-hover:bg-white/[0.06] sm:h-[136px]">
          <ItemPicture src={item.imageUrl} name={item.name} className="h-[76%] w-[76%] drop-shadow-[0_10px_14px_rgba(0,0,0,0.4)]" />
          {item.isNew && (
            <span className="absolute left-1.5 top-1.5 inline-flex h-5 items-center gap-1 rounded bg-lime-tint-bg px-1.5 text-[11px] font-semibold text-lime-text sm:left-2 sm:top-2 sm:h-6 sm:px-2 sm:text-[11.5px]">
              <IconSparkles aria-hidden size={12} stroke={2} />
              New
            </span>
          )}
          {item.pickedForm &&
            (gameSlug === 'adopt-me' ? (
              <TraitMarks code={item.pickedForm} size={16} className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2" />
            ) : (
              <span className="absolute right-1.5 top-1.5 inline-flex h-5 items-center rounded bg-black/40 px-1.5 text-[11px] font-semibold text-text-primary sm:right-2 sm:top-2">{item.pickedForm}</span>
            ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
        <h3 className="line-clamp-2 text-center text-[15px] font-bold leading-snug tracking-[-0.01em] text-text-primary sm:text-[16px]">
          <Link
            href={item.href}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-focus-soft"
          >
            {item.name}
          </Link>
        </h3>

        <div className="mt-auto pt-2 sm:pt-3">
          {inStock ? (
            <div className="flex items-end justify-center gap-2 sm:justify-between">
              {/* Phones: "From $54.99" on one line under the name, no offer count, so the card stays short. */}
              <span className="flex min-w-0 items-baseline gap-1.5 sm:flex-col sm:items-start sm:gap-0">
                <span className="text-[12px] font-medium text-text-secondary sm:text-[13px]">From</span>
                <span className="text-[18px] font-bold tabular-nums leading-tight text-text-primary sm:text-[length:var(--fs-price)]">${formatStatPrice(item.minPrice!)}</span>
              </span>
              <span className="whitespace-nowrap pb-0.5 text-[13px] font-medium tabular-nums text-text-secondary max-sm:hidden">
                {item.offers} {item.offers === 1 ? 'Offer' : 'Offers'}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-text-secondary max-sm:hidden">No Offers Yet</span>
              <NotifyMeButton gameSlug={gameSlug} itemSlug={item.slug} itemName={item.name} className="max-sm:h-8 max-sm:w-full max-sm:justify-center" />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
