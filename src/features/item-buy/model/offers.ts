/**
 * The pet page's offer model (owner, 2026-10-26/27): one page per pet; the
 * buy panel shows the cheapest offer of the picked trait — the URL's (a values
 * page's Buy) or else the cheapest offer's own trait (from the items grid);
 * the trait picker shows each trait's price, or nothing to buy (Notify Me);
 * the list below shows the pet's other offers, any trait.
 */

export interface TraitDef {
  key: string
  label: string
  /** "FR", "NFR" — Adopt Me's trade shorthand; null where there is none. */
  short: string | null
}

export interface TraitOption {
  variant: string
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

/** Every trait in catalogue order with its offer count and cheapest price. Empty for a game without traits. */
export function traitOptions(traits: readonly TraitDef[], offers: readonly OfferLike[], variantOf: Readonly<Record<string, string | null>>): TraitOption[] {
  return traits.map((t) => {
    const list = offersOfTrait(offers, variantOf, t.key)
    return { variant: t.key, label: t.label, short: t.short, count: list.length, minPriceUsd: list[0]?.pricePerUnit ?? null }
  })
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

/** The trait the page opens on: the URL's when the game has it, else the cheapest offer's; null = none (no offers). */
export function defaultTrait(
  traits: readonly TraitDef[],
  urlVariant: string | null,
  offers: readonly OfferLike[],
  variantOf: Readonly<Record<string, string | null>>,
): string | null {
  const known = (v: string | null | undefined): v is string => !!v && traits.some((t) => t.key === v)
  if (known(urlVariant)) return urlVariant
  const cheapest = offersOfTrait(offers, variantOf, null)[0]
  const v = cheapest ? variantOf[cheapest.id] : null
  return known(v) ? v : null
}

/** What a game calls its variants. */
export function traitNoun(gameSlug: string): 'Trait' | 'Mutation' {
  return gameSlug === 'adopt-me' ? 'Trait' : 'Mutation'
}
