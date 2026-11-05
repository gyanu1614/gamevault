import Link from '@/components/navigation/AppLink'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import { IconSparkles } from '@tabler/icons-react'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { TraitMarks } from '@/features/item-buy/TraitMarks'
import type { GridItem } from './model/grid'
import { ItemPicture } from './ItemPicture'
import { NotifyMeButton } from './NotifyMeButton'

/**
 * One catalogue item on the Items page. Picture box on top, edge to edge, then
 * the name centred and the price (owner, 2026-11-02, Eldorado's item grid as
 * the reference: two to a row on phones, four on wide screens; 2026-11-03: no
 * row of traits, no rarity line, it read "Legendary" on every card and the pet
 * page shows it; shorter on phones). The one trait mark left is on a search or
 * trait-filter card, a small badge on the picture, because that is all that
 * tells "Parrot" FR and "Parrot" NFR apart. Two flat tones from the page's own
 * family (owner, 2026-11-03: "bg related but a bit distinct"): the house card's
 * fade ended almost on the page colour, so the lower half melted into the page.
 * The item NAME is the link and stretches over the whole card, so the anchor
 * text crawlers read is the item name; hover lightens in place, nothing moves.
 * Nobody sells it yet: Notify Me (in-stock email) sits above the stretched link.
 */
export function GridCard({ item, gameSlug }: { item: GridItem; gameSlug: string }) {
  const inStock = item.offers > 0 && item.minPrice != null

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg bg-[#212228] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] transition-colors hover:bg-[#26272D]">
      {/* Edge to edge: the card's own corners clip the picture box. */}
      <div className="relative grid h-[92px] place-items-center bg-[#2E2F36] transition-colors group-hover:bg-[#33343B] sm:h-[136px]">
        <ItemPicture src={item.imageUrl} name={item.name} className="h-[76%] w-[76%] drop-shadow-[0_10px_14px_rgba(0,0,0,0.4)]" />
        {item.isNew && (
          <span className="absolute left-2 top-2 inline-flex h-5 items-center gap-1 rounded bg-lime-tint-bg px-1.5 text-[12px] font-semibold text-lime-text sm:left-2.5 sm:top-2.5 sm:h-6 sm:px-2">
            <IconSparkles aria-hidden size={12} stroke={2} />
            New
          </span>
        )}
        {item.pickedForm &&
          (gameSlug === 'adopt-me' ? (
            <TraitMarks code={item.pickedForm} size={16} className="absolute right-2 top-2 sm:right-2.5 sm:top-2.5" />
          ) : (
            <span className="absolute right-2 top-2 inline-flex h-5 items-center rounded bg-black/40 px-1.5 text-[11px] font-semibold text-text-primary sm:right-2.5 sm:top-2.5">{item.pickedForm}</span>
          ))}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 text-center text-[16px] font-bold leading-snug tracking-[-0.01em] text-text-primary">
          <Link
            href={item.href}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-focus-soft"
          >
            {item.name}
          </Link>
        </h3>

        <div className="mt-auto pt-2 sm:pt-3">
          {inStock ? (
            <div className="flex items-end justify-between gap-2">
              {/* Phones: "From $54.99" on one line, so the card stays short. */}
              <span className="flex min-w-0 items-baseline gap-1.5 sm:flex-col sm:items-start sm:gap-0">
                <span className="text-[13px] font-medium text-text-secondary">From</span>
                <span className="text-[16px] font-bold tabular-nums leading-tight text-text-primary sm:text-[length:var(--fs-price)]">${formatStatPrice(item.minPrice!)}</span>
              </span>
              {/* The card's buy cue (the whole card is the link): quiet at rest, brand green on hover, nothing moves. */}
              <span
                aria-hidden
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/[0.07] text-text-primary transition-colors group-hover:bg-lime group-hover:text-text-inverse sm:h-9 sm:w-9"
              >
                <ArrowOutwardRoundedIcon style={{ fontSize: 18 }} />
              </span>
            </div>
          ) : (
            // As tall as the priced card's From + price, so every card in the grid is one height.
            <div className="flex items-end justify-between gap-2 sm:min-h-[46px]">
              <span className="pb-2 text-[13px] font-medium text-text-secondary max-sm:hidden">No Offers Yet</span>
              <NotifyMeButton gameSlug={gameSlug} itemSlug={item.slug} itemName={item.name} className="max-sm:h-8 max-sm:w-full max-sm:justify-center" />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
