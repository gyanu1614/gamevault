'use client'

import type { Ref } from 'react'
import NumberFlow from '@number-flow/react'
import { IconChevronRight } from '@tabler/icons-react'
import { SmartLink } from '@/components/global/SmartLink'
import { BuyButton } from '@/components/marketplace/BuyButton'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { NewSellerBadge } from '@/components/seller/NewSellerBadge'
import { SellerStats } from '@/components/seller/SellerStats'
import { NumberField } from '@/components/ui/number-field'
import { NotifyMeButton } from '@/features/items-grid/NotifyMeButton'
import { SellerAvatar } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemCard'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { BUY_CTA_LABEL } from '@/lib/config/purchases'
import { sellerDisplayName, sellerShopSlug } from '@/lib/seller/identity'
import { cn } from '@/lib/utils'
import { PaymentMarks } from './PaymentMarks'
import { TraitField } from './TraitField'
import { TraitTiles } from './TraitTiles'
import { maxQtyOf } from './money'
import type { TraitOption } from './model/offers'
import { traitPicker } from './model/traits'

const USD = { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 } as const

export interface BuyBoxProps {
  gameSlug: string
  itemSlug: string
  itemName: string
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
 * The buy column (owner, 2026-10-27; StockX's buy box as the reference): the
 * pet's name, the trait picker (Adopt Me's badge tiles, else the dropdown), then ONE framed box with the price ("Buy Now
 * For", rolling when the trait changes), quantity, Buy and ways to pay — the
 * decision and its reassurance in one place. The seller is one line under it.
 * A trait nobody sells gets Notify Me in the box instead.
 */
export function BuyBox(p: BuyBoxProps) {
  const { offer } = p
  const max = offer ? maxQtyOf(offer) : 1
  const off = offer?.originalPrice && offer.originalPrice > offer.pricePerUnit ? Math.round((1 - offer.pricePerUnit / offer.originalPrice) * 100) : 0

  return (
    <section id="buy-box" aria-labelledby="item-title" className="scroll-mt-game-chrome">
      <h1 id="item-title" className="text-balance font-bold text-text-primary" style={{ fontSize: 'clamp(32px, 26px + 1.2vw, 42px)', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
        {p.itemName}
      </h1>

      {p.traits.length > 0 ? (
        <div className="mt-6">
          {traitPicker(p.traits) === 'tiles' ? (
            <TraitTiles noun={p.noun} options={p.traits} value={p.trait} onChange={p.onTrait} />
          ) : (
            <TraitField noun={p.noun} options={p.traits} value={p.trait} onChange={p.onTrait} />
          )}
        </div>
      ) : null}

      <div className="mt-3 rounded-lg bg-[linear-gradient(180deg,#1F2025_0%,#191A1E_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_48px_-28px_rgba(0,0,0,0.9)]">
        {offer ? (
          <>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="font-semibold uppercase tracking-[0.12em] text-text-tertiary" style={{ fontSize: 'var(--fs-micro)' }}>
                  Buy Now For
                </div>
                <div className="mt-1.5 flex items-baseline gap-2.5">
                  <NumberFlow
                    value={offer.pricePerUnit * p.qty}
                    format={USD}
                    className="font-bold tabular-nums text-text-primary"
                    style={{ fontSize: 'clamp(30px, 26px + 0.6vw, 34px)', letterSpacing: '-0.03em', lineHeight: 1 }}
                  />
                  {off > 0 ? <span className="rounded bg-lime-tint-bg px-1.5 py-0.5 text-[12px] font-bold text-lime-text">-{off}%</span> : null}
                </div>
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
              <BuyButton onClick={p.onBuy} loading={p.navigating} loadingLabel="Loading Checkout…" className="w-full" disabled={!offer.isUnlimited && (offer.stock ?? 1) <= 0}>
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
        <div className="mt-4 pt-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <PaymentMarks />
        </div>
      </div>

      {offer ? <SellerLine offer={offer} isOwn={p.isOwn} /> : null}
    </section>
  )
}

/** Who sells it, in one quiet line (Skinport): avatar, name, badge, rating and sales; the line opens their shop. */
function SellerLine({ offer, isOwn }: { offer: ItemOffer; isOwn: boolean }) {
  const slug = sellerShopSlug(offer.seller)
  const body = (
    <>
      <span className="shrink-0 text-text-tertiary">Sold by</span>
      <SellerAvatar seller={offer.seller} size={22} />
      <span className="truncate font-semibold text-text-primary">{sellerDisplayName(offer.seller)}</span>
      {offer.seller.verified ? <VerifiedBadge size={13} /> : <NewSellerBadge />}
      {isOwn ? <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">Yours</span> : null}
      <SellerStats
        ratingPercent={offer.seller.ratingPercent}
        reviews={offer.seller.reviewCount}
        sales={offer.seller.sales}
        tier={offer.seller.tier}
        verified={offer.seller.verified}
        hideTier
        className="ml-auto shrink-0 text-[12.5px]"
      />
      {slug ? <IconChevronRight aria-hidden size={15} stroke={2} className="shrink-0 text-text-tertiary" /> : null}
    </>
  )
  const cls = 'mt-3 flex min-w-0 items-center gap-2 rounded-lg px-3 py-2.5 transition-colors'
  return slug ? (
    <SmartLink href={`/shop/${slug}`} className={cn(cls, 'hover:bg-white/[0.04]')} style={{ fontSize: 'var(--fs-meta)' }}>
      {body}
    </SmartLink>
  ) : (
    <div className={cls} style={{ fontSize: 'var(--fs-meta)' }}>
      {body}
    </div>
  )
}
