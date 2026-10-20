/**
 * The FAQ of a generic values-pipeline item page (Steal an Egg: eggs, areas,
 * pets, account brackets), written only from what the catalogue and the
 * listings say: the price (or that it isn't sold on its own), the egg it
 * hatches from, the pets an egg hatches, the eggs an area has, its income.
 * Pure; the visible FAQ and the FAQPage schema use the same list.
 */
import type { ValueItem } from '@/lib/values/data'

type Faq = { q: string; a: string }

const usd = (v: number) => (v < 1 ? `$${v.toFixed(2)}` : v.toLocaleString('en-US', { style: 'currency', currency: 'USD' }))
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

export function valueItemFaq(i: {
  item: ValueItem
  gameName: string
  /** Every item of the game (the page's own read). */
  items: ValueItem[]
  /** "6.9B/s", already formatted; null when unknown. */
  income: string | null
}): Faq[] {
  const { item, gameName, items } = i
  const out: Faq[] = []
  const price = item.price
  const source = item.sourceItemId ? items.find((x) => x.id === item.sourceItemId) ?? null : null

  if (price?.cheapestUsd != null) {
    out.push({
      q: `How much is ${item.name} worth in ${gameName}?`,
      a: `${item.name} sells for about ${usd(price.cheapestUsd)}, the cheapest of ${price.sampleSize ?? 0} live listings we track${price.averageUsd != null && usd(price.averageUsd) !== usd(price.cheapestUsd) ? `; the typical price is ${usd(price.averageUsd)}` : ''}.`,
    })
  } else if (source) {
    const sp = source.price?.cheapestUsd
    out.push({
      q: `How much is ${item.name} worth in ${gameName}?`,
      a: `${item.name} isn't sold on its own: the market sells eggs, and ${item.name} hatches from the ${source.name}.${sp != null ? ` The ${source.name} sells for about ${usd(sp)}.` : ''}`,
    })
  }

  if (source) {
    out.push({
      q: `How do you get ${item.name} in ${gameName}?`,
      a: `${item.name} hatches from the ${source.name}${source.area ?? item.area ? `, found in the ${source.area ?? item.area} area` : ''}. Hatch one yourself, or buy the egg from another player and hatch it.`,
    })
  }

  if (item.kind === 'egg') {
    const pets = items.filter((x) => x.sourceItemId === item.id).map((x) => x.name)
    if (pets.length) out.push({ q: `What hatches from the ${item.name}?`, a: `The ${item.name} hatches ${list(pets.slice(0, 8))}${pets.length > 8 ? `, and ${pets.length - 8} more` : ''}.` })
  }

  if (item.kind === 'area') {
    const eggs = items.filter((x) => x.kind === 'egg' && x.area === item.name).map((x) => x.name)
    const pets = items.filter((x) => x.kind === 'pet' && x.area === item.name).map((x) => x.name)
    if (eggs.length) out.push({ q: `Which eggs are in the ${item.name} area?`, a: `The ${item.name} area has ${list(eggs.slice(0, 8))}${eggs.length > 8 ? `, and ${eggs.length - 8} more` : ''}.` })
    if (pets.length) out.push({ q: `Which pets come from the ${item.name} area?`, a: `Pets from the ${item.name} area include ${list(pets.slice(0, 8))}${pets.length > 8 ? `, and ${pets.length - 8} more` : ''}.` })
  }

  if (i.income && item.kind !== 'account_bracket') {
    out.push({ q: `How much money does ${item.name} make in ${gameName}?`, a: `${item.name} makes ${i.income} in income.` })
  }
  return out
}
