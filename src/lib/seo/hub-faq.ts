/**
 * The game hub's FAQ, written as the questions players actually type
 * (Google autocomplete, 2026-10-06: "how much is 1000 robux in usd", "is it
 * safe to buy robux", "how to buy robux", "buy roblox items with real
 * money", "can you buy robux with apple pay/cash app"). Every answer leads
 * with the fact and carries live numbers where we have them; questions with
 * nothing true to say are left out rather than padded.
 *
 * Pure: page.tsx feeds the accordion and the FAQPage JSON-LD from one call.
 */

export interface HubFaqInput {
  gameName: string
  /** The game's currency, when it has a currency page. */
  currency: {
    name: string
    /** "$0.0052/Robux" or "$3.99" (cheapest live offer), or null. */
    fromLabel: string | null
    avgDelivery: string | null
    /** The official price of the pack closest to 1,000, from the researched guide. */
    official: { amount: number; usd: number; where: string } | null
  } | null
  items: { fromLabel: string | null; count: number } | null
  accounts: { fromLabel: string | null; count: number } | null
  /** Checkout's methods, in display order ("USDT", "Bitcoin", "Pix", …). */
  paymentMethods: string[]
}

export interface HubFaqItem {
  q: string
  a: string
}

const num = new Intl.NumberFormat('en-US')
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function list(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function buildHubFaq(input: HubFaqInput): HubFaqItem[] {
  const { gameName: game, currency: cur } = input
  const out: HubFaqItem[] = []

  if (cur?.official) {
    const o = cur.official
    out.push({
      q: `How much is ${num.format(o.amount)} ${cur.name} in USD?`,
      a:
        `${num.format(o.amount)} ${cur.name} costs ${usd(o.usd)} from ${o.where}. ` +
        (cur.fromLabel
          ? `On DropMarket, sellers start from ${cur.fromLabel}, so the same amount usually costs less. Compare offers on the ${cur.name} page before you buy.`
          : `On DropMarket, sellers set their own prices, so compare offers on the ${cur.name} page before you buy.`),
    })
  }

  out.push({
    q: cur ? `Is it safe to buy ${cur.name}?` : `Is it safe to buy ${game} items?`,
    a:
      `On DropMarket, yes. Every order is covered by SafeDrop Protection: if it doesn't arrive, or isn't what the listing described, you get a full refund. ` +
      `Every seller is ID-verified before they can list, and their rating and order history show on every offer.`,
  })

  if (cur) {
    out.push({
      q: `How do I buy ${cur.name}?`,
      a:
        `Open the ${cur.name} page, pick an offer by price, delivery time or rating, choose how much you need and pay at checkout. ` +
        `The seller delivers to your account and you confirm once it arrives.`,
    })
  }

  if (cur?.fromLabel) {
    out.push({
      q: `What's the cheapest way to buy ${cur.name}?`,
      a:
        `Compare sellers. The cheapest ${cur.name} on DropMarket right now starts from ${cur.fromLabel}, and every offer shows its price per unit, stock and delivery time side by side.`,
    })
  }

  if (input.items) {
    out.push({
      q: `Can I buy ${game} items with real money?`,
      a: input.items.fromLabel
        ? `Yes. DropMarket has ${num.format(input.items.count)} ${game} item ${input.items.count === 1 ? 'offer' : 'offers'} from verified sellers, from ${input.items.fromLabel}. You pay at checkout and the seller delivers in-game.`
        : `Yes. Verified sellers list ${game} items on DropMarket; you pay at checkout and the seller delivers in-game.`,
    })
  }

  if (input.accounts) {
    out.push({
      q: `Can I buy a ${game} account?`,
      a: input.accounts.fromLabel
        ? `Yes. ${game} accounts on DropMarket start from ${input.accounts.fromLabel}. Each listing says what's included and how you get access, and SafeDrop covers the order if it isn't as described.`
        : `Yes. Each ${game} account listing says what's included and how you get access, and SafeDrop covers the order if it isn't as described.`,
    })
  }

  if (input.paymentMethods.length > 0) {
    out.push({
      q: `How can I pay for ${cur ? cur.name : `${game} items`}?`,
      a: `With crypto or a local payment method: ${list(input.paymentMethods)}. Checkout shows the methods available in your country.`,
    })
  }

  out.push({
    q: `How fast is ${game} delivery?`,
    a: cur?.avgDelivery
      ? `${cur.name} offers deliver in about ${cur.avgDelivery} on average. Every listing shows the seller's own delivery time before you pay.`
      : `Every listing shows the seller's own delivery time before you pay, and most orders arrive within minutes.`,
  })

  return out
}

/** The official pack closest to 1,000 units with a USD price (the "how much is 1000 X" search). */
export function pickOfficialPack(
  packages: Array<{ amount: number; usd: number | null; where: string }> | null | undefined,
): { amount: number; usd: number; where: string } | null {
  const priced = (packages ?? []).filter((p): p is { amount: number; usd: number; where: string } => p.usd != null)
  if (priced.length === 0) return null
  return priced.reduce((best, p) => (Math.abs(p.amount - 1000) < Math.abs(best.amount - 1000) ? p : best))
}
