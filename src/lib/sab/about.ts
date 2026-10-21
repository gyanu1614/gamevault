/**
 * The Steal a Brainrot item page's "About" and snippet tail, written from the
 * brainrot's own facts (rarity, income, cost, release date, origin, How To Get
 * status) instead of one template every page shared. Pure; unit-tested.
 */
import { withArticle } from '@/lib/text/article'
import { fromOrigin, type ItemFacts } from '@/lib/values/item-facts'

export interface SabAboutInput {
  name: string
  rarity: string
  /** "$10M/s" (in-game cash per second), null when unknown. */
  income: string | null
  /** "$1B" (in-game cash), null when unknown. */
  cost: string | null
  /** The catalogue's obtainability, the fallback when there is no How To Get entry. */
  obtainability: string
  facts: ItemFacts
}

const STATUS_LINE: Record<string, string> = {
  obtainable: 'It can still be obtained in-game.',
  unobtainable: 'It can no longer be obtained in-game, so trading or buying from another player is the way to get one now.',
  seasonal: 'It only comes back with its event.',
  limited: 'It is a limited brainrot that comes and goes with events.',
}

/** The About paragraph: what it is and when it came out, what it makes and costs, where it comes from, whether you can still get it. */
export function sabAbout(i: SabAboutInput): string {
  const { facts } = i
  const redCarpet = facts.origin != null && /^red carpet$/i.test(facts.origin)
  const parts = [
    `${i.name} is ${withArticle(i.rarity)} brainrot in Steal a Brainrot${facts.released ? `, added on ${facts.released}` : ''}.`,
  ]
  const where = redCarpet ? ' on the Red Carpet' : ''
  if (i.income && i.cost) parts.push(`It makes ${i.income} and costs ${i.cost} in-game cash${where}.`)
  else if (i.income) parts.push(`It makes ${i.income}.`)
  else if (i.cost) parts.push(`It costs ${i.cost} in-game cash${where}.`)
  if (facts.origin && !redCarpet) parts.push(`It comes ${fromOrigin(facts.origin)}.`)
  const status = facts.howToGet?.status ?? i.obtainability
  if (STATUS_LINE[status]) parts.push(STATUS_LINE[status])
  parts.push('Each mutation multiplies its base income, and the mutation prices below come from real listings.')
  return parts.join(' ')
}

/**
 * The snippet after the answer sentence, the longest version that fits in
 * `room` characters (so the length trimmer never cuts it mid-clause).
 */
export function sabMetaTail(i: { rarity: string; released: string | null }, room = Infinity): string {
  const options = [
    ...(i.released ? [`${withArticle(i.rarity)} brainrot, added ${i.released}. How to get it, mutation prices and safe offers.`] : []),
    `${withArticle(i.rarity)} brainrot: how to get it, mutation prices and safe offers to buy it.`,
    `${i.rarity} brainrot: how to get it, mutation prices and safe offers.`,
    'How to get it, mutation prices and safe offers.',
  ].map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  return options.find((s) => s.length <= room) ?? options[options.length - 1]
}
