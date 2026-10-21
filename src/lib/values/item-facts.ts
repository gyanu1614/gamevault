/**
 * The facts every value item page shares, whatever its game: when the item
 * came out, where it came from, and its verified How To Get entry. Pure, so
 * the facts box, the visible FAQ and the FAQPage schema say the same thing.
 * Loaded by getItemFacts (item-facts-data.ts) from each game's item table.
 */
import type { ValueHowToGet } from './how-to-get'
import { howToGetFaqs } from './how-to-get-copy'
import type { ItemFactsGame } from './item-facts-config'

export interface ItemFacts {
  /** "2022", or "27 October 2022" when the day is known. */
  released: string | null
  /** Where it came from, as a name: "Halloween Event (2022)", "Fossil Egg", "Knife Box 2". */
  origin: string | null
  howToGet: ValueHowToGet | null
}

export const NO_FACTS: ItemFacts = { released: null, origin: null, howToGet: null }

type Faq = { q: string; a: string }

/** A release date ("2022-10-27") or year → the label pages show; null when neither is usable. */
export function releasedLabel(v: { year?: number | null; date?: string | null }): string | null {
  const m = v.date?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    if (!Number.isNaN(d.getTime()) && d.getUTCDate() === Number(m[3])) {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    }
  }
  return v.year && v.year >= 2010 && v.year <= 2100 ? String(v.year) : null
}

/** Facts-box rows, only for what is known: Released, then Origin. */
export function factRows(f: ItemFacts): Array<{ label: string; value: string }> {
  return [
    ...(f.released ? [{ label: 'Released', value: f.released }] : []),
    ...(f.origin ? [{ label: 'Origin', value: f.origin }] : []),
  ]
}

/** "from the Fossil Egg" — an origin that already starts with an article keeps it. */
const fromOrigin = (origin: string) => (/^(the|a|an)\s/i.test(origin) ? `from ${origin}` : `from the ${origin}`)
/** "on 27 October 2022" for a day, "in 2022" for a year. */
const onOrIn = (released: string) => (/^\d{4}$/.test(released) ? `in ${released}` : `on ${released}`)

/**
 * The facts' FAQ entries, worded like the searches. A verified How To Get
 * entry answers "how do you get it" (the shared MM2 wording); without one, the
 * release date and origin answer "when did it come out / where is it from".
 */
export function factFaqs(i: { name: string; game: ItemFactsGame; facts: ItemFacts; cheapestUsd: number | null }): Faq[] {
  const { name, game, facts } = i
  if (facts.howToGet) {
    return howToGetFaqs({
      name,
      gameName: game.gameName,
      shortName: game.shortName,
      h: facts.howToGet,
      cheapestUsd: i.cheapestUsd,
      earnRate: game.earnRate,
      vocab: game.vocab,
    })
  }
  const besides = 'Besides that, players get one by trading for it or buying it from another player.'
  if (facts.released) {
    return [{
      q: `When was ${name} released in ${game.shortName}?`,
      a: `${name} was released ${onOrIn(facts.released)}${facts.origin ? `, ${fromOrigin(facts.origin)}` : ''}. ${besides}`,
    }]
  }
  if (facts.origin) {
    return [{ q: `Where does ${name} come from in ${game.shortName}?`, a: `${name} comes ${fromOrigin(facts.origin)}. ${besides}` }]
  }
  return []
}

/**
 * One FAQ list per page. A base entry asking the same question as a fact is
 * dropped — the verified answer wins — and the facts take its place; with no
 * such entry they go in after the first `after` entries (the "how much is it
 * worth" answer leads).
 */
export function mergeFaqs(base: Faq[], facts: Faq[], after = 1): Faq[] {
  if (facts.length === 0) return base
  const asked = new Set(facts.map((f) => f.q.toLowerCase()))
  const replaced = base.findIndex((f) => asked.has(f.q.toLowerCase()))
  const rest = base.filter((f) => !asked.has(f.q.toLowerCase()))
  const at = replaced >= 0 ? replaced : Math.min(after, rest.length)
  return [...rest.slice(0, at), ...facts, ...rest.slice(at)]
}
