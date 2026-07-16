import { ShopCard } from './ShopCard'

export interface CurrencyCardProps {
  slug: string
  name: string
  game: string
  iconSrc: string
  fromPrice: number
  badges?: ('instant' | string)[]
}

/**
 * Popular Currencies card — V57: thin wrapper over the shared ShopCard
 * homepage primitive ('instant' renders as a success chip).
 * CLICK: navigates to /{slug} (the real {game}/{category} marketplace path)
 */
export function CurrencyCard({
  slug,
  name,
  game,
  iconSrc,
  fromPrice,
  badges = [],
}: CurrencyCardProps) {
  // `slug` is the real marketplace path segment "{gameSlug}/{categorySlug}"
  // (e.g. "fortnite/buy-vbucks"). Link straight to it — the old /currency and
  // /topup prefixes pointed at routes that don't exist (dead 404 links).
  return (
    <ShopCard
      href={`/${slug}`}
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
