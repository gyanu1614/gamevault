'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'
import { cn } from '@/lib/utils'

export interface ItemSpecsProps {
  rarity: { label: string; color: string } | null
  offer: ItemOffer | null
  deliveryMethod: string
}

/**
 * The facts under the picture, in the same card (owner, 2026-11-02: no more
 * picture card and spec card side by side). Four cells: rarity, how fast,
 * how it is delivered, how many are left; the item type sits in the title's
 * eyebrow and the trait in the buy box. Offer facts (time, stock) show only
 * while an offer is on show; a changed value eases in when another offer is
 * chosen.
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
    <dl className={cn('grid grid-cols-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]', cells.length > 2 ? 'sm:grid-cols-4' : 'sm:grid-cols-2')}>
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={cn(
            'min-w-0 px-4 py-3.5 sm:px-5 sm:py-4',
            // Hairlines between cells: a cross on phones (2 × 2), dividers in one row on wider screens.
            i % 2 === 1 && 'shadow-[inset_1px_0_0_rgba(255,255,255,0.06)]',
            i >= 2 && 'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:shadow-[inset_1px_0_0_rgba(255,255,255,0.06)]',
            i === 3 && 'shadow-[inset_1px_1px_0_rgba(255,255,255,0.06)] sm:shadow-[inset_1px_0_0_rgba(255,255,255,0.06)]',
          )}
        >
          <dt className="text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
            {c.label}
          </dt>
          <dd className="mt-1 truncate font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
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
