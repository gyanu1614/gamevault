import { formatCash, formatIncome } from './format'

/**
 * Generate curated, data-driven FAQ Q&As for a brainrot value page. Each answer
 * is built from the item's real data (name, rarity, income, cost, prices) so
 * every page's copy is unique — good for SEO — without any external calls.
 * Returns 6 entries; questions target real search intent (how to get / buy
 * cheapest / trade / USD price / mutation worth / income).
 */
export type FaqInput = {
  name: string
  rarity: string
  obtainability: string | null
  baseIncomePerSecond: number | string | null
  ingameCost: number | string | null
  defaultPriceUsd: number | string | null
  lowUsd: number | string | null
  highUsd: number | string | null
  /** Highest-value mutation we have a price for, if any. */
  topMutation: { name: string; priceUsd: number | string | null } | null
  sampleSize: number
}

export function buildBrainrotFaq(input: FaqInput): { q: string; a: string }[] {
  const {
    name,
    rarity,
    obtainability,
    baseIncomePerSecond,
    ingameCost,
    defaultPriceUsd,
    lowUsd,
    highUsd,
    topMutation,
    sampleSize,
  } = input

  const price = formatCash(defaultPriceUsd)
  const cost = formatCash(ingameCost)
  const income = formatIncome(baseIncomePerSecond)
  const range =
    formatCash(lowUsd) && formatCash(highUsd) && formatCash(lowUsd) !== formatCash(highUsd)
      ? `${formatCash(lowUsd)} – ${formatCash(highUsd)}`
      : null
  const obtain = (obtainability ?? 'obtainable').toLowerCase()

  const faq: { q: string; a: string }[] = []

  // 1 — How to get
  faq.push({
    q: `How do you get ${name} in Steal a Brainrot?`,
    a: `${name} is a ${rarity} Brainrot that is currently ${obtain} in Steal a Brainrot${
      cost ? `, with an in-game cost of about ${cost}` : ''
    }. It earns ${income} at base income. You can also buy ${name} from verified sellers on DropMarket instead of grinding for it.`,
  })

  // 2 — Buy cheapest / where
  faq.push({
    q: `Where can I buy ${name} for the cheapest price?`,
    a: `The best place to buy ${name} safely is DropMarket, where every purchase is covered by buyer protection. ${
      price
        ? `The current cash value is around ${price}${range ? ` (typical range ${range})` : ''}.`
        : `Live listings show the current cheapest price.`
    } Compare seller offers and pick the lowest — you only pay after delivery is confirmed.`,
  })

  // 3 — Trade / how to get in SAB
  faq.push({
    q: `How do I trade for ${name} in Steal a Brainrot?`,
    a: `To trade for ${name}, offer Brainrots of similar cash value. As a ${rarity} earning ${income}, ${name} is worth roughly ${
      price ?? 'its current market estimate'
    }, so a fair trade should total around that. Check the cash value first so you don't overpay or get lowballed.`,
  })

  // 4 — USD cash price
  faq.push({
    q: `What is the ${name} price in USD cash?`,
    a: `${name} is worth ${
      price ?? 'a market-estimated amount'
    } in USD cash right now${range ? `, with a typical range of ${range}` : ''}${
      sampleSize > 0 ? `, based on ${sampleSize} recent listing${sampleSize === 1 ? '' : 's'}` : ''
    }. Prices update daily from real marketplace data.`,
  })

  // 5 — mutation worth (or rarity value)
  if (topMutation && formatCash(topMutation.priceUsd)) {
    faq.push({
      q: `How much is ${topMutation.name} ${name} worth?`,
      a: `${topMutation.name} ${name} is worth about ${formatCash(
        topMutation.priceUsd,
      )} in cash — more than the default because the ${topMutation.name} mutation raises both its income and its market value. Pick a mutation on the value page to see each one's live price.`,
    })
  } else {
    faq.push({
      q: `Is ${name} a good Brainrot to own?`,
      a: `${name} is a ${rarity} Brainrot earning ${income}, which makes it ${
        rarity.toLowerCase() === 'secret' || rarity.toLowerCase().includes('god')
          ? 'a high-tier, sought-after'
          : 'a solid mid-tier'
      } pick. Higher mutations increase its value further. Check the live cash price before buying or trading.`,
    })
  }

  // 6 — income / how much it makes
  faq.push({
    q: `How much money does ${name} make per second?`,
    a: `${name} generates ${income} at base income in Steal a Brainrot. Mutations multiply this — for example a higher mutation can raise its per-second earnings several times over. Use the mutation calculator on this page to see income and cash value for each mutation.`,
  })

  return faq
}
