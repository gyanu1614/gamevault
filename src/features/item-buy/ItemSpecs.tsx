'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { ClockCountdownIcon } from '@phosphor-icons/react/dist/csr/ClockCountdown'
import { HandshakeIcon } from '@phosphor-icons/react/dist/csr/Handshake'
import { PackageIcon } from '@phosphor-icons/react/dist/csr/Package'
import { SketchLogoIcon } from '@phosphor-icons/react/dist/csr/SketchLogo'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'

export interface ItemSpecsProps {
  rarity: { label: string; color: string } | null
  offer: ItemOffer | null
  deliveryMethod: string
}

/**
 * The facts, floating with no box (owner, 2026-11-02: no box in a box; Eldorado's
 * item page as the reference): rarity, how fast, how it is delivered, how many
 * are left — 2 × 2, under the picture on phones, beside it on desktop with an
 * icon on each from xl (owner, 2026-11-03; smaller laptops have no room for
 * them). Offer facts (time, stock) show only while an offer is on show;
 * a changed value eases in when another offer is chosen.
 */
export function ItemSpecs(p: ItemSpecsProps) {
  const { offer } = p
  // No fade on the first paint: the server HTML must show every value.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const cells: Array<{ label: string; value: ReactNode; key: string; Icon: PhosphorIcon }> = [
    ...(p.rarity ? [{ label: 'Rarity', value: <span style={{ color: p.rarity.color }}>{p.rarity.label}</span>, key: p.rarity.label, Icon: SketchLogoIcon }] : []),
    ...(offer ? [{ label: 'Delivery Time', value: formatDeliveryLabel(offer.deliveryTime), key: `t:${offer.deliveryTime}`, Icon: ClockCountdownIcon }] : []),
    { label: 'Delivery Method', value: p.deliveryMethod, key: p.deliveryMethod, Icon: HandshakeIcon },
    ...(offer ? [{ label: 'In Stock', value: stockLabel(offer), key: `s:${offer.id}`, Icon: PackageIcon }] : []),
  ]

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:gap-x-4 xl:gap-x-6">
      {cells.map(({ label, value, key, Icon }) => (
        <div key={label} className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="hidden h-10 w-10 shrink-0 place-items-center rounded-md bg-white/[0.06] text-text-primary xl:grid">
            <Icon size={20} weight="duotone" />
          </span>
          <div className="min-w-0">
            <dt className="text-[length:var(--fs-body)] text-text-tertiary lg:text-[13px] lg:text-text-secondary">
              {label}
            </dt>
            <dd className="mt-0.5 truncate font-semibold text-text-primary" style={{ fontSize: 'var(--fs-card-title)' }}>
              <Fade key={key} animate={hydrated}>
                {value}
              </Fade>
            </dd>
          </div>
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
