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
import { PAGE_TITLE } from '@/components/marketplace/page-scale'
import { BuyPromises } from './BuyPromises'
import { GLASS } from './layout'
import { PaymentMarks } from './PaymentMarks'
import { TraitField } from './TraitField'
import { maxQtyOf } from './money'
import type { TraitOption } from './model/offers'

const USD = { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 } as const

/**
 * The pet's name. Its own piece so phones show it first (over the picture, as
 * Eldorado does) and desktop puts it beside the picture. Screens show just
 * "Parrot" (owner, 2026-11-02: no clutter line over it); the heading reads
 * "Adopt Me Parrot" to search engines and screen readers.
 */
export function ItemTitle({ itemName, gameName }: { itemName: string; gameName: string }) {
  return (
    <h1 id="item-title" className={cn('text-balance', PAGE_TITLE)}>
      <span className="sr-only">{gameName} </span>
      {itemName}
    </h1>
  )
}

/** The one picker a page has: a trait, a mutation, or Common / Chroma. */
export interface ItemPickerProps {
  noun: string
  options: TraitOption[]
  value: string | null
  onChange: (value: string) => void
}

export interface BuyBoxProps {
  gameSlug: string
  itemSlug: string
  picker: ItemPickerProps | null
  /** What Notify Me waits for. */
  trait: string | null
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
 * Eldorado's phone page as references): the price (rolling when the trait
 * changes) with the quantity, Buy, the three promises, then the ways to pay; the
 * seller under it. Desktop: one glass card holding all of it (owner, 2026-11-04:
 * cleaner, not two big panels), with the trait picker under the picture instead;
 * on phones it floats on the page with the picker on top, the promises in one
 * sliding row and the ways to pay under the seller. A trait nobody sells gets
 * Notify Me instead.
 *
 * Desktop: one height whatever's on show, an offer or Notify Me, a quantity box or
 * none, because the picture and the description take theirs from it (owner,
 * 2026-11-06: switching Emberbow to Chroma Emberbow shrank the picture).
 */
export function BuyBox(p: BuyBoxProps) {
  const { offer } = p
  const max = offer ? maxQtyOf(offer) : 1
  const off = offer?.originalPrice && offer.originalPrice > offer.pricePerUnit ? Math.round((1 - offer.pricePerUnit / offer.originalPrice) * 100) : 0

  return (
    // Phones: lands under the navbar and the back row, both fixed there.
    <section id="buy-box" aria-labelledby="item-title" className={cn(GLASS, 'scroll-mt-game-chrome max-lg:scroll-mt-[calc(var(--subnav-top)+68px)] lg:flex lg:min-h-[453px] lg:flex-col lg:p-6')}>
      <div className="lg:flex lg:flex-1 lg:flex-col">
        {p.picker ? (
          <div className="lg:hidden">
            <TraitField {...p.picker} />
            <div aria-hidden className="my-5 h-px bg-white/[0.08]" />
          </div>
        ) : null}

        {offer ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-baseline gap-2.5">
                <NumberFlow
                  value={offer.pricePerUnit * p.qty}
                  format={USD}
                  className="font-bold tabular-nums text-text-primary lg:font-semibold"
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
                  className="h-11 w-[124px] shrink-0 lg:border-transparent lg:bg-white/[0.08] lg:[&>button]:border-transparent"
                  ariaLabel="Quantity"
                />
              ) : null}
            </div>
            <div ref={p.buyRef} className="mt-6 lg:mt-5">
              <BuyButton onClick={p.onBuy} loading={p.navigating} loadingLabel="Loading Checkout…" className="h-14 w-full text-[16px] lg:h-[52px]" disabled={!offer.isUnlimited && (offer.stock ?? 1) <= 0}>
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
            <NotifyMeButton gameSlug={p.gameSlug} itemSlug={p.itemSlug} itemName={p.wantedName} variant={p.trait} className="mt-4 h-12 w-full justify-center text-[14px]" />
          </div>
        )}

        <div className="mt-6 lg:mb-5 lg:mt-auto lg:pt-5">
          <BuyPromises />
        </div>
        <div className="hidden pt-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:block">
          <PaymentMarks />
        </div>
      </div>

      {offer ? <SellerCard offer={offer} isOwn={p.isOwn} /> : null}
      {/* Phones and tablets: under the seller (owner, 2026-11-03). */}
      <div className="mt-6 lg:hidden">
        <PaymentMarks />
      </div>
    </section>
  )
}

/**
 * Who sells it: the house seller identity (avatar, name, badge, rating and
 * sales) and the way into their shop. The buy card's last row on desktop (owner,
 * 2026-11-04), under a hairline; on phones a plain row between two hairlines.
 */
function SellerCard({ offer, isOwn }: { offer: ItemOffer; isOwn: boolean }) {
  const slug = sellerShopSlug(offer.seller)
  const s = offer.seller
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <SellerIdentity
          seller={{ name: sellerDisplayName(s), avatarUrl: s.avatarUrl, verified: s.verified, rating: s.ratingPercent, reviews: s.reviewCount, sales: s.sales, tier: s.tier ?? null }}
        />
      </div>
      {isOwn ? <span className="shrink-0 rounded bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">Yours</span> : null}
      {slug ? <IconChevronRight aria-hidden size={16} stroke={2} className="shrink-0 text-text-tertiary" /> : null}
    </>
  )
  // Desktop: the hover fill reaches 12px past the text edge; the negative margin keeps the avatar on that edge.
  const cls = cn(
    'mt-6 flex min-w-0 items-center gap-3 py-3.5 max-lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_0_rgba(255,255,255,0.07)]',
    'lg:-mx-3 lg:-mb-2 lg:mt-1 lg:rounded-md lg:px-3 lg:py-2',
  )
  return (
    <>
      <div aria-hidden className="mt-4 hidden h-px bg-white/[0.08] lg:block" />
      {slug ? (
        <SmartLink
          href={`/shop/${slug}`}
          aria-label={`${sellerDisplayName(s)}'s shop`}
          className={cn(cls, 'transition-colors duration-200 lg:hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring')}
        >
          {body}
        </SmartLink>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </>
  )
}
