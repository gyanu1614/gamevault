'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import { CurrencySellerRow } from '@/components/marketplace/CurrencySellerRow'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { sellerDisplayName, sellerShopSlug } from '@/lib/seller/identity'
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'
import { TraitName } from './TraitName'
import { fmtUsd } from './money'
import { amTrait, formLetters, toggleFilterLetter, type AmLetter } from './model/am-traits'
import type { TraitDef } from './model/offers'

/** Offer rows shown before "Show All". */
const FIRST = 8

/** The filter letters, in the picker's order, in their badges' colours (rule 10: the pick is an outline in that colour). */
const LETTERS: Array<{ letter: AmLetter; label: string; color: string }> = [
  { letter: 'N', label: 'Neon', color: '#8DC54A' },
  { letter: 'M', label: 'Mega', color: '#A970FF' },
  { letter: 'F', label: 'Fly', color: '#3298CB' },
  { letter: 'R', label: 'Ride', color: '#EA2E77' },
]

/**
 * Every offer of the pet, full width under the top block (owner, 2026-10-28:
 * "full row like the Robux page"; the Prices By Trait tab became a filter).
 * Adopt Me gets N / M / F / R toggles that pick one form — F + R shows the
 * Fly Ride offers. Each offer is the shared CurrencySellerRow: the trait as
 * the game's badges, stock and delivery, the price and Select; the offer on
 * show above carries the trust-blue edge and "Selected".
 */
export function OffersSection({
  noun,
  offers,
  offerVariants,
  traitDefs,
  selectedId,
  viewerId,
  onSelectOffer,
}: {
  noun: string
  offers: ItemOffer[]
  offerVariants: Record<string, string | null>
  traitDefs: TraitDef[]
  selectedId: string | null
  viewerId: string | null
  onSelectOffer: (offer: ItemOffer) => void
}) {
  const [filter, setFilter] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const reduce = useReducedMotion()
  const canFilter = useMemo(() => traitDefs.some((t) => amTrait(t.key)), [traitDefs])
  const def = (key: string | null) => (key ? traitDefs.find((t) => t.key === key) ?? null : null)

  if (offers.length === 0) return null

  const matching = filter ? offers.filter((o) => (offerVariants[o.id] ?? null) === filter) : offers
  const shown = all ? matching : matching.slice(0, FIRST)
  const lit = new Set(formLetters(filter))
  const filterName = def(filter)?.label ?? null

  const toggle = (letter: AmLetter) => {
    setFilter((f) => toggleFilterLetter(f, letter))
    setAll(false)
  }

  return (
    <section aria-labelledby="offers-title">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h2 id="offers-title" className="flex items-center gap-2.5 text-[20px] font-bold tracking-[-0.01em] text-text-primary sm:text-[24px]">
          Offers
          <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[12px] font-bold tabular-nums text-text-secondary">{matching.length}</span>
        </h2>
        {canFilter ? (
          <div role="group" aria-label={`Filter by ${noun.toLowerCase()}`} className="flex items-center gap-2">
            {LETTERS.map((l) => {
              const on = lit.has(l.letter)
              return (
                <button
                  key={l.letter}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(l.letter)}
                  className={cn(
                    'flex h-9 items-center gap-2 rounded-md bg-white/[0.04] px-2.5 font-semibold transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                    on ? 'text-text-primary' : 'text-text-secondary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]',
                  )}
                  style={{ fontSize: 'var(--fs-meta)', ...(on ? { boxShadow: `inset 0 0 0 1.5px ${l.color}` } : {}) }}
                >
                  <TraitMarks code={l.letter} size={18} />
                  <span className="max-sm:sr-only">{l.label}</span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {matching.length === 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-5 py-4" style={{ fontSize: 'var(--fs-body)' }}>
          <span className="text-text-secondary">{filterName ? `No ${filterName} offers right now.` : 'No offers right now.'}</span>
          <button type="button" onClick={() => setFilter(null)} className="font-semibold text-text-primary underline-offset-4 hover:underline">
            Show All Offers
          </button>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((o) => {
              const s = o.seller
              const slug = sellerShopSlug(s)
              const trait = <TraitBadges trait={def(offerVariants[o.id] ?? null)} />
              const stock = o.isUnlimited ? 'Unlimited' : (o.stock ?? 1).toLocaleString('en-US')
              const delivery = formatDeliveryLabel(o.deliveryTime)
              return (
                <motion.li
                  key={o.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                >
                  <CurrencySellerRow
                    seller={{ name: sellerDisplayName(s), avatarUrl: s.avatarUrl, verified: s.verified, rating: s.ratingPercent, reviews: s.reviewCount, sales: s.sales, tier: s.tier ?? null }}
                    sellerHref={slug ? `/shop/${slug}` : null}
                    metrics={[
                      { label: noun, value: trait, width: 132 },
                      { icon: Inventory2RoundedIcon, label: 'In Stock', value: stock, width: 104 },
                      { icon: ScheduleRoundedIcon, label: 'Delivery', value: delivery, width: 124 },
                    ]}
                    mobileMetrics={[
                      { label: '', value: trait },
                      { icon: Inventory2RoundedIcon, label: 'In Stock', value: stock },
                      { icon: ScheduleRoundedIcon, label: 'Delivery', value: delivery },
                    ]}
                    price={fmtUsd(o.pricePerUnit)}
                    isOwn={!!viewerId && o.sellerId === viewerId}
                    selected={o.id === selectedId}
                    onSelect={() => onSelectOffer(o)}
                  />
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}

      {matching.length > FIRST && !all ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-2 h-11 w-full rounded-md bg-white/[0.04] font-semibold text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
          style={{ fontSize: 'var(--fs-meta)' }}
        >
          Show All {matching.length} Offers
        </button>
      ) : null}
    </section>
  )
}

/** The trait as Adopt Me's own badges (owner: icons, not "Fly Ride"); a form without badges keeps its name. */
function TraitBadges({ trait }: { trait: TraitDef | null }) {
  if (!trait) return <span className="text-text-tertiary">—</span>
  if (!trait.short) return <TraitName traitKey={trait.key} label={trait.label} />
  return (
    <span className="inline-flex items-center" title={trait.label}>
      <TraitMarks code={trait.short} size={22} />
      <span className="sr-only">{trait.label}</span>
    </span>
  )
}
