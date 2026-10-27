'use client'

import { useState, type Ref } from 'react'
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
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { fmtUsd, maxQtyOf } from './money'

export interface BuyPanelProps {
  gameSlug: string
  itemSlug: string
  noun: 'Trait' | 'Mutation'
  trait: string | null
  /** The offer the panel sells (the trait's cheapest, or the one picked from the list). */
  offer: ItemOffer | null
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

/** A description longer than this gets "Show More". */
const LONG = 220

/**
 * The right column of the pet page (owner, 2026-10-27): the seller, their
 * description, price and quantity, then Buy — or, for a trait nobody sells,
 * Notify Me for that trait. One card; sticky beside the picture on desktop.
 */
export function BuyPanel(p: BuyPanelProps) {
  const { offer } = p
  if (!offer) {
    return (
      <div id="buy-box" ref={p.buyRef} className={cn('scroll-mt-game-chrome rounded-lg p-5', MARKET_CARD)}>
        <p className="font-semibold text-text-tertiary" style={{ fontSize: 'var(--fs-price)' }}>
          No Offers Yet
        </p>
        <p className="mt-2 font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
          No {p.wantedName} listed right now.
        </p>
        <p className="mt-1 text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
          {p.otherTraitsHaveOffers
            ? `Get an email the moment one is listed, or pick another ${p.noun.toLowerCase()}.`
            : 'Get an email the moment one is listed.'}
        </p>
        <NotifyMeButton gameSlug={p.gameSlug} itemSlug={p.itemSlug} itemName={p.wantedName} variant={p.trait} className="mt-4 h-11 w-full justify-center text-[14px]" />
      </div>
    )
  }

  const max = maxQtyOf(offer)
  const off = offer.originalPrice && offer.originalPrice > offer.pricePerUnit ? Math.round((1 - offer.pricePerUnit / offer.originalPrice) * 100) : 0
  const detailsHref = `/${p.gameSlug}/${offer.detailCategorySlug}/${offer.detailSlug}`

  return (
    <div id="buy-box" className={cn('scroll-mt-game-chrome rounded-lg p-5', MARKET_CARD)}>
      <SellerRow offer={offer} isOwn={p.isOwn} />

      <Description key={offer.id} text={offer.description ?? null} detailsHref={detailsHref} />

      <div className="mt-5 flex items-end justify-between gap-4 pt-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="min-w-0">
          <div className="text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
            Price
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="tabular-nums text-text-primary" style={{ fontSize: 'clamp(26px, 22px + 0.6vw, 30px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {fmtUsd(offer.pricePerUnit)}
            </span>
            {off > 0 ? (
              <>
                <s className="tabular-nums text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
                  {fmtUsd(offer.originalPrice!)}
                </s>
                <span className="rounded bg-lime-tint-bg px-1.5 py-0.5 text-[12px] font-bold text-lime-text">-{off}%</span>
              </>
            ) : null}
          </div>
        </div>
        {max > 1 && !p.isOwn ? (
          <NumberField
            value={p.qty}
            onChange={(v) => p.onQty(Math.max(1, Math.min(max, v || 1)))}
            minValue={1}
            maxValue={max}
            className="h-11 w-32 shrink-0"
            ariaLabel="Quantity"
          />
        ) : null}
      </div>

      {p.qty > 1 ? (
        <div className="mt-3 flex items-baseline justify-between text-text-secondary" style={{ fontSize: 'var(--fs-body)' }}>
          <span>Total</span>
          <span className="font-semibold tabular-nums text-text-primary">{fmtUsd(offer.pricePerUnit * p.qty)}</span>
        </div>
      ) : null}

      <div ref={p.buyRef} className="mt-4">
        <BuyButton onClick={p.onBuy} loading={p.navigating} loadingLabel="Loading Checkout…" className="w-full" disabled={!offer.isUnlimited && (offer.stock ?? 1) <= 0}>
          {p.isOwn ? 'Edit Your Listing' : BUY_CTA_LABEL}
        </BuyButton>
      </div>
      <p className="mt-3 flex items-center gap-2 text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
        <IconShieldCheck aria-hidden size={16} stroke={1.9} className="shrink-0 text-lime-text" />
        SafeDrop Protection: get what you ordered or your money back.
      </p>
    </div>
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
    <SmartLink href={`/shop/${slug}`} className="-m-1.5 flex max-w-full items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-white/[0.05]">
      {body}
    </SmartLink>
  ) : (
    <div className="flex max-w-full items-center gap-3">{body}</div>
  )
}

/** The seller's own words (plain text), clamped with Show More; the full listing a click away. */
function Description({ text, detailsHref }: { text: string | null; detailsHref: string }) {
  const [open, setOpen] = useState(false)
  const long = !!text && text.length > LONG
  return (
    <div className="mt-4">
      {text ? (
        <>
          <div className="text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
            Description
          </div>
          <p className={cn('mt-1 whitespace-pre-line break-words text-text-secondary', long && !open && 'line-clamp-4')} style={{ fontSize: 'var(--fs-body)', lineHeight: 1.55 }}>
            {text}
          </p>
        </>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1" style={{ fontSize: 'var(--fs-meta)' }}>
        {long ? (
          <button type="button" onClick={() => setOpen((v) => !v)} className="font-semibold text-text-primary hover:underline">
            {open ? 'Show Less' : 'Show More'}
          </button>
        ) : null}
        <Link href={detailsHref} className="inline-flex items-center gap-1.5 font-semibold text-text-secondary transition-colors hover:text-text-primary">
          Full Listing Details
          <IconExternalLink aria-hidden size={14} stroke={2} />
        </Link>
      </div>
    </div>
  )
}
