import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { formatFromPrice } from '../lib/popular-listings'

/**
 * V57 — Shop-by-category card, homepage edition.
 *
 * The bundle-tile language (glass, top sheen, icon spotlight, floating
 * art, muted-lime selection cues) turned up for the homepage: centered
 * composition, bigger art, price as the hero line, and a lime glow
 * that answers hover. One primitive shared by the Currencies / Items /
 * Accounts tabs so every tab renders identical geometry.
 */
export interface ShopCardProps {
  href: string
  name: string
  /** Subtitle — game name. */
  game: string
  /** Game/category art. Empty/missing → initial-letter tile fallback. */
  iconSrc?: string | null
  fromPrice: number
  /** Small neutral chips under the title (e.g. "Instant", "1.2K listings"). */
  chips?: Array<{ label: string; tone?: 'success' | 'neutral' }>
}

export function ShopCard({ href, name, game, iconSrc, fromPrice, chips = [] }: ShopCardProps) {
  // The API sends a generic placeholder path when a category has no art
  // yet — treat it as missing so the letter tile renders instead.
  const art = iconSrc && !iconSrc.includes('game-fallback') ? iconSrc : null
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex snap-start flex-col items-center overflow-hidden rounded-xl border-2 border-border-default',
        'bg-[rgba(20,20,27,0.56)] p-5 pb-4 text-center backdrop-blur-md',
        // App-shell: tighter card on phones (3-up grid)
        'max-lg:rounded-[10px] max-lg:border max-lg:p-3 max-lg:pb-3',
        'transition-all duration-200 ease-gv',
        'hover:-translate-y-1 hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)]',
        'hover:shadow-[0_18px_36px_-14px_rgba(0,0,0,0.7),0_10px_30px_-12px_rgba(198,255,61,0.14)]',
      )}
    >
      {/* Top sheen — light falling from above. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent)]"
      />
      {/* Icon spotlight — neutral pool that warms to lime on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-6 h-16 w-28 -translate-x-1/2 rounded-full bg-white/[0.07] blur-xl transition-colors duration-300 group-hover:bg-[#C6FF3D1F]"
      />

      {/* Floating art — letter tile when there's no artwork yet (beats
          the old plus-circle placeholder). */}
      {art ? (
        <Image
          src={art}
          alt={name}
          width={64}
          height={64}
          className="relative mt-1 h-16 w-16 flex-none rounded-lg object-cover drop-shadow-[0_10px_12px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.07] max-lg:mt-0 max-lg:h-11 max-lg:w-11"
        />
      ) : (
        <span
          aria-hidden
          className="relative mt-1 grid h-16 w-16 flex-none place-items-center rounded-lg bg-[linear-gradient(150deg,#2A2F2A,#171B17)] font-display text-[24px] font-black text-text-secondary drop-shadow-[0_10px_12px_rgba(0,0,0,0.5)] max-lg:mt-0 max-lg:h-11 max-lg:w-11 max-lg:text-[17px]"
        >
          {(game || name).charAt(0).toUpperCase()}
        </span>
      )}

      {/* Identity */}
      <span className="relative mt-3.5 line-clamp-1 font-display text-[15px] font-bold leading-tight text-text-primary max-lg:mt-2 max-lg:text-[12.5px]">
        {name}
      </span>
      <span className="relative mt-0.5 line-clamp-1 text-[12.5px] text-text-tertiary max-lg:text-[10.5px]">{game}</span>

      {/* Chips */}
      {chips.length > 0 && (
        <span className="relative mt-2.5 flex flex-wrap items-center justify-center gap-1.5 max-lg:hidden">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className={cn(
                'inline-flex h-[22px] items-center rounded-md border px-2 text-[10.5px] font-semibold',
                chip.tone === 'success'
                  ? 'border-[rgba(74,222,128,0.25)] bg-success-bg text-success'
                  : 'border-border-default bg-bg-overlay text-text-secondary',
              )}
            >
              {chip.label}
            </span>
          ))}
        </span>
      )}

      {/* Price — the hero line. Hairline fades out both ways above it. */}
      <span
        aria-hidden
        className="relative mt-4 h-px w-full bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.10)_50%,transparent)] max-lg:mt-2.5"
      />
      <span className="relative mt-3 flex items-baseline gap-1.5 max-lg:mt-2">
        <span className="text-[11px] uppercase tracking-wider text-text-tertiary">from</span>
        <span className="font-display text-[19px] font-extrabold tabular-nums text-text-primary transition-colors duration-200 group-hover:text-lime-text max-lg:text-[15px]">
          ${formatFromPrice(fromPrice)}
        </span>
      </span>
    </Link>
  )
}
