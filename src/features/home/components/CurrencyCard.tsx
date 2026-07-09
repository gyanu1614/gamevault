import { ShopCard } from './ShopCard'

export interface CurrencyCardProps {
  slug: string
  name: string
  game: string
  iconSrc: string
  fromPrice: number
  badges?: ('instant' | string)[]
  /** Override the default `/currency/[slug]` link — used by Top-Ups & Gift Cards row. */
  hrefBase?: string
}

/**
 * Popular Currencies card — V57: thin wrapper over the shared ShopCard
 * homepage primitive ('instant' renders as a success chip).
 * CLICK: navigates to /currency/[slug] (or hrefBase/[slug] if provided)
 */
export function CurrencyCard({
  slug,
  name,
  game,
  iconSrc,
  fromPrice,
  badges = [],
  hrefBase = '/currency',
}: CurrencyCardProps) {
  return (
    <ShopCard
      href={`${hrefBase}/${slug}`}
      name={name}
      game={game}
      iconSrc={iconSrc}
      fromPrice={fromPrice}
      chips={badges.map((badge) =>
        badge === 'instant'
          ? { label: 'Instant', tone: 'success' as const }
          : { label: badge },
      )}
    />
  )
}
