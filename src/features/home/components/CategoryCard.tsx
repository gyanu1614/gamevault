import { ShopCard } from './ShopCard'

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
 * Items / Accounts category card — V57: thin wrapper over the shared
 * ShopCard homepage primitive so all three tabs render identically.
 */
export function CategoryCard({ href, name, game, iconSrc, fromPrice, listingCount }: CategoryCardProps) {
  return (
    <ShopCard
      href={href}
      name={name}
      game={game}
      iconSrc={iconSrc}
      fromPrice={fromPrice}
      chips={[{ label: `${formatCount(listingCount)} listings` }]}
    />
  )
}
