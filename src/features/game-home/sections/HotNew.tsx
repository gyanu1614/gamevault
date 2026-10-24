import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon, SparkleIcon } from '@phosphor-icons/react/dist/ssr'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import type { HotNewCard, HotNewModel } from '../types'
import { SectionHeading } from './SectionHeading'

/**
 * Hot New {Game} {Items} (owner, 2026-10-23): the game's newest items, ranked
 * by our own offers (model/hot-new.ts). An item we stock sells straight from
 * the card ("Buy From $X"); one nobody lists yet asks sellers to be first.
 * One surface per card (no nested boxes); the art sits on a soft lime glow,
 * the New colour of the value lists. Cards rise in turn as the row enters.
 */
function Card({ card, sellHref, index }: { card: HotNewCard; sellHref: string; index: number }) {
  const inStock = card.buyHref != null
  return (
    <li className="gh-reveal" style={{ ['--gh-i' as string]: index }}>
      <article
        className={cn(
          'group relative flex h-full flex-col items-center rounded-xl px-4 pb-4 pt-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-transform duration-300 hover:-translate-y-1',
          MARKET_CARD,
        )}
      >
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-[5px] bg-[#B6E36A]/[0.14] px-2 py-[3px] text-[11px] font-bold text-[#B6E36A]">
          <SparkleIcon size={11} weight="fill" aria-hidden />
          New
        </span>

        <span className="relative grid h-[118px] w-full place-items-center">
          <span aria-hidden className="absolute inset-x-[12%] inset-y-0 rounded-full bg-[radial-gradient(circle,rgba(182,227,106,0.16),transparent_64%)]" />
          <span aria-hidden className="absolute bottom-1 h-3 w-20 rounded-full bg-black/55 blur-md" />
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.imageUrl}
              alt={card.name}
              width={108}
              height={108}
              loading="lazy"
              decoding="async"
              className="relative h-[96px] w-[96px] object-contain transition-transform duration-300 group-hover:scale-[1.05] sm:h-[108px] sm:w-[108px]"
            />
          ) : (
            <SparkleIcon size={44} weight="duotone" className="relative text-[#B6E36A]/70" aria-hidden />
          )}
        </span>

        <h3 className="mt-2 line-clamp-1 text-[16px] font-semibold tracking-[-0.01em] text-text-primary sm:text-[17px]">{card.name}</h3>
        <p className="mt-0.5 text-[12.5px] tabular-nums text-text-secondary sm:text-[13px]">
          {inStock ? `${card.offers} ${card.offers === 1 ? 'offer' : 'offers'} on DropMarket` : 'No offers yet'}
        </p>

        <div className="mt-auto w-full pt-4">
          {inStock ? (
            <Link
              href={card.buyHref!}
              className="flex h-10 w-full items-center justify-center rounded-md bg-[#2F7A4B] text-[13.5px] font-bold text-white transition-[background-color,transform] hover:bg-[#358A55] active:scale-[0.98]"
            >
              {card.fromPrice != null ? `Buy From $${formatStatPrice(card.fromPrice)}` : 'Buy Now'}
            </Link>
          ) : (
            <Link
              href={sellHref}
              className="flex h-10 w-full items-center justify-center rounded-md bg-[#F5C451]/[0.14] text-[13.5px] font-bold text-[#F5C451] transition-[background-color,transform] hover:bg-[#F5C451]/[0.22] active:scale-[0.98]"
            >
              Sell Yours First
            </Link>
          )}
          {card.valueHref && (
            <Link
              href={card.valueHref}
              className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
            >
              How To Get
              <ArrowRightIcon size={12} weight="bold" aria-hidden />
            </Link>
          )}
        </div>
      </article>
    </li>
  )
}

export function HotNew({ model, gameName }: { model: HotNewModel; gameName: string }) {
  return (
    <section aria-labelledby="hot-new" className="mt-16 sm:mt-20">
      <SectionHeading
        id="hot-new"
        title={model.title}
        sub={`Just added to ${gameName}. Updated daily.`}
        action={{ href: model.allHref, label: 'All New' }}
      />
      <ul className="gh-reveal-group grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {model.cards.map((card, i) => (
          <Card key={card.slug} card={card} sellHref={model.sellHref} index={i} />
        ))}
      </ul>
    </section>
  )
}
