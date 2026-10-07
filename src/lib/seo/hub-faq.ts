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
    /** Cheapest live price, and how many units it buys (per-unit currencies only). */
    lowPrice?: number | null
    unitsPerPrice?: number | null
  } | null
  items: { fromLabel: string | null; count: number } | null
  accounts: { fromLabel: string | null; count: number } | null
  /** Checkout's methods, in display order ("USDT", "Bitcoin", "Pix", …). */
  paymentMethods: string[]
  /** Hand-written questions for this game (guide `page.hub_faq`), after the price ones. */
  extra?: HubFaqItem[]
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

  // What the official pack costs here, and the saving: the comparison players
  // search for ("how much is 1000 robux in usd"), done for them.
  const here =
    cur?.official && cur.lowPrice != null && cur.lowPrice > 0 && cur.unitsPerPrice
      ? Math.ceil((cur.official.amount / cur.unitsPerPrice) * cur.lowPrice * 100) / 100
      : null
  const savePct = cur?.official && here != null ? Math.round((1 - here / cur.official.usd) * 100) : null
  const saves = here != null && savePct != null && savePct >= 5
  const pack = cur?.official ? `${num.format(cur.official.amount)} ${cur.name}` : ''
  const cheaper = savePct != null && savePct >= 45 && savePct < 55 ? 'almost half price' : `about ${savePct}% less`

  // Owner, 2026-10-06: a talking tone, like a friend explaining it. Answers
  // never open with the brand; the facts and numbers carry them.
  if (cur?.official) {
    const o = cur.official
    const where = o.where.replace(/\s*\([^)]*\)\s*$/, '')
    out.push({
      q: `How much is ${pack} in USD?`,
      a: saves
        ? `${pack} costs ${usd(o.usd)} on ${where}, the official store. Sellers on DropMarket start from ${cur.fromLabel}, so the same ${pack} costs you about ${usd(here!)}. That's a saving of about ${savePct}%.`
        : `${pack} costs ${usd(o.usd)} on ${where}, the official store. Sellers here set their own prices, so check the ${cur.name} page for today's cheapest offer.`,
    })
  }

  out.push({
    q: cur ? `Is it safe to buy ${cur.name}?` : `Is it safe to buy ${game} items?`,
    a: `Yes, it is. Every order is covered, and every seller passes an ID check before they can sell, so you're buying from verified traders. If a seller doesn't deliver, you get a 100% refund.`,
  })

  if (cur) {
    out.push({
      q: `How do I buy ${cur.name}?`,
      a: `Pick the offer or seller you like, pay at checkout with the method that suits you, and wait for the seller to deliver. You can chat with them if you need anything. That's it: ${cur.name} on your account, fully covered.`,
    })
  }

  if (cur?.fromLabel) {
    out.push({
      q: `What's the cheapest way to buy ${cur.name}?`,
      a: saves
        ? `${pack} usually costs ${usd(cur.official!.usd)} on the official store. Our sellers sell the same amount for about ${usd(here!)}, ${cheaper}, which is about as cheap as ${cur.name} gets.`
        : `Compare sellers. ${cur.name} here starts from ${cur.fromLabel}, and every offer shows its price, stock and delivery time side by side.`,
    })
  }

  for (const f of input.extra ?? []) out.push(f)

  if (input.items) {
    const n = input.items.count
    out.push({
      q: `Can I buy ${game} items with real money?`,
      a: input.items.fromLabel
        ? `Yes. There ${n === 1 ? 'is' : 'are'} ${num.format(n)} ${game} item ${n === 1 ? 'offer' : 'offers'} from verified sellers right now, starting at ${input.items.fromLabel}. Pay at checkout and the seller sends it to you in-game.`
        : `Yes. Verified sellers list ${game} items here. Pay at checkout and the seller sends it to you in-game.`,
    })
  }

  if (input.accounts) {
    out.push({
      q: `Can I buy a ${game} account?`,
      a: input.accounts.fromLabel
        ? `Yes. ${game} accounts start at ${input.accounts.fromLabel}. Every listing tells you what's included and how you'll get access, and you're covered if it isn't as described.`
        : `Yes. Every ${game} account listing tells you what's included and how you'll get access, and you're covered if it isn't as described.`,
    })
  }

  if (input.paymentMethods.length > 0) {
    const shown = input.paymentMethods.slice(0, 7)
    out.push({
      q: `How can I pay for ${cur ? cur.name : `${game} items`}?`,
      a: `However suits you: crypto or a local method like ${list(shown)}. Checkout shows everything that works in your country.`,
    })
  }

  out.push({
    q: `How fast is ${game} delivery?`,
    a: cur?.avgDelivery
      ? `${cur.name} offers usually arrive in about ${cur.avgDelivery}. Every listing shows the seller's own delivery time, so you know before you pay.`
      : `Most orders arrive within minutes. Every listing shows the seller's own delivery time, so you know before you pay.`,
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
