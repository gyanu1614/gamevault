'use client'

import type { ReactNode, Ref } from 'react'
import { IconExternalLink, IconShieldCheck } from '@tabler/icons-react'
import Link from '@/components/navigation/AppLink'
import { SmartLink } from '@/components/global/SmartLink'
import { BuyButton } from '@/components/marketplace/BuyButton'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { NewSellerBadge } from '@/components/seller/NewSellerBadge'
import { SellerStats } from '@/components/seller/SellerStats'
import { TierIcon } from '@/components/seller/tiers/TierIcon'
import { NumberField } from '@/components/ui/number-field'
import { NotifyMeButton } from '@/features/items-grid/NotifyMeButton'
import { SellerAvatar } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemCard'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { BUY_CTA_LABEL } from '@/lib/config/purchases'
import { sellerDisplayName, sellerShopSlug } from '@/lib/seller/identity'
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'
import { TraitSelect } from './TraitSelect'
import type { TraitOption } from './model/offers'

export const fmtUsd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Quantity ceiling: unlimited stock caps at 99, else the seller's quantity. */
export const maxQtyOf = (o: ItemOffer) => (o.isUnlimited ? 99 : Math.max(1, o.stock ?? 1))

export interface BuyBoxProps {
  gameSlug: string
  gameName: string
  itemSlug: string
  itemName: string
  rarity: { label: string; color: string } | null
  noun: 'Trait' | 'Mutation'
  traits: TraitOption[]
  trait: string | null
  onTrait: (variant: string | null) => void
  /** The offer the box sells (the trait's cheapest, or the one picked from the list). */
  offer: ItemOffer | null
  /** That offer's own trait, by name. */
  offerTrait: string | null
  /** "Neon Fly Ride Parrot" — what Notify Me waits for. */
  wantedName: string
  /** Another trait has offers (the empty state then points at the picker). */
  otherTraitsHaveOffers: boolean
  qty: number
  onQty: (qty: number) => void
  onBuy: () => void
  navigating: boolean
  isOwn: boolean
  buyRef: Ref<HTMLDivElement>
}

/**
 * The right column of the pet page (owner, 2026-10-26): who sells the offer,
 * the pet's name and price, the trait picker, the offer's facts, then Buy —
 * or, for a trait nobody sells, Notify Me for that trait.
 */
export function BuyBox(p: BuyBoxProps) {
  const { offer } = p
  return (
    <section id="buy-box" aria-labelledby="item-title" className="min-w-0 scroll-mt-game-chrome">
      {offer ? <SellerRow offer={offer} isOwn={p.isOwn} /> : null}

      <p className="flex items-center gap-2 font-medium" style={{ fontSize: 'var(--fs-meta)', marginTop: offer ? 18 : 0 }}>
        {p.rarity ? (
          <>
            <span style={{ color: p.rarity.color }}>{p.rarity.label}</span>
            <span aria-hidden className="text-text-tertiary">·</span>
          </>
        ) : null}
        <span className="text-text-secondary">{p.gameName}</span>
      </p>
      <h1
        id="item-title"
        className="mt-1.5 text-balance text-text-primary"
        style={{ fontSize: 'var(--fs-page-title)', lineHeight: 1.1, fontWeight: 'var(--fw-heading)', letterSpacing: '-0.02em' }}
      >
        {p.gameName} {p.itemName}
      </h1>

      <PriceLine offer={offer} />

      {p.traits.length > 0 ? (
        <div className="mt-5">
          <TraitSelect noun={p.noun} options={p.traits} value={p.trait} onChange={p.onTrait} />
        </div>
      ) : null}

      {offer ? (
        <>
          <dl className="mt-5 divide-y divide-white/[0.06]" style={{ fontSize: 'var(--fs-body)' }}>
            {p.rarity ? <Fact label="Rarity" value={<span style={{ color: p.rarity.color }}>{p.rarity.label}</span>} /> : null}
            {p.offerTrait ? <Fact label={p.noun} value={p.offerTrait} /> : null}
            <Fact label="Delivery Time" value={formatDeliveryLabel(offer.deliveryTime)} />
            <Fact label="In Stock" value={offer.isUnlimited ? 'Unlimited' : String(offer.stock ?? 1)} />
          </dl>

          <div ref={p.buyRef} className="mt-5 space-y-3">
            {maxQtyOf(offer) > 1 && !p.isOwn ? (
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
                  Quantity
                </span>
                <NumberField
                  value={p.qty}
                  onChange={(v) => p.onQty(Math.max(1, Math.min(maxQtyOf(offer), v || 1)))}
                  minValue={1}
                  maxValue={maxQtyOf(offer)}
                  className="h-11 w-36"
                  ariaLabel="Quantity"
                />
              </div>
            ) : null}
            {p.qty > 1 ? (
              <div className="flex items-baseline justify-between text-text-secondary" style={{ fontSize: 'var(--fs-body)' }}>
                <span>Total</span>
                <span className="font-semibold tabular-nums text-text-primary">{fmtUsd(offer.pricePerUnit * p.qty)}</span>
              </div>
            ) : null}
            <BuyButton onClick={p.onBuy} loading={p.navigating} loadingLabel="Loading Checkout…" className="w-full" disabled={!offer.isUnlimited && (offer.stock ?? 1) <= 0}>
              {p.isOwn ? 'Edit Your Listing' : BUY_CTA_LABEL}
            </BuyButton>
            <p className="flex items-center gap-2 text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
              <IconShieldCheck aria-hidden size={16} stroke={1.9} className="shrink-0 text-lime-text" />
              SafeDrop Protection: get what you ordered or your money back.
            </p>
            <Link
              href={`/${p.gameSlug}/${offer.detailCategorySlug}/${offer.detailSlug}`}
              className="inline-flex items-center gap-1.5 font-semibold text-text-secondary transition-colors hover:text-text-primary"
              style={{ fontSize: 'var(--fs-meta)' }}
            >
              Full Listing Details
              <IconExternalLink aria-hidden size={14} stroke={2} />
            </Link>
          </div>
        </>
      ) : (
        <div ref={p.buyRef} className="mt-5 rounded-lg bg-white/[0.04] p-4 sm:p-5">
          <p className="font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
            No {p.wantedName} listed right now.
          </p>
          <p className="mt-1 text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
            {p.otherTraitsHaveOffers
              ? `Get an email the moment one is listed, or pick another ${p.noun.toLowerCase()} above.`
              : 'Get an email the moment one is listed.'}
          </p>
          <NotifyMeButton
            gameSlug={p.gameSlug}
            itemSlug={p.itemSlug}
            itemName={p.wantedName}
            variant={p.trait}
            className="mt-4 h-11 w-full justify-center text-[14px]"
          />
        </div>
      )}
    </section>
  )
}

function SellerRow({ offer, isOwn }: { offer: ItemOffer; isOwn: boolean }) {
  const name = sellerDisplayName(offer.seller)
  const slug = sellerShopSlug(offer.seller)
  const body = (
    <>
      <SellerAvatar seller={offer.seller} size={40} />
      <span className="flex min-w-0 flex-col gap-1 leading-none">
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
            {name}
          </span>
          {offer.seller.verified ? <VerifiedBadge size={14} /> : <NewSellerBadge />}
          <TierIcon tier={offer.seller.tier} size={15} />
          {isOwn ? <span className="ml-1 rounded bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">Yours</span> : null}
        </span>
        <SellerStats
          ratingPercent={offer.seller.ratingPercent}
          reviews={offer.seller.reviewCount}
          sales={offer.seller.sales}
          tier={offer.seller.tier}
          verified={offer.seller.verified}
          hideTier
          className="text-[12.5px]"
        />
      </span>
    </>
  )
  return slug ? (
    <SmartLink href={`/shop/${slug}`} className="-ml-1.5 inline-flex max-w-full items-center gap-3 rounded-lg p-1.5 pr-3 transition-colors hover:bg-white/[0.05]">
      {body}
    </SmartLink>
  ) : (
    <div className="inline-flex max-w-full items-center gap-3">{body}</div>
  )
}

function PriceLine({ offer }: { offer: ItemOffer | null }) {
  if (!offer) {
    return (
      <p className="mt-4 font-semibold text-text-tertiary" style={{ fontSize: 'var(--fs-price)' }}>
        No Offers Yet
      </p>
    )
  }
  const off = offer.originalPrice && offer.originalPrice > offer.pricePerUnit ? Math.round((1 - offer.pricePerUnit / offer.originalPrice) * 100) : 0
  return (
    <div className="mt-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className="tabular-nums text-text-primary" style={{ fontSize: 'clamp(28px, 24px + 0.8vw, 34px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {fmtUsd(offer.pricePerUnit)}
      </span>
      {off > 0 ? (
        <>
          <s className="tabular-nums text-text-tertiary" style={{ fontSize: 'var(--fs-body)' }}>
            {fmtUsd(offer.originalPrice!)}
          </s>
          <span className="rounded bg-lime-tint-bg px-1.5 py-0.5 text-[12px] font-bold text-lime-text">-{off}%</span>
        </>
      ) : null}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-text-primary">{value}</dd>
    </div>
  )
}
