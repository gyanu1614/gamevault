'use client'

import { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { motion, useReducedMotion } from 'framer-motion'
import { IconBell, IconCheck, IconClock } from '@tabler/icons-react'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { NewSellerBadge } from '@/components/seller/NewSellerBadge'
import { SellerAvatar } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemCard'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { sellerDisplayName } from '@/lib/seller/identity'
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'
import { TraitName } from './TraitName'
import { fmtUsd } from './money'
import type { TraitDef, TraitOption } from './model/offers'

/** Offer rows shown before "Show All". */
const FIRST = 8

/**
 * The data under the picture (owner, 2026-10-27; Skinport's Sales History ·
 * Latest Sales · Variants tabs as the reference): every offer of the pet in
 * one table, and every trait with its cheapest price in another. Plain rows
 * with hairline separators, not cards. Choosing a row shows it in the buy box.
 */
export function OfferTabs({
  noun,
  offers,
  offerVariants,
  traitDefs,
  traits,
  selectedId,
  onSelectOffer,
  onSelectTrait,
}: {
  noun: string
  offers: ItemOffer[]
  offerVariants: Record<string, string | null>
  traitDefs: TraitDef[]
  traits: TraitOption[]
  selectedId: string | null
  onSelectOffer: (offer: ItemOffer) => void
  onSelectTrait: (variant: string) => void
}) {
  const hasOffers = offers.length > 0
  const hasTraits = traits.length > 0
  const [tab, setTab] = useState(hasOffers ? 'offers' : 'traits')
  if (!hasOffers && !hasTraits) return null

  const tabs = [
    ...(hasOffers ? [{ id: 'offers', label: 'Offers', count: offers.length }] : []),
    ...(hasTraits ? [{ id: 'traits', label: `Prices By ${noun}`, count: null }] : []),
  ]
  const def = (key: string | null) => (key ? traitDefs.find((t) => t.key === key) ?? null : null)

  return (
    <Tabs.Root value={tab} onValueChange={setTab}>
      <Tabs.List aria-label="Offers and prices" className="flex gap-7 shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
        {tabs.map((t) => (
          <Tab key={t.id} value={t.id} active={tab === t.id} label={t.label} count={t.count} />
        ))}
      </Tabs.List>

      {hasOffers ? (
        <Tabs.Content value="offers" className="pt-2 focus-visible:outline-none">
          <OffersTable offers={offers} variantOf={(o) => def(offerVariants[o.id] ?? null)} selectedId={selectedId} onSelect={onSelectOffer} noun={noun} />
        </Tabs.Content>
      ) : null}
      {hasTraits ? (
        <Tabs.Content value="traits" className="pt-2 focus-visible:outline-none">
          <TraitsTable traits={traits} onSelect={onSelectTrait} noun={noun} />
        </Tabs.Content>
      ) : null}
    </Tabs.Root>
  )
}

function Tab({ value, active, label, count }: { value: string; active: boolean; label: string; count: number | null }) {
  const reduce = useReducedMotion()
  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        'relative flex h-12 items-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15',
        active ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary',
      )}
      style={{ fontSize: 'var(--fs-card-title)' }}
    >
      {label}
      {count != null ? <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[11.5px] font-bold tabular-nums text-text-secondary">{count}</span> : null}
      {active ? (
        <motion.span
          layoutId="offer-tab-underline"
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }}
          className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-text-primary"
        />
      ) : null}
    </Tabs.Trigger>
  )
}

const HEAD = 'font-semibold uppercase tracking-[0.12em] text-text-tertiary'

function OffersTable({
  offers,
  variantOf,
  selectedId,
  onSelect,
  noun,
}: {
  offers: ItemOffer[]
  variantOf: (o: ItemOffer) => TraitDef | null
  selectedId: string | null
  onSelect: (o: ItemOffer) => void
  noun: string
}) {
  const [all, setAll] = useState(false)
  const shown = all ? offers : offers.slice(0, FIRST)
  return (
    <div>
      <div className={cn(HEAD, 'hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_96px_96px] items-center gap-4 px-3 py-3 sm:grid')} style={{ fontSize: 'var(--fs-micro)' }}>
        <span>Seller</span>
        <span>{noun}</span>
        <span>Delivery</span>
        <span className="text-right">Price</span>
        <span />
      </div>
      <ul>
        {shown.map((o) => {
          const t = variantOf(o)
          const selected = o.id === selectedId
          return (
            <li key={o.id} className="shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div
                className={cn(
                  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-md px-3 py-3.5 transition-colors sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_96px_96px]',
                  selected ? 'bg-white/[0.035]' : 'hover:bg-white/[0.025]',
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <SellerAvatar seller={o.seller} size={28} />
                  <span className="truncate font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
                    {sellerDisplayName(o.seller)}
                  </span>
                  {o.seller.verified ? <VerifiedBadge size={13} /> : <NewSellerBadge />}
                </span>
                <span className="text-right font-bold tabular-nums text-text-primary sm:order-4" style={{ fontSize: 'var(--fs-card-title)' }}>
                  {fmtUsd(o.pricePerUnit)}
                </span>
                <span className="flex min-w-0 items-center gap-3 text-text-secondary sm:contents" style={{ fontSize: 'var(--fs-meta)' }}>
                  <span className="truncate font-medium sm:order-2">{t ? <TraitName traitKey={t.key} label={t.label} /> : '—'}</span>
                  <span className="inline-flex min-w-0 items-center gap-1.5 sm:order-3">
                    <IconClock aria-hidden size={14} stroke={1.9} className="shrink-0 text-text-tertiary" />
                    <span className="truncate">{formatDeliveryLabel(o.deliveryTime)}</span>
                  </span>
                </span>
                <span className="justify-self-end sm:order-5">
                  {selected ? (
                    <span className="inline-flex h-9 items-center gap-1 px-2 text-[13px] font-semibold text-lime-text">
                      <IconCheck aria-hidden size={15} stroke={2.4} />
                      Selected
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect(o)}
                      className="inline-flex h-9 items-center rounded-md bg-white/[0.07] px-3.5 text-[13px] font-semibold text-text-primary transition-colors hover:bg-white/[0.12]"
                    >
                      Select
                    </button>
                  )}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      {offers.length > FIRST && !all ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-2 h-11 w-full rounded-md bg-white/[0.04] font-semibold text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
          style={{ fontSize: 'var(--fs-meta)' }}
        >
          Show All {offers.length} Offers
        </button>
      ) : null}
    </div>
  )
}

function TraitsTable({ traits, onSelect, noun }: { traits: TraitOption[]; onSelect: (v: string) => void; noun: string }) {
  return (
    <div>
      <div className={cn(HEAD, 'grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_auto] items-center gap-4 px-3 py-3')} style={{ fontSize: 'var(--fs-micro)' }}>
        <span>{noun}</span>
        <span>Offers</span>
        <span className="text-right">From</span>
        <span className="w-[88px]" />
      </div>
      <ul>
        {traits.map((t) => (
          <li key={t.variant} className="shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_auto] items-center gap-4 rounded-md px-3 py-3 transition-colors hover:bg-white/[0.025]">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="w-[62px] shrink-0">{t.short ? <TraitMarks code={t.short} /> : null}</span>
                <span className="truncate font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
                  <TraitName traitKey={t.variant} label={t.label} />
                </span>
              </span>
              <span className="tabular-nums text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
                {t.count > 0 ? t.count : '—'}
              </span>
              <span className="text-right font-semibold tabular-nums text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
                {t.minPriceUsd != null ? `$${formatStatPrice(t.minPriceUsd)}` : <span className="font-normal text-text-tertiary">—</span>}
              </span>
              <button
                type="button"
                onClick={() => onSelect(t.variant)}
                className="inline-flex h-9 w-[88px] items-center justify-center gap-1.5 rounded-md bg-white/[0.07] text-[13px] font-semibold text-text-primary transition-colors hover:bg-white/[0.12]"
              >
                {t.count > 0 ? (
                  'View'
                ) : (
                  <>
                    <IconBell aria-hidden size={14} stroke={2} />
                    Notify
                  </>
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
