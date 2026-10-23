/**
 * The /[game]/sell page's title, description and FAQ, written from the data
 * the page actually has (values platform Step E), so the 243 sell pages stop
 * being one page with the name swapped. No fee anywhere (owner, 2026-10-21:
 * "showing them fee upfront is the worst way" — sellers see it when they
 * list). Numbers first, plain words. Pure.
 */
import { formatUsd } from '@/lib/value-listings/format'

/** What the page can show, richest first. */
export type SellTier = 'values' | 'listings' | 'categories'

export interface SellCopyItem {
  name: string
  priceUsd: number
  /** Adopt Me: the form the price is for ("Fly Ride"). */
  form: string | null
}

export interface SellCopyInput {
  gameSlug: string
  name: string
  /** Plural, Title Case: "Pets", "Brainrots", "Items", "Accounts". */
  noun: string
  tier: SellTier
  /** Items with a price on the values hub. */
  pricedCount?: number
  /** Highest price first (sell-items mostValuable). */
  valuable?: SellCopyItem[]
  /** Live DropMarket offers across the game, and the lowest price. */
  offers?: { total: number; fromUsd: number | null } | null
  /** Enabled categories with their live offers (0 when none). */
  categories?: { name: string; count: number; fromUsd: number | null }[]
  players?: { playingNow: number | null; peak7d: number | null } | null
}

const count = (n: number) => n.toLocaleString('en-US')
const priced = (i: SellCopyItem) => `${i.name}${i.form ? ` (${i.form})` : ''}`

/** "A, B and C". */
function listOf(parts: string[]): string {
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** The forms question, where a game's forms change the price. */
const FORMS_FAQ: Record<string, { q: string; a: string }> = {
  'adopt-me': {
    q: 'Do Neon and Mega Neon pets sell for more?',
    a: "Yes, usually much more than the normal pet. Every pet's value page shows the price of each form: Normal, Neon, Mega Neon, Fly and Ride.",
  },
  'steal-a-brainrot': {
    q: 'Do mutations change what a brainrot sells for?',
    a: "Yes. A mutation like Gold, Diamond or Rainbow raises a brainrot's income, and its price with it. Each brainrot's value page lists the price of every mutation we track.",
  },
  'murder-mystery-2': {
    q: 'Do Chroma items sell for more?',
    a: 'Usually, yes. A Chroma is its own item with its own price, and every item page links its Standard and Chroma forms so you can compare.',
  },
}

export function sellTitle({ name, noun }: Pick<SellCopyInput, 'name' | 'noun'>): string {
  return `Sell ${name} ${noun} for Real Money`
}

export function sellDescription(input: SellCopyInput): string {
  const { name, tier } = input
  const noun = input.noun.toLowerCase()
  const close = 'List free and get paid when it sells.'
  const top = input.valuable?.[0]
  if (tier === 'values' && input.pricedCount && top) {
    return `${count(input.pricedCount)} ${name} ${noun} priced daily: ${priced(top)} sells for ${formatUsd(top.priceUsd)}. Sell yours for real money on DropMarket. ${close}`
  }
  if (input.offers && input.offers.total > 0) {
    const from = input.offers.fromUsd != null ? ` from ${formatUsd(input.offers.fromUsd)}` : ''
    return `${count(input.offers.total)} ${name} offers live on DropMarket${from}. Sell your ${name} ${noun} for real money. ${close}`
  }
  if (input.players?.playingNow) {
    return `${count(input.players.playingNow)} people are playing ${name} right now. Sell your ${name} ${noun} for real money on DropMarket. ${close}`
  }
  return `Sell your ${name} ${noun} for real money on DropMarket, with SafeDrop Protection on every order. ${close}`
}

export function sellFaq(input: SellCopyInput): { q: string; a: string }[] {
  const { name, gameSlug } = input
  const noun = input.noun.toLowerCase()
  const faq: { q: string; a: string }[] = []

  const valuable = input.valuable ?? []
  if (valuable.length >= 3) {
    faq.push({
      q: `What are the most valuable ${name} ${noun} to sell?`,
      a: `Right now: ${listOf(valuable.slice(0, 5).map((i) => `${priced(i)} at ${formatUsd(i.priceUsd)}`))}. Prices update daily from live listings by reputable sellers.`,
    })
  }
  if (valuable[0]) {
    const top = valuable[0]
    faq.push({
      q: `How much is a ${top.name} worth?`,
      a: `${priced(top)} sells for about ${formatUsd(top.priceUsd)} right now. Its value page shows how that price has moved.`,
    })
  }
  if (input.tier === 'values' && FORMS_FAQ[gameSlug]) faq.push(FORMS_FAQ[gameSlug])

  const live = (input.categories ?? []).filter((c) => c.count > 0)
  if (live.length > 0) {
    faq.push({
      q: `What ${name} ${noun} can I sell on DropMarket?`,
      a: `${name} buyers are shopping ${listOf(live.map((c) => `${c.name} (${count(c.count)} live${c.fromUsd != null ? `, from ${formatUsd(c.fromUsd)}` : ''})`))}. List yours in the same section.`,
    })
  } else {
    for (const c of (input.categories ?? []).slice(0, 3)) {
      faq.push({
        q: `Can I sell ${name} ${c.name.toLowerCase()}?`,
        a: `Yes. List your ${name} ${c.name.toLowerCase()} on DropMarket with a price and a delivery time; buyers can order as soon as it is live.`,
      })
    }
  }

  const p = input.players
  if (p?.playingNow) {
    faq.push({
      q: `How many people play ${name}?`,
      a: `About ${count(p.playingNow)} people were playing ${name} at our last check${p.peak7d ? `, with a peak of ${count(p.peak7d)} this week` : ''}. More players means more buyers looking for ${noun}.`,
    })
  }

  faq.push(
    {
      q: `How do I sell ${name} for real money?`,
      a: `Sign up as a seller, then list your ${name} ${noun} with a price and a delivery time. When a buyer orders, the order has SafeDrop Protection; you deliver in-game, they confirm, and the money goes to your Seller Balance to withdraw.`,
    },
    {
      q: 'What does it cost to sell?',
      a: 'Listing is free. You pay a small commission only when something sells, and it drops as your seller rank goes up. Founding sellers get a lower rate for their first year, applied to every sale.',
    },
    {
      q: 'Is it safe to sell here?',
      a: 'Yes. SafeDrop Protection covers you against buyers who pay and then vanish, and every message and delivery stays on DropMarket, where each order is covered.',
    },
    {
      q: 'How do I get paid?',
      a: 'When the buyer confirms delivery, the money goes to your Seller Balance. Withdraw it to your payout method whenever you like.',
    },
  )
  return faq
}
