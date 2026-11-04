import { formatStatPrice } from '@/lib/seo/page-stats-format'

export interface AboutFacts {
  gameSlug: string
  gameName: string
  itemNoun: string
  itemNounSingular: string
  /** The game's enabled category names, in nav order. */
  categoryNames: string[]
  offerCount: number
  lowPrice: number | null
  hasValues: boolean
  /** The currency's name when the game sells one ("Robux"), else null. */
  currencyName: string | null
}

export interface AboutRow {
  id: 'buy' | 'what' | 'why'
  heading: string
  paragraphs: string[]
  /** Art side: text on the left (art right), text on the right (art left), or centred text. */
  layout: 'text-left' | 'text-right' | 'centre'
  link: { href: string; label: string } | null
}

/** "pets, accounts and boosting" (lowercase, except a currency's proper name). */
function listOf(names: string[], currencyName: string | null): string {
  const words = names.map((n) => (n === currencyName ? n : n.toLowerCase()))
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/**
 * About {Game} (owner, 2026-10-23: Eldorado-style keyword copy, laid out
 * left / right / centre). Written for buyers from the game's real numbers;
 * a fact we don't have is left out, never filled with a placeholder.
 */
export function aboutRows(f: AboutFacts): AboutRow[] {
  const items = f.itemNoun.toLowerCase()
  const item = f.itemNounSingular.toLowerCase()
  const live =
    f.offerCount > 0
      ? ` Right now there ${f.offerCount === 1 ? 'is' : 'are'} ${f.offerCount.toLocaleString('en-US')} live ${f.offerCount === 1 ? 'offer' : 'offers'}${
          f.lowPrice != null && f.lowPrice > 0 ? ` from $${formatStatPrice(f.lowPrice)}` : ''
        }.`
      : ''

  const buy: AboutRow = {
    id: 'buy',
    heading: `Buy ${f.gameName} ${f.itemNoun} From Verified Sellers`,
    paragraphs: [
      `Every ${f.gameName} ${item} on DropMarket is listed by a player or a shop, so prices come from real offers competing for your order, not a fixed price list.${live}`,
      `Pick the ${item} you want, compare price, delivery time and seller rating, then pay at checkout. SafeDrop Protection covers every order: you get what you ordered, or your money back.`,
    ],
    layout: 'text-left',
    link: null,
  }

  const categories = f.categoryNames.length > 0 ? `The ${f.gameName} marketplace has ${listOf(f.categoryNames, f.currencyName)}.` : ''
  const currency = f.currencyName ? ` ${f.currencyName} is sold by the amount you need, delivered by the seller.` : ''
  const values = f.hasValues
    ? `Not sure what a ${item} is worth? The free ${f.gameName} value list shows today's prices for every ${item}, updated daily.`
    : `Each listing shows its price, delivery time and the seller's rating before you buy.`
  const what: AboutRow = {
    id: 'what',
    heading: `What You Can Buy in ${f.gameName}`,
    paragraphs: [`${categories}${currency}`.trim(), values].filter(Boolean),
    layout: 'text-right',
    link: f.hasValues ? { href: `/${f.gameSlug}/values`, label: `Open the ${f.gameName} Value List` } : null,
  }

  const why: AboutRow = {
    id: 'why',
    heading: `Why Buy ${f.gameName} ${f.itemNoun} on DropMarket?`,
    paragraphs: [
      `Many sellers compete for the same order, so you see the real market price. Every order has SafeDrop Protection, the delivery time is shown before you pay, and real people settle any dispute.`,
      `Have ${f.gameName} ${items} of your own? List them for free and get paid when they sell.`,
    ],
    layout: 'centre',
    // No button here: Start Selling already carries the sell intent on this page.
    link: null,
  }

  return [buy, what, why]
}
