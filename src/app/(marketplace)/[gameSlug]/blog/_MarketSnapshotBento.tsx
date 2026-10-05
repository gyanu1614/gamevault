'use client'

/**
 * "Live Market" collage for the blog hub hero — a mosaic of the top priced pets
 * (mixed tile sizes, nicely fitted) laid over a DIMMED pet-art backdrop, so the
 * panel reads as a living market rather than a flat black box. Below the collage
 * sit the highest-value + trending stats and a link to the full value list.
 *
 * Every card is a real, published pet with a real price (from getHubTopValues);
 * the two stat chips come from the same HubStat rows the compact strip uses.
 * Card-surface system: raised cards, no outlines; hover lifts the card and a
 * soft neutral glow follows the cursor (hidden for reduced motion). Renders
 * nothing when there's no data.
 */

import Link from '@/components/navigation/AppLink'
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { CaretUpIcon } from '@phosphor-icons/react/dist/csr/CaretUp'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { VALUE_BTN_SECONDARY, VALUE_LABEL, VALUE_SURFACE, VALUE_SURFACE_LINK } from '@/components/values/styles'
import { VARIANT_LABEL, type Variant } from '../calculator/_adoptMeCalcTypes'
import { variantColor } from '../values/[itemSlug]/_adoptMeVariantColor'
import type { HubStat, HubTeaserItem } from './_hubData'

/** Mosaic footprint per collage position — a deliberate, hand-tuned rhythm so
 *  the grid feels like a collage (one big hero, a couple of wides, the rest
 *  square) rather than a uniform table. Falls back to 1×1 beyond the pattern. */
const SPANS = [
  'col-span-2 row-span-2', // 0 — hero pet, big square
  'col-span-2 row-span-1', // 1 — wide
  'col-span-1 row-span-1', // 2
  'col-span-1 row-span-1', // 3
  'col-span-2 row-span-1', // 4 — wide
  'col-span-2 row-span-1', // 5 — wide
]

export function MarketSnapshotBento({
  stats,
  pets,
  valuesHref,
}: {
  stats: HubStat[]
  pets: HubTeaserItem[]
  valuesHref: string
}) {
  // Collage needs at least a few priced pets; otherwise render nothing (the
  // hero already has a graceful no-data path upstream).
  const collage = (pets ?? []).filter((p) => p.imageUrl).slice(0, 6)
  if (collage.length < 3) return null

  // The two supporting stats, pulled from the real HubStat rows by label.
  const highest = stats.find((s) => /highest/i.test(s.label))
  const trending =
    stats.find((s) => /trending/i.test(s.label)) ??
    stats.find((s) => s.sub != null)

  return (
    <div className="bhh-anim [animation-delay:90ms]">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-text-secondary">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#4FB477]" />
        Live Market
      </div>

      {/* The mosaic — cells sit directly on the hero (no outer panel/backdrop).
          Fixed row height so the spans read as a real collage. */}
      <div className="grid auto-rows-[78px] grid-cols-4 gap-2.5">
        {collage.map((pet, i) => (
          <PetCell
            key={pet.slug}
            pet={pet}
            href={`${valuesHref}/${pet.slug}`}
            span={SPANS[i] ?? 'col-span-1 row-span-1'}
            big={i === 0}
          />
        ))}
      </div>

      {/* Supporting stats + CTA. */}
      <div className="mt-3 flex flex-wrap items-stretch gap-3">
        {highest && (
          <StatChip label={highest.label} value={highest.value} href={highest.href} />
        )}
        {trending && (
          <StatChip
            label={trending.label}
            value={trending.value}
            sub={trending.sub}
            trend={trending.trend}
            href={trending.href}
          />
        )}
        <Link
          href={valuesHref}
          className={`group/see ml-auto self-center ${VALUE_BTN_SECONDARY}`}
        >
          See The Full Value List
          <ArrowRightIcon
            size={16}
            weight="bold"
            aria-hidden
            className="transition-transform group-hover/see:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      </div>
    </div>
  )
}

/**
 * One pet in the collage. Art fills the cell; name + price sit on a bottom
 * gradient. A soft neutral glow follows the cursor on hover (hidden under
 * reduced motion).
 */
function PetCell({
  pet,
  href,
  span,
  big,
}: {
  pet: HubTeaserItem
  href: string
  span: string
  big?: boolean
}) {
  const tx = useMotionValue(-200)
  const ty = useMotionValue(-200)
  const fill = useMotionTemplate`radial-gradient(140px circle at ${tx}px ${ty}px, rgba(255,255,255,0.07), transparent 60%)`

  return (
    <Link
      href={href}
      className={`group/cell relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${VALUE_SURFACE_LINK} ${span}`}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        tx.set(e.clientX - r.left)
        ty.set(e.clientY - r.top)
      }}
    >
      {/* Soft fill glow that follows the cursor. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover/cell:opacity-100 motion-reduce:hidden"
        style={{ background: fill }}
      />

      {pet.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- remote pet art
        <img
          src={pet.imageUrl}
          alt={pet.name}
          className={`absolute left-1/2 top-1/2 z-0 -translate-x-1/2 object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover/cell:scale-[1.06] ${
            big
              ? '-translate-y-[58%] h-[68%] w-[68%]'
              : '-translate-y-1/2 h-[62%] w-[62%]'
          }`}
        />
      )}

      {/* Bottom gradient + label so the name/price stay readable over art. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/3"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 82%)',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 px-2.5 pb-2">
        <div className="min-w-0">
          <p
            className={`truncate font-semibold text-text-primary ${
              big ? 'text-body' : 'text-caption'
            }`}
          >
            {pet.name}
          </p>
          <p
            className={`font-semibold tabular-nums text-text-primary ${
              big ? 'text-body-sm' : 'text-[11px]'
            }`}
          >
            {pet.priceLabel}
          </p>
        </div>
        {pet.variant && <VariantBadge code={pet.variant} big={big} />}
      </div>
    </Link>
  )
}

/**
 * Variant tag for a pet's price (which form the value is for — FR, NFR, …):
 * a flat dark tag with the variant's own colour dot (the shared Adopt Me
 * variant colours), full name in the tooltip.
 */
function VariantBadge({ code, big }: { code: string; big?: boolean }) {
  const upper = code.toUpperCase()
  return (
    <span
      title={VARIANT_LABEL[upper as Variant] ?? code}
      className={`inline-flex shrink-0 select-none items-center gap-1 rounded bg-black/55 font-semibold leading-none text-text-primary backdrop-blur-sm ${
        big ? 'h-6 px-1.5 text-[12px]' : 'h-5 px-1 text-[10px]'
      }`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: variantColor(upper) }} />
      {code}
    </span>
  )
}

/** A compact supporting stat below the collage (highest value / trending). */
function StatChip({
  label,
  value,
  sub,
  trend,
  href,
}: {
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down'
  href?: string
}) {
  const body = (
    <>
      <p className={VALUE_LABEL}>{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="truncate text-[20px] font-bold leading-none text-text-primary">
          {value}
        </span>
        {sub && (
          <span
            className={`flex items-center gap-0.5 text-body-sm font-semibold tabular-nums ${
              trend === 'down' ? 'text-error' : 'text-success'
            }`}
          >
            {trend === 'down' ? (
              <CaretDownIcon size={12} weight="fill" aria-label="Down" />
            ) : (
              <CaretUpIcon size={12} weight="fill" aria-label="Up" />
            )}
            {sub.replace(/^[+-]/, '')}
          </span>
        )}
      </p>
    </>
  )
  const cls = 'min-w-[140px] flex-1 px-4 py-3'
  return href ? (
    <Link
      href={href}
      className={`${cls} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${VALUE_SURFACE_LINK}`}
    >
      {body}
    </Link>
  ) : (
    <div className={`${cls} ${VALUE_SURFACE}`}>{body}</div>
  )
}
