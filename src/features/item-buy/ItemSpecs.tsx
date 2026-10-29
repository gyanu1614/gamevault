'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'
import { TraitName } from './TraitName'
import type { TraitDef } from './model/offers'

export interface ItemSpecsProps {
  itemType: string
  rarity: { label: string; color: string } | null
  noun: string
  /** The trait on show: the picked offer's, else the picked trait. */
  trait: TraitDef | null
  offer: ItemOffer | null
  deliveryMethod: string
}

/**
 * The spec card beside the picture (owner, 2026-10-28; Eldorado's item facts
 * as the reference): what the item is and how this offer is delivered, one
 * fact per row. Offer facts (time, stock) show only while an offer is on
 * show, and a changed value fades in when another offer is chosen.
 */
export function ItemSpecs(p: ItemSpecsProps) {
  const { offer } = p
  // No fade on the first paint: the server HTML must show every value.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const rows: Array<{ label: string; value: ReactNode; key: string }> = [
    { label: 'Item Type', value: p.itemType, key: p.itemType },
    ...(p.rarity ? [{ label: 'Rarity', value: <span style={{ color: p.rarity.color }}>{p.rarity.label}</span>, key: p.rarity.label }] : []),
    ...(p.trait
      ? [
          {
            label: p.noun,
            key: p.trait.key,
            value: (
              <span className="inline-flex min-w-0 items-center gap-2">
                {p.trait.short ? <TraitMarks code={p.trait.short} size={18} /> : null}
                <span className="truncate">
                  <TraitName traitKey={p.trait.key} label={p.trait.label} />
                </span>
              </span>
            ),
          },
        ]
      : []),
    ...(offer ? [{ label: 'Delivery Time', value: formatDeliveryLabel(offer.deliveryTime), key: `t:${offer.deliveryTime}` }] : []),
    { label: 'Delivery Method', value: p.deliveryMethod, key: p.deliveryMethod },
    ...(offer ? [{ label: 'In Stock', value: stockLabel(offer), key: `s:${offer.id}` }] : []),
  ]

  return (
    <dl className={cn('grid h-full auto-rows-fr rounded-lg px-5', MARKET_CARD)}>
      {rows.map((r, i) => (
        <div key={r.label} className={cn('flex min-w-0 items-center justify-between gap-4 py-3', i > 0 && 'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]')} style={{ fontSize: 'var(--fs-body)' }}>
          <dt className="shrink-0 text-text-tertiary">{r.label}</dt>
          <dd className="min-w-0 text-right font-semibold text-text-primary">
            <Fade key={r.key} animate={hydrated}>
              {r.value}
            </Fade>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function stockLabel(offer: ItemOffer): string {
  if (offer.isUnlimited) return 'Unlimited'
  return (offer.stock ?? 1).toLocaleString('en-US')
}

/** A value that changed with the offer eases in instead of snapping. */
function Fade({ children, animate }: { children: ReactNode; animate: boolean }) {
  const reduce = useReducedMotion()
  return (
    <motion.span className="inline-flex min-w-0 max-w-full" initial={reduce || !animate ? false : { opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
      {children}
    </motion.span>
  )
}
