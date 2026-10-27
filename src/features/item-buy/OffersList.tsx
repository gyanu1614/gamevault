'use client'

import { useState } from 'react'
import { IconChevronDown, IconClock } from '@tabler/icons-react'
import { SmartLink } from '@/components/global/SmartLink'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { NewSellerBadge } from '@/components/seller/NewSellerBadge'
import { SellerStats } from '@/components/seller/SellerStats'
import { SellerAvatar } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemCard'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { sellerDisplayName, sellerShopSlug } from '@/lib/seller/identity'
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { fmtUsd } from './money'

/** Rows shown before "Show All". */
const FIRST = 8

/**
 * The pet's other offers in the picked trait (owner, 2026-10-26), cheapest
 * first, one row each: seller, trait, delivery, price. Picking a row puts
 * that offer in the buy box (the seller name opens their shop instead); the
 * buy box's own offer is not repeated here, so the one it held moves back
 * into the list.
 */
export function OffersList({
  title,
  offers,
  traitOf,
  onSelect,
}: {
  title: string
  offers: ItemOffer[]
  /** Short trait name for a row ("FR", "Gold"); null hides the chip. */
  traitOf: (offer: ItemOffer) => string | null
  onSelect: (offer: ItemOffer) => void
}) {
  const [all, setAll] = useState(false)
  const shown = all ? offers : offers.slice(0, FIRST)

  return (
    <section aria-labelledby="other-offers" className="mt-12 sm:mt-14">
      {/* OfferRail's header: title left, Show All right (fill-only hover). */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="other-offers" className="text-[20px] font-bold tracking-[-0.01em] text-text-primary sm:text-[24px]">
          {title}
        </h2>
        {offers.length > FIRST && !all ? (
          <button
            type="button"
            onClick={() => setAll(true)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#1D1E23] px-3.5 text-[13.5px] font-semibold text-text-primary shadow-[0_12px_26px_-14px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-[#24252B]"
          >
            Show All {offers.length}
            <IconChevronDown aria-hidden size={14} stroke={2.2} />
          </button>
        ) : (
          <span className="tabular-nums text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
            {offers.length} {offers.length === 1 ? 'Offer' : 'Offers'}
          </span>
        )}
      </div>

      <ul className={cn('overflow-hidden rounded-lg', MARKET_CARD)}>
        {shown.map((o, i) => (
          <OfferRow key={o.id} offer={o} trait={traitOf(o)} first={i === 0} onSelect={() => onSelect(o)} />
        ))}
      </ul>

    </section>
  )
}

function OfferRow({ offer, trait, first, onSelect }: { offer: ItemOffer; trait: string | null; first: boolean; onSelect: () => void }) {
  const name = sellerDisplayName(offer.seller)
  const slug = sellerShopSlug(offer.seller)
  return (
    <li
      className={cn(
        'relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_auto] sm:px-5',
        !first && 'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
        'hover:bg-white/[0.03]',
      )}
    >
      {/* The row picks the offer; the seller link sits above this button. */}
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Choose ${name}'s offer, ${fmtUsd(offer.pricePerUnit)}`}
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/15"
      />

      <div className="flex min-w-0 items-center gap-3">
        <SellerAvatar seller={offer.seller} size={34} />
        <div className="flex min-w-0 flex-col gap-1 leading-none">
          <span className="flex min-w-0 items-center gap-1">
            {slug ? (
              <SmartLink href={`/shop/${slug}`} className="relative z-10 truncate font-semibold text-text-primary hover:underline" style={{ fontSize: 'var(--fs-body)' }}>
                {name}
              </SmartLink>
            ) : (
              <span className="truncate font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
                {name}
              </span>
            )}
            {offer.seller.verified ? <VerifiedBadge size={13} /> : <NewSellerBadge />}
          </span>
          <SellerStats
            ratingPercent={offer.seller.ratingPercent}
            reviews={offer.seller.reviewCount}
            sales={offer.seller.sales}
            tier={offer.seller.tier}
            verified={offer.seller.verified}
            hideTier
            className="text-[12px]"
          />
        </div>
      </div>

      <span className="pointer-events-none text-right font-bold tabular-nums text-text-primary sm:order-3" style={{ fontSize: 'var(--fs-card-title)' }}>
        {fmtUsd(offer.pricePerUnit)}
      </span>

      <div className="pointer-events-none flex min-w-0 items-center gap-2 text-text-secondary sm:order-2" style={{ fontSize: 'var(--fs-meta)' }}>
        {trait ? <span className="inline-flex h-6 shrink-0 items-center rounded bg-white/[0.06] px-2 text-[11.5px] font-bold text-text-secondary">{trait}</span> : null}
        <span className="inline-flex min-w-0 items-center gap-1">
          <IconClock aria-hidden size={14} stroke={1.9} className="shrink-0 text-text-tertiary" />
          <span className="truncate">{formatDeliveryLabel(offer.deliveryTime)}</span>
        </span>
      </div>

      <span className="pointer-events-none inline-flex h-8 items-center justify-center justify-self-end rounded-md bg-white/[0.07] px-3 text-[13px] font-semibold text-text-primary transition-colors sm:order-4 [li:hover>&]:bg-white/[0.11]">
        Select
      </span>
    </li>
  )
}
