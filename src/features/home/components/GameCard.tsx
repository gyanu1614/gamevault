import Image from 'next/image'
import { SmartLink } from '@/components/global/SmartLink'

export interface GameCardProps {
  slug: string
  name: string
  /** Portrait cover art, 3:4 ratio (e.g. 600×800). */
  coverSrc: string
  /**
   * V17u — Canonical landing href, resolved by usePopularGames from
   * the game's first active category (e.g. /roblox/buy-robux).
   * Optional only for backwards compat; the hook always supplies one.
   */
  href?: string
  /** Available marketplace categories shown as compact metadata badges. */
  categoryLinks?: { slug: string; label: string }[]
}

/**
 * Popular Games card — portrait cover-art tile (Steam-library style).
 * HOVER: lift 4px, name turns lime, subtle scale on the cover image.
 * CLICK: navigates to the game's canonical category landing.
 */
export function GameCard({ slug, name, coverSrc, href, categoryLinks = [] }: GameCardProps) {
  const shownCategories = categoryLinks
    .filter((category) => !/boost|top.?up|coach|gift|server|key/i.test(`${category.slug} ${category.label}`))
    .slice(0, 3)

  return (
    <SmartLink
      href={href ?? `/${slug}/buy-currency`}
      className="group flex min-w-0 flex-col cursor-pointer transition-all duration-default ease-gv hover:-translate-y-1 focus-visible:shadow-focus-ring"
    >
      {/* Cover art — 3:4 portrait, rounded card */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-elevated transition-colors group-hover:border-border-strong">
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

      {/* Centered title and category metadata keep every card balanced. */}
      <span className="mt-3 line-clamp-2 px-1 text-center font-display text-[17px] font-bold leading-[1.15] text-text-primary transition-colors group-hover:text-lime">
        {name}
      </span>

      {shownCategories.length > 0 && (
        <span className="mt-2 flex flex-wrap justify-center gap-1.5 px-1">
          {shownCategories.map((category) => (
            <span
              key={category.slug}
              className="inline-flex min-h-[26px] items-center rounded-md border border-white/[0.08] bg-white/[0.12] px-2 text-[11px] font-semibold text-text-secondary"
            >
              {category.label.replace(/\s*\(.*?\)\s*/g, '')}
            </span>
          ))}
        </span>
      )}
    </SmartLink>
  )
}
