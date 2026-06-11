import Link from 'next/link'
import Image from 'next/image'

export interface GameCardProps {
  slug: string
  name: string
  /** Portrait cover art, 3:4 ratio (e.g. 600×800). */
  coverSrc: string
}

/**
 * Popular Games card — portrait cover-art tile (Steam-library style).
 * HOVER: lift 4px, name turns lime, subtle scale on the cover image.
 * CLICK: navigates to /game/[slug]
 */
export function GameCard({ slug, name, coverSrc }: GameCardProps) {
  return (
    <Link
      href={`/game/${slug}`}
      className="group flex flex-col cursor-pointer transition-all duration-default ease-gv hover:-translate-y-1 focus-visible:shadow-focus-ring"
    >
      {/* Cover art — 3:4 portrait, rounded card */}
      <div className="relative w-full aspect-[3/4] overflow-hidden rounded-2xl border border-border-subtle bg-bg-raised shadow-elevated group-hover:border-border-strong transition-colors">
        <Image
          src={coverSrc}
          alt={name}
          fill
          sizes="220px"
          className="object-cover transition-transform duration-default ease-gv group-hover:scale-[1.04]"
        />
        {/* Subtle bottom-edge darkening so any future text-on-cover stays readable */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent"
        />
      </div>

      {/* Name */}
      <span className="font-display font-bold text-body-lg text-text-primary leading-tight mt-3 px-1 truncate group-hover:text-lime transition-colors">
        {name}
      </span>
    </Link>
  )
}
