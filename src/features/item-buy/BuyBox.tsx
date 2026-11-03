'use client'

import type { Ref } from 'react'
import NumberFlow from '@number-flow/react'
import { IconChevronRight } from '@tabler/icons-react'
import { SmartLink } from '@/components/global/SmartLink'
import { BuyButton } from '@/components/marketplace/BuyButton'
import { SellerIdentity } from '@/components/marketplace/CurrencySellerRow'
import { NumberField } from '@/components/ui/number-field'
import { NotifyMeButton } from '@/features/items-grid/NotifyMeButton'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { BUY_CTA_LABEL } from '@/lib/config/purchases'
import { sellerDisplayName, sellerShopSlug } from '@/lib/seller/identity'
import { cn } from '@/lib/utils'
import { BuyPromises } from './BuyPromises'
import { PaymentMarks } from './PaymentMarks'
import { TraitField } from './TraitField'
import { maxQtyOf } from './money'
import type { TraitOption } from './model/offers'

const USD = { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 } as const

/** Desktop only: the buy box and seller sit in cards; phones keep everything on the page (owner, 2026-11-02). */
const LG_CARD = 'lg:rounded-lg lg:bg-[linear-gradient(180deg,#212228_0%,#1A1B1F_100%)] lg:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]'

/**
 * The pet's name. Its own piece so phones show it first (over the picture, as
 * Eldorado does) and desktop puts it beside the picture. Screens show just
 * "Parrot" (owner, 2026-11-02: no clutter line over it); the heading reads
 * "Adopt Me Parrot" to search engines and screen readers.
 */
export function ItemTitle({ itemName, gameName }: { itemName: string; gameName: string }) {
  return (
    <h1 id="item-title" className="text-balance text-[24px] font-bold leading-tight tracking-[-0.02em] text-text-primary lg:text-[28px]">
      <span className="sr-only">{gameName} </span>
      {itemName}
    </h1>
  )
}

export interface BuyBoxProps {
  gameSlug: string
  itemSlug: string
  noun: 'Trait' | 'Mutation'
  traits: TraitOption[]
  trait: string | null
  onTrait: (variant: string) => void
  offer: ItemOffer | null
  /** "Neon Fly Ride Parrot" — what Notify Me waits for. */
  wantedName: string
  qty: number
  onQty: (qty: number) => void
  onBuy: () => void
  navigating: boolean
  isOwn: boolean
  buyRef: Ref<HTMLDivElement>
}

/**
 * The buy column (owner, 2026-10-27/28, 2026-11-02; StockX's buy box and
 * Eldorado's phone page as references): the trait dropdown (owner,
 * 2026-11-02: one field, not five buttons), a divider, the price
 * (rolling when the trait changes) with the quantity, Buy, the three promises
 * as plain rows, then the ways to pay; the seller under it. Desktop frames it
 * in a card; on phones it floats on the page. A trait nobody sells gets
 * Notify Me instead.
 */
export function BuyBox(p: BuyBoxProps) {
  const { offer } = p
  const max = offer ? maxQtyOf(offer) : 1
  const off = offer?.originalPrice && offer.originalPrice > offer.pricePerUnit ? Math.round((1 - offer.pricePerUnit / offer.originalPrice) * 100) : 0

  return (
    <section id="buy-box" aria-labelledby="item-title" className="scroll-mt-game-chrome">
      <div className={cn('lg:p-6', LG_CARD)}>
        {p.traits.length > 0 ? (
          <>
            <TraitField noun={p.noun} options={p.traits} value={p.trait} onChange={p.onTrait} />
            <div aria-hidden className="my-5 h-px bg-white/[0.08]" />
          </>
        ) : null}

        {offer ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-baseline gap-2.5">
                <NumberFlow
                  value={offer.pricePerUnit * p.qty}
                  format={USD}
                  className="font-bold tabular-nums text-text-primary"
                  style={{ fontSize: 'clamp(26px, 22px + 0.6vw, 30px)', letterSpacing: '-0.025em', lineHeight: 1 }}
                />
                {off > 0 ? <span className="rounded bg-lime-tint-bg px-1.5 py-0.5 text-[12px] font-bold text-lime-text">-{off}%</span> : null}
              </div>
              {max > 1 && !p.isOwn ? (
                <NumberField
                  value={p.qty}
                  onChange={(v) => p.onQty(Math.max(1, Math.min(max, v || 1)))}
                  minValue={1}
                  maxValue={max}
                  className="h-11 w-[124px] shrink-0"
                  ariaLabel="Quantity"
                />
              ) : null}
            </div>
            <div ref={p.buyRef} className="mt-4">
              <BuyButton onClick={p.onBuy} loading={p.navigating} loadingLabel="Loading Checkout…" className="h-14 w-full text-[16px]" disabled={!offer.isUnlimited && (offer.stock ?? 1) <= 0}>
                {p.isOwn ? 'Edit Your Listing' : BUY_CTA_LABEL}
              </BuyButton>
            </div>
          </>
        ) : (
          <div ref={p.buyRef}>
            <div className="font-semibold uppercase tracking-[0.12em] text-text-tertiary" style={{ fontSize: 'var(--fs-micro)' }}>
              Not Listed Yet
            </div>
            <p className="mt-1.5 font-semibold text-text-primary" style={{ fontSize: 'var(--fs-card-title)' }}>
              No {p.wantedName} for sale right now.
            </p>
            <NotifyMeButton gameSlug={p.gameSlug} itemSlug={p.itemSlug} itemName={p.wantedName} variant={p.trait} className="mt-4 h-12 w-full justify-center text-[15px]" />
          </div>
        )}

        <div className="mt-5">
          <BuyPromises />
        </div>
        <div className="mt-5">
          <PaymentMarks />
        </div>
      </div>

      {offer ? <SellerCard offer={offer} isOwn={p.isOwn} /> : null}
    </section>
  )
}

/**
 * Who sells it: the house seller identity (avatar, name, badge, rating and
 * sales) and the way into their shop. A small card on desktop (owner,
 * 2026-10-28); on phones a plain row between two hairlines.
 */
function SellerCard({ offer, isOwn }: { offer: ItemOffer; isOwn: boolean }) {
  const slug = sellerShopSlug(offer.seller)
  const s = offer.seller
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <SellerIdentity
          size={38}
          seller={{ name: sellerDisplayName(s), avatarUrl: s.avatarUrl, verified: s.verified, rating: s.ratingPercent, reviews: s.reviewCount, sales: s.sales, tier: s.tier ?? null }}
        />
      </div>
      {isOwn ? <span className="shrink-0 rounded bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">Yours</span> : null}
      {slug ? <IconChevronRight aria-hidden size={16} stroke={2} className="shrink-0 text-text-tertiary" /> : null}
    </>
  )
  const cls = cn(
    'mt-5 flex min-w-0 items-center gap-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_0_rgba(255,255,255,0.07)]',
    'lg:mt-3 lg:px-4 lg:py-3',
    LG_CARD,
  )
  return slug ? (
    <SmartLink
      href={`/shop/${slug}`}
      aria-label={`${sellerDisplayName(s)}'s shop`}
      className={cn(cls, 'transition-[background-image] duration-200 lg:hover:bg-[linear-gradient(180deg,#27282F_0%,#1E1F25_100%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring')}
    >
      {body}
    </SmartLink>
  ) : (
    <div className={cls}>{body}</div>
  )
}
