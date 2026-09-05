'use client'

/**
 * "Live Market" collage for the blog hub hero — a mosaic of the top priced pets
 * (mixed tile sizes, nicely fitted) laid over a DIMMED pet-art backdrop, so the
 * panel reads as a living market rather than a flat black box. Below the collage
 * sit the highest-value + trending stats and a link to the full value list.
 *
 * Every card is a real, published pet with a real price (from getHubTopValues);
 * the two stat chips come from the same HubStat rows the compact strip uses.
 * Modern hover: a per-card cursor-tracking glow + a border-reveal (mask
 * composited) — never a flat background swap. Reduced-motion users get static
 * cards. Renders nothing when there's no data.
 */

import Link from 'next/link'
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
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
      <div className="mb-3 flex items-center gap-2 text-caption font-bold uppercase tracking-[0.14em] text-[#CFE0D6]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3FA96A] opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#4FB477]" />
        </span>
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
          className="group/see ml-auto inline-flex items-center gap-2 self-center border border-[#2C3A31] bg-white/[0.03] px-4 py-2.5 text-body-sm font-semibold text-[#CFE0D6] transition hover:border-[#2F6B46] hover:bg-white/[0.06] hover:text-white"
        >
          See The Full Value List
          <ArrowForwardIcon
            sx={{ fontSize: 16 }}
            className="transition-transform group-hover/see:translate-x-0.5"
          />
        </Link>
      </div>
    </div>
  )
}

/**
 * One pet in the collage. Art fills the cell; name + price sit on a bottom
 * gradient. Cursor-tracking glow + border-reveal on hover (mask-composited),
 * static under reduced motion.
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
  const fill = useMotionTemplate`radial-gradient(140px circle at ${tx}px ${ty}px, rgba(79,180,119,0.14), transparent 60%)`
  const ring = useMotionTemplate`radial-gradient(140px circle at ${tx}px ${ty}px, rgba(96,201,132,0.6), transparent 60%)`

  return (
    <Link
      href={href}
      className={`group/cell relative overflow-hidden border border-white/10 bg-[#0E1211]/55 backdrop-blur-md transition-colors duration-300 hover:border-[#2F6B46] ${span}`}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        tx.set(e.clientX - r.left)
        ty.set(e.clientY - r.top)
      }}
    >
      {/* Border-reveal — lights only the edge nearest the cursor. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300 group-hover/cell:opacity-100 motion-reduce:hidden"
        style={{
          background: ring,
          padding: '1px',
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
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
            'linear-gradient(180deg, transparent 0%, rgba(6,9,8,0.62) 82%)',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 px-2.5 pb-2">
        <div className="min-w-0">
          <p
            className={`truncate font-bold text-white ${
              big ? 'text-body' : 'text-caption'
            }`}
          >
            {pet.name}
          </p>
          <p
            className={`font-mono font-bold text-[#7FE0A0] ${
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
 * Variant tag for a pet's price (which form the value is for — FR, NFR, …).
 * Styled like an app-icon glyph: a rounded-square tile with a forest gradient,
 * a top inner highlight for depth, and a thick white letterform — matching the
 * house logo treatment while staying on the forest palette.
 */
function VariantBadge({ code, big }: { code: string; big?: boolean }) {
  return (
    <span
      title={variantTitle(code)}
      className={`relative inline-flex shrink-0 select-none items-center justify-center rounded-[5px] font-extrabold leading-none text-white shadow-[0_2px_5px_rgba(0,0,0,0.45)] ring-1 ring-white/15 ${
        big ? 'h-6 min-w-6 px-1.5 text-[12px]' : 'h-5 min-w-5 px-1 text-[10px]'
      }`}
      style={{
        background:
          'linear-gradient(160deg, #3FB877 0%, #2E7D4F 55%, #24603E 100%)',
      }}
    >
      {/* Top-edge sheen — the subtle glossy highlight the logo tile has. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[5px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)',
        }}
      />
      <span className="relative tracking-[0.02em]">{code}</span>
    </span>
  )
}

/** Human-readable name for a variant code, for the badge's tooltip. */
function variantTitle(code: string): string {
  const map: Record<string, string> = {
    N: 'Normal',
    F: 'Fly',
    R: 'Ride',
    FR: 'Fly Ride',
    NEON: 'Neon',
    NFR: 'Neon Fly Ride',
    MEGA: 'Mega Neon',
    MFR: 'Mega Neon Fly Ride',
  }
  return map[code.toUpperCase()] ?? code
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8A978E]">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="truncate text-[20px] font-extrabold leading-none text-[#F2F6F0]">
          {value}
        </span>
        {sub && (
          <span
            className={`font-mono text-body-sm font-bold ${
              trend === 'down' ? 'text-[#E0736B]' : 'text-[#5BC77E]'
            }`}
          >
            {trend === 'down' ? '▼' : '▲'} {sub.replace(/^[+-]/, '')}
          </span>
        )}
      </p>
    </>
  )
  const cls =
    'min-w-[140px] flex-1 border border-white/10 bg-[#0E1211]/55 backdrop-blur-md px-4 py-3 transition-colors duration-300 hover:border-[#2F6B46]'
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
