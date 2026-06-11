import Link from 'next/link'
import Image from 'next/image'

export interface CategoryCardProps {
  href: string
  name: string
  /** Subtitle line — game name (e.g. "Fortnite"). */
  game: string
  iconSrc: string
  /** Lowest-priced listing in the category. */
  fromPrice: number
  /** Active listing count, formatted by the card as "1.2K" or raw if < 1000. */
  listingCount: number
}

/** Compact a count, e.g. 12400 -> "12.4K", 980 -> "980". */
function formatCount(n: number): string {
  if (n < 1000) return n.toString()
  const k = n / 1000
  return `${k.toFixed(k < 10 ? 1 : 0)}K`
}

/**
 * Items / Accounts category card — mirrors CurrencyCard's visual shape so
 * Currencies | Items | Accounts tabs all render identical card sizes.
 */
export function CategoryCard({ href, name, game, iconSrc, fromPrice, listingCount }: CategoryCardProps) {
  return (
    <Link
      href={href}
      className="disco-card flex flex-col gap-3 p-5 bg-bg-raised border border-border-subtle rounded-lg cursor-pointer transition-all duration-default ease-gv hover:-translate-y-1 hover:border-border-strong hover:bg-bg-raised-hover hover:shadow-raised"
    >
      <Image
        src={iconSrc}
        alt={name}
        width={52}
        height={52}
        className="w-[52px] h-[52px] rounded-md flex-none object-cover"
      />
      <span className="font-display font-bold text-body text-text-primary leading-tight">{name}</span>
      <span className="text-[13px] text-text-tertiary">{game}</span>

      <div className="flex gap-1.5 flex-wrap">
        <span className="inline-flex items-center h-[22px] px-2 font-semibold text-[11px] rounded-sm bg-bg-overlay-2 text-text-secondary border border-border-default">
          {formatCount(listingCount)} listings
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mt-auto pt-3 border-t border-border-subtle">
        <span className="text-caption text-text-tertiary">from</span>
        <span className="font-display font-bold text-[18px] text-tabular text-text-primary">
          ${fromPrice.toFixed(2)}
        </span>
      </div>
    </Link>
  )
}
