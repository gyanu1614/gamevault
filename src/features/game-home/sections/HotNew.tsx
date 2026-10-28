import Link from '@/components/navigation/AppLink'
import { IconSparkles } from '@tabler/icons-react'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { NotifyMeButton } from '@/features/items-grid/NotifyMeButton'
import type { HotNewCard, HotNewModel } from '../types'
import { SectionHeading } from './SectionHeading'

/**
 * Hot New {Game} {Items}: the game's newest items ranked by our own offers
 * (model/hot-new.ts). Built on the listing card's system (ItemCard): the
 * marketplace fill, 10px corners, a footer band one step lighter, hover
 * lightens in place and nothing moves, fill only. An item we stock sells from
 * the card with the house buy button; one nobody lists gets Notify Me, with a
 * Sell Yours link under it. Never a link to the value page (owner, 2026-10-24:
 * links go values → market, not back).
 */
function Card({ card, gameSlug, sellHref }: { card: HotNewCard; gameSlug: string; sellHref: string }) {
  const inStock = card.buyHref != null
  return (
    <li>
      <article className={cn('group relative flex h-full flex-col overflow-hidden rounded-lg', MARKET_CARD, MARKET_CARD_HOVER)}>
        <div className="flex flex-1 flex-col items-center text-center" style={{ padding: 'var(--gap-card)' }}>
          <span className="inline-flex h-6 items-center gap-1 self-start rounded bg-lime-tint-bg px-2 text-[11.5px] font-semibold text-lime-text">
            <IconSparkles aria-hidden size={13} stroke={2} />
            New
          </span>
          <span className="mt-2 grid h-[104px] w-full place-items-center sm:h-[120px]">
            {card.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={card.imageUrl} alt={card.name} width={112} height={112} loading="lazy" decoding="async" className="h-[96px] w-[96px] object-contain sm:h-[112px] sm:w-[112px]" />
            ) : (
              <span className="font-medium uppercase tracking-wider text-text-tertiary" style={{ fontSize: 'var(--fs-micro)' }}>
                No image
              </span>
            )}
          </span>
          <h3 className="mt-3 line-clamp-1 text-text-primary" style={{ fontSize: 'var(--fs-card-title)', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 'var(--lh-card-title)' }}>
            {card.name}
          </h3>
          <p className="mt-1 tabular-nums text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
            {inStock ? `${card.offers} ${card.offers === 1 ? 'Offer' : 'Offers'} on DropMarket` : 'No Offers Yet'}
          </p>
        </div>

        {/* Footer band, as on the listing card: one step lighter, lightens again on hover. */}
        <div className="flex flex-col gap-2 bg-[#24252B] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors group-hover:bg-[#2A2B31]" style={{ padding: 'calc(var(--gap-card) * 0.6) var(--gap-card)' }}>
          {inStock ? (
            <Link href={card.buyHref!} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
              <BuyButtonFace size="sm" className="w-full">
                {card.fromPrice != null ? `Buy From $${formatStatPrice(card.fromPrice)}` : 'Buy Now'}
              </BuyButtonFace>
            </Link>
          ) : (
            <>
              <NotifyMeButton gameSlug={gameSlug} itemSlug={card.slug} itemName={card.name} className="w-full justify-center" />
              <Link href={sellHref} className="text-center font-semibold text-text-secondary transition-colors hover:text-text-primary" style={{ fontSize: 'var(--fs-meta)' }}>
                Sell Yours
              </Link>
            </>
          )}
        </div>
      </article>
    </li>
  )
}

export function HotNew({ model, gameSlug, gameName }: { model: HotNewModel; gameSlug: string; gameName: string }) {
  return (
    <section aria-labelledby="hot-new">
      <SectionHeading id="hot-new" title={model.title} sub={`Just added to ${gameName}. Updated daily.`} action={{ href: model.allHref, label: 'All New' }} />
      <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {model.cards.map((card) => (
          <Card key={card.slug} card={card} gameSlug={gameSlug} sellHref={model.sellHref} />
        ))}
      </ul>
    </section>
  )
}
