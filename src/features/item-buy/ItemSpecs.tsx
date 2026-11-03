'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'

export interface ItemSpecsProps {
  rarity: { label: string; color: string } | null
  offer: ItemOffer | null
  deliveryMethod: string
}

/**
 * The facts under the picture, floating on the page with no box (owner,
 * 2026-11-02: no box in a box; Eldorado's item page as the reference): rarity,
 * how fast, how it is delivered, how many are left — 2 × 2, beside the picture
 * on desktop. Offer facts (time, stock) show only while an offer is on show;
 * a changed value eases in when another offer is chosen.
 */
export function ItemSpecs(p: ItemSpecsProps) {
  const { offer } = p
  // No fade on the first paint: the server HTML must show every value.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const cells: Array<{ label: string; value: ReactNode; key: string }> = [
    ...(p.rarity ? [{ label: 'Rarity', value: <span style={{ color: p.rarity.color }}>{p.rarity.label}</span>, key: p.rarity.label }] : []),
    ...(offer ? [{ label: 'Delivery Time', value: formatDeliveryLabel(offer.deliveryTime), key: `t:${offer.deliveryTime}` }] : []),
    { label: 'Delivery Method', value: p.deliveryMethod, key: p.deliveryMethod },
    ...(offer ? [{ label: 'In Stock', value: stockLabel(offer), key: `s:${offer.id}` }] : []),
  ]

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
      {cells.map((c) => (
        <div key={c.label} className="min-w-0">
          <dt className="text-text-tertiary" style={{ fontSize: 'var(--fs-body)' }}>
            {c.label}
          </dt>
          <dd className="mt-0.5 truncate font-semibold text-text-primary" style={{ fontSize: 'var(--fs-card-title)' }}>
            <Fade key={c.key} animate={hydrated}>
              {c.value}
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
