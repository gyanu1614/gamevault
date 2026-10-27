/**
 * The pet page's offer model (owner, 2026-10-26): one page per pet; the buy
 * box shows the cheapest offer of the picked trait ("Any Trait" = cheapest
 * overall, the default from the items grid; a values page's Buy arrives with
 * its trait picked); the trait picker shows each trait's price, or nothing to
 * buy (Notify Me); the list below shows the trait's other offers.
 */

export interface TraitDef {
  key: string
  label: string
  /** "FR", "NFR" — Adopt Me's trade shorthand; null where there is none. */
  short: string | null
}

export interface TraitOption {
  /** null = Any Trait. */
  variant: string | null
  label: string
  short: string | null
  count: number
  minPriceUsd: number | null
}

export interface OfferLike {
  id: string
  pricePerUnit: number
  recommended: number
}

/** Cheapest first; a price tie goes to the better-ranked offer. */
const byPrice = (a: OfferLike, b: OfferLike) => a.pricePerUnit - b.pricePerUnit || b.recommended - a.recommended

export function offersOfTrait<T extends OfferLike>(offers: readonly T[], variantOf: Readonly<Record<string, string | null>>, variant: string | null): T[] {
  const inTrait = variant === null ? [...offers] : offers.filter((o) => variantOf[o.id] === variant)
  return inTrait.sort(byPrice)
}

/** Any Trait first, then every trait in catalogue order. Empty for a game without traits. */
export function traitOptions(
  traits: readonly TraitDef[],
  offers: readonly OfferLike[],
  variantOf: Readonly<Record<string, string | null>>,
  anyLabel = 'Any Trait',
): TraitOption[] {
  if (traits.length === 0) return []
  const summary = (variant: string | null) => {
    const list = offersOfTrait(offers, variantOf, variant)
    return { count: list.length, minPriceUsd: list[0]?.pricePerUnit ?? null }
  }
  return [
    { variant: null, label: anyLabel, short: null, ...summary(null) },
    ...traits.map((t) => ({ variant: t.key, label: t.label, short: t.short, ...summary(t.key) })),
  ]
}

/** The buy box's offer: the one the buyer chose from the list while it fits the trait, else the trait's cheapest. */
export function pickOffer<T extends OfferLike>(
  offers: readonly T[],
  variantOf: Readonly<Record<string, string | null>>,
  variant: string | null,
  chosenId: string | null,
): T | null {
  const list = offersOfTrait(offers, variantOf, variant)
  return list.find((o) => o.id === chosenId) ?? list[0] ?? null
}

/** The trait the page opens on: the URL's, when the game has it; else Any Trait. */
export function initialTrait(traits: readonly TraitDef[], urlVariant: string | null): string | null {
  return urlVariant && traits.some((t) => t.key === urlVariant) ? urlVariant : null
}

/** What a game calls its variants. */
export function traitNoun(gameSlug: string): 'Trait' | 'Mutation' {
  return gameSlug === 'adopt-me' ? 'Trait' : 'Mutation'
}
