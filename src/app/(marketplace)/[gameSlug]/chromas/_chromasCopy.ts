/**
 * Every string on /[game]/chromas. Written for search first — the H1, the
 * section heads and the FAQ carry what players type ("mm2 chroma values",
 * "is a chroma worth it", "how to get a chroma in mm2", "chroma vs godly") —
 * and true to the data: every number comes from lib/values/chromas (live
 * prices, the Shop box odds, the coin rate), derived ones say "on average",
 * and the FAQ + FAQPage schema reuse the visible sentences. Pure; unit-tested
 * in chromasCopy.test.ts.
 */

import { fmtCount } from '@/lib/values/free-guide'
import {
  fmtMultiple,
  fmtTimes,
  type ChromaEntry,
  type ChromaStats,
  type MultiplePair,
  type UnboxMaths,
} from '@/lib/values/chromas'

export interface CopyCtx {
  /** "Murder Mystery 2" */
  gameName: string
  /** "MM2" */
  shortName: string
}

export const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** 0.004 → "0.004"; 0.000571… → "0.00057" (two significant figures, no exponent). */
export function fmtPct(p: number): string {
  if (p >= 0.001) return String(Number(p.toPrecision(3)))
  return p.toFixed(20).replace(/^(0\.0*[1-9]\d?).*$/, '$1').replace(/0+$/, '')
}

/** "A, B and C" (empty parts dropped). */
export function listPhrase(parts: string[]): string {
  const xs = parts.filter(Boolean)
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const pageTitle = (c: CopyCtx) => `${c.shortName} Chroma Values: Every Chroma Knife, Gun and Pet: Price and Rarity`

export const metaTitle = (c: CopyCtx) => `${c.shortName} Chroma Values: Every Chroma Price vs Normal (2026)`

export function metaDescription(c: CopyCtx, s: ChromaStats, u: UnboxMaths): string {
  const top = s.mostExpensive
  return [
    `${s.priced} ${c.gameName} Chromas priced in USD${top ? `; the most expensive is ${top.name} at ${usd(top.cheapestUsd!)}` : ''}.`,
    s.averageMultiple != null ? `A Chroma sells for ${fmtTimes(s.averageMultiple)} its normal version on average.` : '',
    `Box odds: ${fmtPct(u.chromaPct)}% (~${fmtCount(u.spins)} spins).`,
  ]
    .filter(Boolean)
    .join(' ')
}

/** The answer-first lead under the H1. */
export function lead(c: CopyCtx, s: ChromaStats, u: UnboxMaths): { strong: string; rest: string } {
  const top = s.mostExpensive
  return {
    strong: top
      ? `${s.priced} ${c.shortName} Chromas have a price today, and the most expensive is ${top.name} at ${usd(top.cheapestUsd!)}.`
      : `${s.count} ${c.shortName} Chromas, with their prices as they come in.`,
    rest: [
      s.averageMultiple != null
        ? `On average a Chroma sells for ${fmtTimes(s.averageMultiple)} the price of its normal version (${s.pairs} pairs).`
        : '',
      `From a Shop box, a Chroma is a ${fmtPct(u.chromaPct)}% roll: about ${fmtCount(u.spins)} spins on average.`,
    ]
      .filter(Boolean)
      .join(' '),
  }
}

// ── 1. the grid ────────────────────────────────────────────────────────────

export function gridHeading(c: CopyCtx, s: ChromaStats): string {
  const parts = listPhrase([
    s.byType.knife ? count(s.byType.knife, 'Knife', 'Knives') : '',
    s.byType.gun ? count(s.byType.gun, 'Gun', 'Guns') : '',
    s.byType.pet ? count(s.byType.pet, 'Pet', 'Pets') : '',
  ])
  return parts ? `Every ${c.shortName} Chroma: ${parts}` : `Every ${c.shortName} Chroma`
}

export const gridLead = () =>
  `Each card shows the Chroma's cheapest price, its normal version's price and how many times more the Chroma sells for, with the box or event it comes from.`

// ── 2. is it worth it ──────────────────────────────────────────────────────

export interface BoxBuy {
  /** Cheapest priced Shop weapon-box Chroma. */
  weapon: { name: string; usd: number } | null
  /** Cheapest priced Common Egg Chroma. */
  pet: { name: string; usd: number } | null
  /** Price range of every priced Shop box Chroma (weapons + pets). */
  range: { min: number; max: number } | null
}

export interface WorthStep {
  icon: 'coins' | 'box' | 'spin' | 'rounds' | 'weapon' | 'pet' | 'delivery'
  title: string
  value: string
}

export const worthTitle = (c: CopyCtx) => `Is a Chroma Worth It in ${c.shortName}? Unbox vs Buy`

export function worthLead(u: UnboxMaths, b: BoxBuy): { strong: string; rest: string } {
  return {
    strong: `Not by unboxing: a box Chroma takes ${fmtCount(u.spins)} spins (${fmtCount(u.coins)} Coins) on average.`,
    rest: b.range ? `The same Shop box Chromas sell for ${usd(b.range.min)} to ${usd(b.range.max)}.` : '',
  }
}

export function unboxWay(u: UnboxMaths, unconfirmedBoxes: string[]) {
  const steps: WorthStep[] = [
    { icon: 'coins', title: `${u.coinsPerRound} Coins a Round`, value: `Coin bag cap; ${fmtCount(u.spinCoins)} Coins a spin` },
    {
      icon: 'box',
      title: `${fmtPct(u.chromaPct)}% per Spin`,
      value: `${fmtCount(u.rarerThanGodly)} times rarer than the box's Godly`,
    },
    { icon: 'spin', title: `~${fmtCount(u.spins)} Spins`, value: `On average; 50% chance by ${fmtCount(u.half)}` },
    { icon: 'rounds', title: `~${fmtCount(u.rounds)} Rounds`, value: `${fmtCount(u.coins)} Coins of play` },
  ]
  const notes = [
    u.eggPetHatches != null
      ? `${u.eggPets} Fire pets share the Common Egg's ${fmtPct(u.chromaPct)}% (~${fmtCount(u.eggPetHatches)} hatches for one)`
      : '',
    unconfirmedBoxes.length ? `${listPhrase(unconfirmedBoxes)}'s rate is unconfirmed` : '',
  ].filter(Boolean)
  return {
    heading: `Unbox One: ${fmtPct(u.chromaPct)}% a Spin, ~${fmtCount(u.spins)} Spins`,
    steps,
    tip: notes.length
      ? { title: unconfirmedBoxes.length && u.eggPetHatches != null ? `Pets and ${listPhrase(unconfirmedBoxes)}` : 'Good To Know', body: notes.join('; ') }
      : null,
  }
}

export function buyWay(c: CopyCtx, u: UnboxMaths, b: BoxBuy) {
  const steps: WorthStep[] = []
  if (b.weapon) steps.push({ icon: 'weapon', title: `Weapon Chromas From ${usd(b.weapon.usd)}`, value: `${b.weapon.name}, skip ~${fmtCount(u.spins)} spins` })
  if (b.pet && u.eggPetHatches != null) {
    steps.push({ icon: 'pet', title: `Pet Chromas From ${usd(b.pet.usd)}`, value: `${b.pet.name}, skip ~${fmtCount(u.eggPetHatches)} hatches` })
  }
  steps.push({ icon: 'delivery', title: 'Delivered in Minutes', value: 'From ID-verified sellers, in a trade' })
  const from = b.range ? usd(b.range.min) : null
  return {
    heading: from ? `Or Buy One: Box Chromas From ${from}` : `Or Buy a ${c.shortName} Chroma`,
    cta: `Buy ${c.shortName} Chromas`,
    steps,
    callout: b.weapon
      ? {
          title: `~${fmtCount(u.rounds)} Rounds or ${usd(b.weapon.usd)}`,
          body: `a box Chroma on average, or ${b.weapon.name} bought from ID-verified sellers and delivered in minutes`,
        }
      : null,
  }
}

// ── 3. chroma vs normal ────────────────────────────────────────────────────

export const vsTitle = (c: CopyCtx) => `Chroma vs Normal: How Much More Is a Chroma Worth in ${c.shortName}?`

export function vsLead(s: ChromaStats): { strong: string; rest: string } | null {
  if (s.averageMultiple == null) return null
  const box = s.groups.box.average
  const event = s.groups.event.average
  return {
    strong: `A Chroma sells for ${fmtTimes(s.averageMultiple)} its normal version on average, and where it comes from matters most.`,
    rest:
      box != null && event != null
        ? `Shop box Chromas average ${fmtTimes(box)} (${s.groups.box.pairs} pairs); event Chromas average ${fmtTimes(event)} (${s.groups.event.pairs} pairs).`
        : '',
  }
}

export const biggestHeading = () => 'Biggest Chroma Multiples'
export const smallestHeading = () => 'Smallest Chroma Multiples'

export function vsCallout(s: ChromaStats): { title: string; body: string } | null {
  if (s.averageMultiple == null || s.medianMultiple == null) return null
  return {
    title: `${fmtMultiple(s.averageMultiple)} on Average`,
    body: `across ${s.pairs} Chromas with a priced normal version; the middle one is ${fmtMultiple(s.medianMultiple)}`,
  }
}

/** "$4,045.99 vs $129.93" for a pair row. */
export const pairLine = (p: MultiplePair) => `${usd(p.entry.cheapestUsd!)} vs ${usd(p.entry.base!.cheapestUsd!)}`

// ── FAQ (= FAQPage schema) ─────────────────────────────────────────────────

export function faq(
  c: CopyCtx,
  s: ChromaStats,
  u: UnboxMaths,
  b: BoxBuy,
  extra: {
    /** Priced Chromas, most expensive first (the answer names the top three). */
    byPrice: ChromaEntry[]
    topGodly: { name: string; usd: number } | null
    cheapestChroma: { name: string; usd: number } | null
  },
) {
  const out: { q: string; a: string }[] = []
  const avg = s.averageMultiple

  out.push({
    q: `What is a Chroma in ${c.shortName}?`,
    a: `A Chroma is a colour-changing version of a Godly knife, gun or pet in ${c.gameName}. It is its own item with its own price: in the Shop boxes it drops ${fmtPct(u.chromaPct)}% of the time, ${fmtCount(u.rarerThanGodly)} times rarer than the box's Godly${
      avg != null ? `, and it sells for ${fmtTimes(avg)} its normal version on average` : ''
    }.`,
  })

  const [first, second, third] = extra.byPrice
  if (first) {
    const m = first.base?.cheapestUsd ? first.cheapestUsd! / first.base.cheapestUsd : null
    const next = [second, third].filter(Boolean).map((e) => `${e!.name} (${usd(e!.cheapestUsd!)})`)
    out.push({
      q: `What is the rarest and most expensive Chroma in ${c.shortName}?`,
      a: [
        `The most expensive is ${first.name} at ${usd(first.cheapestUsd!)}${
          m != null ? `, ${fmtTimes(m)} its normal version (${usd(first.base!.cheapestUsd!)})` : ''
        }${first.source.label ? `; it came from the ${first.source.label}` : ''}.`,
        next.length ? `Next are ${listPhrase(next)}.` : '',
        u.eggPetPct != null && u.eggPetHatches != null
          ? `Among Chromas you can still unbox, a specific Chroma Fire pet is the rarest roll: the Common Egg's ${fmtPct(u.chromaPct)}% Chroma line is shared by ${u.eggPets} pets, about ${fmtPct(u.eggPetPct)}% each (~${fmtCount(u.eggPetHatches)} hatches on average).`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    })
  }

  out.push({
    q: `How do you get a Chroma in ${c.shortName}?`,
    a: [
      `Unbox one from a Shop box at ${fmtPct(u.chromaPct)}% a spin, about ${fmtCount(u.spins)} spins on average (${count(s.fromBoxes, 'Chroma comes', 'Chromas come')} from Shop boxes).`,
      s.fromEvents ? `Get one from an event: ${count(s.fromEvents, 'Chroma', 'Chromas')} came from event boxes, battle-pass tiers, gifting rewards and gamepasses.` : '',
      `Chroma Seer can also be crafted, as a rare result of the Random Painted Seer recipe.`,
      b.range ? `Or trade or buy one: Shop box Chromas sell from ${usd(b.range.min)}.` : `Or trade or buy one.`,
    ]
      .filter(Boolean)
      .join(' '),
  })

  out.push({
    q: `How many spins does it take to get a Chroma in ${c.shortName}?`,
    a: `${fmtCount(u.spins)} spins on average at ${fmtPct(u.chromaPct)}% a spin: ${fmtCount(u.coins)} Coins, about ${fmtCount(u.rounds)} full coin-bag rounds at ${u.coinsPerRound} Coins a round. After ${fmtCount(u.half)} spins you have a 50% chance.`,
  })

  if (s.pairs > 0 && s.biggest && s.smallest) {
    const all = s.pairsAbove === s.pairs
    out.push({
      q: `Are Chromas worth more than Godlies in ${c.shortName}?`,
      a: [
        `More than their own normal version, yes: ${all ? `all ${s.pairs}` : `${s.pairsAbove} of ${s.pairs}`} Chromas with a priced normal version sell for more, from ${fmtTimes(s.smallest.multiple)} (${s.smallest.entry.name}) to ${fmtTimes(s.biggest.multiple)} (${s.biggest.entry.name}).`,
        extra.cheapestChroma && extra.topGodly && extra.topGodly.usd > extra.cheapestChroma.usd
          ? `Not more than every Godly, though: ${extra.cheapestChroma.name} sells for ${usd(extra.cheapestChroma.usd)}, while the most expensive Godly, ${extra.topGodly.name}, sells for ${usd(extra.topGodly.usd)}.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    })
  }
  return out
}
