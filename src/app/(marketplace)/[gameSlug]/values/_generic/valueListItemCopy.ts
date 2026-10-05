/**
 * Copy for a value-list item page (Murder Mystery 2 first), built ONLY from
 * the item's own data: catalogue facts (rarity, type, origin, year, the
 * chroma ↔ base link) and the published price. Pure, so it is unit-tested and
 * the page, the FAQ block and the FAQPage schema all say the same thing.
 *
 * Deliberately NOT said: whether an item is still obtainable (the wiki flag
 * behind `obtain.still_obtainable` is unreliable — 2017 event items read as
 * obtainable) and drop odds. Both come only from the verified how_to_get
 * entry (valueHowToGetCopy.ts), which itemFaq takes as an argument.
 */

import type { ValueObtainSource } from '@/lib/values/data'

export interface ItemCopyInput {
  name: string
  gameName: string
  shortName: string
  rarity: string | null
  /** Lower-case noun: "knife", "gun", "pet", "item". */
  typeNoun: string
  releaseYear: number | null
  origin: string | null
  obtain: ValueObtainSource[]
  cheapestUsd: number | null
  marketUsd: number | null
  listedNow: number
  /** ISO time the published value last moved. */
  priceChangedAt: string | null
  /** The other form: this item's Chroma, or (on a Chroma) its base. */
  counterpart: { name: string; isChroma: boolean; cheapestUsd: number | null } | null
}

export const formatUsd = (v: number): string =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

function asOf(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/** "from Knife Box 2" / "as a battle-pass reward in the Halloween Event 2021". */
export function originPhrase(source: ValueObtainSource | undefined, origin: string | null): string | null {
  const name = source?.name?.trim() || origin?.trim()
  if (!name) return null
  switch (source?.kind) {
    case 'pass':
      return `as a battle-pass reward in the ${name}`
    case 'gamepass':
      return `with the ${name}`
    case 'shop':
      return `from the ${name}`
    case 'crafting':
      return 'through crafting'
    case 'code':
      return 'from a code'
    case 'box':
    case 'event':
      return `from the ${name}`
    default:
      return `from ${name}`
  }
}

/** "Harvester is an Ancient gun in Murder Mystery 2, released in 2021 as a battle-pass reward in the Halloween Event 2021." */
export function aboutSentence(i: ItemCopyInput): string {
  const tier = i.rarity ? `${i.rarity} ${i.typeNoun}` : i.typeNoun
  const from = originPhrase(i.obtain[0], i.origin)
  let s = `${i.name} is ${article(tier)} ${tier} in ${i.gameName}`
  if (i.releaseYear && from) s += `, released in ${i.releaseYear} ${from}`
  else if (i.releaseYear) s += `, released in ${i.releaseYear}`
  else if (from) s += ` ${from}`
  return `${s}.`
}

/** The chroma ↔ base sentence, with the real price ratio when both are priced. */
export function chromaSentence(i: ItemCopyInput): string | null {
  const c = i.counterpart
  if (!c) return null
  const ratio =
    i.cheapestUsd != null && c.cheapestUsd != null && c.cheapestUsd > 0 && i.cheapestUsd > 0
      ? c.isChroma
        ? c.cheapestUsd / i.cheapestUsd
        : i.cheapestUsd / c.cheapestUsd
      : null
  const times = ratio != null && ratio >= 1.1 ? `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}×` : null
  if (c.isChroma) {
    return times
      ? `Its Chroma form, the ${c.name}, has a color-shifting finish, drops far less often and sells for about ${times} as much (${formatUsd(c.cheapestUsd!)}).`
      : `Its Chroma form, the ${c.name}, has a color-shifting finish and drops far less often.`
  }
  return times
    ? `It is the Chroma form of the ${c.name}: the same ${i.typeNoun} with a color-shifting finish, which drops far less often — and sells for about ${times} the ${c.name}'s ${formatUsd(c.cheapestUsd!)}.`
    : `It is the Chroma form of the ${c.name}: the same ${i.typeNoun} with a color-shifting finish, which drops far less often.`
}

/** The answer-first, dated price sentence (what an answer engine quotes). */
export function priceSentence(i: ItemCopyInput): string | null {
  if (i.cheapestUsd == null) return null
  const date = asOf(i.priceChangedAt)
  const market =
    i.marketUsd != null && i.marketUsd > i.cheapestUsd + 0.005
      ? `, and the typical market price is ${formatUsd(i.marketUsd)}`
      : ''
  const listings = i.listedNow === 1 ? '1 live listing' : `${i.listedNow.toLocaleString('en-US')} live listings`
  return `${date ? `As of ${date}, the` : 'The'} cheapest ${i.name} from a reputable seller costs ${formatUsd(i.cheapestUsd)}${market}, across ${listings}.`
}

/**
 * The page's FAQ (visible block + the one FAQPage schema). `howTo` is the
 * verified "How do you get X?" entry (valueHowToGetCopy.howToGetFaq): when the
 * item has one it takes the "Where does X come from?" slot, so the page never
 * answers the same question twice from two sources.
 */
export function itemFaq(i: ItemCopyInput, howTo: { q: string; a: string } | null = null): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = []
  const price = priceSentence(i)
  out.push({
    q: `How much is ${i.name} worth in ${i.shortName}?`,
    a: price
      ? `${price} These are real US-dollar prices from sellers with hundreds of completed orders — not community value points — and they update every day.`
      : `We do not have enough reputable listings to price ${i.name} right now. We only publish a value when at least three live listings from established sellers back it.`,
  })
  const from = originPhrase(i.obtain[0], i.origin)
  if (howTo) {
    out.push(howTo)
  } else if (from || i.releaseYear) {
    out.push({
      q: `Where does ${i.name} come from?`,
      a: `${aboutSentence(i)} Besides that source, players get one by trading for it or buying it from another player.`,
    })
  }
  const chroma = chromaSentence(i)
  if (chroma && i.counterpart) {
    out.push({
      q: i.counterpart.isChroma
        ? `How much is the ${i.counterpart.name} worth?`
        : `How is ${i.name} different from the ${i.counterpart.name}?`,
      a: chroma,
    })
  }
  out.push({
    q: `Why are there two prices for ${i.name}?`,
    a: `Cheapest is the lowest price a reputable seller is asking right now — what a buyer can actually pay today. Market is the typical price across the cheapest handful of reputable listings. A lone low listing far below the rest is skipped, because it is usually a mislabelled or fake offer.`,
  })
  out.push({
    q: `How do I sell my ${i.name} for real money?`,
    a: `List it on DropMarket and price it against the value on this page. Buyers find listings through these value pages, and every order is covered by SafeDrop — the buyer gets exactly what they ordered, or their money back.`,
  })
  return out
}
