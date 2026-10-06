/**
 * Every string on /[game]/boxes and /[game]/boxes/[boxSlug]. Written for
 * search first — the H1s and FAQ carry what players type ("mm2 box odds",
 * "mm2 godly chance", "knife box 4 odds", "what's in mystery box 2") — and
 * true to the data: every number comes from the box seed (lib/values/boxes),
 * the maths (lib/values/box-odds) or live prices, derived figures say "on
 * average", and nothing is a "chance to win". The FAQ + FAQPage schema reuse
 * the visible sentences. Pure; unit-tested in boxesCopy.test.ts.
 */

import { expectedDraws, fmtDraws, fmtOddsPct, medianDraws, roundingNote } from '@/lib/values/box-odds'
import { boxTier, oddsText, type BoxPrice, type BoxView, type MmBox } from '@/lib/values/boxes'
import { formatAmount } from '@/lib/values/how-to-get'

export interface CopyCtx {
  /** "Murder Mystery 2" */
  gameName: string
  /** "MM2" */
  shortName: string
}

/** The figures every current Shop weapon box shares (sharedWeaponBoxOdds) + the coin economy. */
export interface ShopOdds {
  godlyPct: number
  chromaPct: number
  /** Coins per spin (1,000). */
  spinCoins: number
  /** Full coin bag per round (40). */
  coinsPerRound: number
  /** Diamonds per Mystery Key in the Shop (125), when known. */
  keyDiamonds: number | null
}

export const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
/** "≈ $0.25" */
export const approxUsd = (n: number) => `≈ ${usd(n)}`
export const pct = (p: number) => `${fmtOddsPct(p)}%`
/** 1 in 500 / 1 in 25,000 */
export const oneIn = (p: number) => `1 in ${fmtDraws(expectedDraws(p))}`
const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

/** "A, B and C" (empty parts dropped). */
export function listPhrase(parts: string[]): string {
  const xs = parts.filter(Boolean)
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

/** "1,000 Coins, 100 Diamonds or 1 Mystery Key" */
export function priceList(prices: BoxPrice[]): string {
  const xs = prices.map((p) => formatAmount(p.amount, p.unit))
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parts(iso: string): { y: number; m: number | null; d: number | null } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m: m ? m - 1 : null, d: d || null }
}

/** "Oct 18 – Nov 21, 2025", "Dec 14, 2025 – Jan 19, 2026", "2014", or null. */
export function dateRange(from: string | null, to: string | null): string | null {
  const one = (iso: string, withYear = true) => {
    const p = parts(iso)
    if (p.m == null) return String(p.y)
    return `${MONTHS[p.m]}${p.d ? ` ${p.d}` : ''}${withYear ? `, ${p.y}` : ''}`
  }
  if (from && to) {
    const a = parts(from)
    const b = parts(to)
    return a.y === b.y && a.m != null && b.m != null ? `${one(from, false)} – ${one(to)}` : `${one(from)} – ${one(to)}`
  }
  if (from) return one(from)
  if (to) return `Until ${one(to)}`
  return null
}

/** "Oct 2025" (a box's month in the Shop). */
export function monthYear(iso: string | null): string | null {
  if (!iso) return null
  const p = parts(iso)
  return p.m == null ? String(p.y) : `${MONTHS[p.m]} ${p.y}`
}

// ── the hub ─────────────────────────────────────────────────────────────────

export const hubH1 = (c: CopyCtx) => `${c.shortName} Box Odds: Every ${c.gameName} Box, Drop Rates and What's Inside`

export const hubMetaTitle = (c: CopyCtx) => `${c.shortName} Box Odds: Godly and Chroma Drop Rates for Every Box (2026)`

export function hubMetaDescription(c: CopyCtx, o: ShopOdds, shop: number, retired: number): string {
  return (
    `Every ${c.gameName} box and egg with its real drop rates: a Godly is ${pct(o.godlyPct)} a spin (${oneIn(o.godlyPct)}), ` +
    `a Chroma ${pct(o.chromaPct)} (${oneIn(o.chromaPct)}). ${shop} boxes in the Shop now, ${retired} retired, ` +
    `with what's inside and what a spin is worth at today's prices.`
  )
}

/** The answer-first lead under the H1. */
export function hubLead(c: CopyCtx, o: ShopOdds, retired: number): { strong: string; rest: string } {
  return {
    strong: `A Godly is a ${pct(o.godlyPct)} chance per spin in every ${c.shortName} Shop box, and a Chroma is ${pct(o.chromaPct)}.`,
    rest:
      `That is ~${fmtDraws(expectedDraws(o.godlyPct))} spins for a Godly on average (50% chance by ${fmtDraws(medianDraws(o.godlyPct))}) ` +
      `and ~${fmtDraws(expectedDraws(o.chromaPct))} for a Chroma. Below: every box in the Shop with what a spin is worth today, and all ${retired} retired boxes.`,
  }
}

export const shopHeading = (c: CopyCtx) => `${c.shortName} Boxes in the Shop Now`

export function shopLead(o: ShopOdds, spinPrice: BoxPrice[] | null): string {
  return (
    `A spin costs ${spinPrice ? priceList(spinPrice) : `${fmtDraws(o.spinCoins)} Coins`} (the Common Egg takes no keys). ` +
    `Value per spin is each rarity's chance times the average price of its items today.`
  )
}

/** "1,000 Coins · 100 Diamonds" — a Shop row's price line. */
export const priceLine = (prices: BoxPrice[]) => prices.map((p) => formatAmount(p.amount, p.unit)).join(' · ')

export function bestCallout(c: CopyCtx, best: BoxView, shopCount: number): { title: string; body: string } {
  const g = best.godly
  return {
    title: `Expected Value per 1,000-Coin Spin ≈ ${usd(best.ev!.usd)}`,
    body: `${best.box.name} is the best of the ${shopCount} ${c.shortName} Shop boxes at today's prices${
      g?.cheapestUsd != null ? `; its Godly, ${g.name}, sells for ${usd(g.cheapestUsd)}` : ''
    }`,
  }
}

export const oddsHeading = (c: CopyCtx) => `How ${c.shortName} Box Odds Work`

export function oddsLead(c: CopyCtx): { strong: string; rest: string } {
  return {
    strong: 'Each rarity has one chance, split evenly between its items.',
    rest: `That is how ${c.gameName}'s in-game Chances Per Item screen shows it: a standard weapon box has 4 Commons, 3 Uncommons, 2 Rares, 1 Legendary, 1 Godly and its Chroma.`,
  }
}

/** The tier ladder of a standard Shop weapon box, one step per rarity. */
export function ladderSteps(box: MmBox): { rarity: string; title: string; value: string }[] {
  return box.tiers
    .filter((t) => t.pct != null)
    .map((t) => {
      const p = t.pct as number
      const n = t.items.length
      const each = t.perItemPct != null && n > 1 ? ` · ${pct(t.perItemPct)} each` : ''
      const rare = t.rarity === 'Godly' || t.rarity === 'Chroma'
      return {
        rarity: t.rarity,
        title: `${t.rarity} ${pct(p)}`,
        value: rare ? `~${fmtDraws(expectedDraws(p))} spins on average` : `${count(n, 'item')}${each}`,
      }
    })
}

export function roundingCallout(box: MmBox): { title: string; body: string } | null {
  const note = roundingNote(box.tiers)
  if (!note) return null
  const figures = box.tiers.filter((t) => t.rarity !== 'Chroma').map((t) => fmtOddsPct(t.pct as number))
  const chroma = boxTier(box, 'Chroma')?.pct
  return {
    title: `Why ${pct(note.total)}?`,
    body: `the game's own screen shows ${figures.join(' + ')} = ${pct(note.total)}${
      chroma != null ? `, plus ${pct(chroma)} Chroma` : ''
    }: rounded display figures, used here exactly as shown`,
  }
}

export function mysteryBox2Callout(box: MmBox): { title: string; body: string } | null {
  if (!box.splitUnconfirmed) return null
  return {
    title: box.name,
    body: `holds ${listPhrase(box.godlies.map((g) => g.name))} plus their Chromas; the ${pct(boxTier(box, 'Godly')?.pct ?? 0)} Godly line covers both, and no screenshot shows the split, so no per-item rate is given`,
  }
}

export function eggCallout(box: MmBox): { title: string; body: string } | null {
  if (box.kind !== 'egg') return null
  const g = boxTier(box, 'Godly')
  const ch = boxTier(box, 'Chroma')
  if (!g?.pct || !g.perItemPct) return null
  return {
    title: box.name,
    body: `its ${pct(g.pct)} Godly tier is split across ${g.items.length} Fire pets (${pct(g.perItemPct)} each, ~${fmtDraws(
      expectedDraws(g.perItemPct),
    )} hatches for one), and ${ch?.pct != null ? `one ${pct(ch.pct)} Chroma line covers all ${ch.items.length} Chroma Fire pets` : 'its Chroma rate is not shown'}`,
  }
}

export const retiredHeading = (c: CopyCtx, n: number) => `Retired ${c.shortName} Boxes: ${n} Event and Classic Boxes`

export const retiredLead = () =>
  'No longer in the Shop, so their items are trade-only now. Grouped by the year the event ran, newest first.'

export const classicGroupLabel = () => 'Classic Boxes, Removed by Season 1'

export function hubFaq(
  c: CopyCtx,
  o: ShopOdds,
  d: {
    best: BoxView | null
    shopCount: number
    retiredCount: number
    rounding: { total: number } | null
    egg: MmBox | null
    /** A Shop weapon box's prices (1,000 Coins, 100 Diamonds, 1 Mystery Key). */
    spinPrice: BoxPrice[] | null
  },
): { q: string; a: string }[] {
  const qa: { q: string; a: string }[] = [
    {
      q: `What are the odds of getting a Godly in ${c.shortName}?`,
      a: `${pct(o.godlyPct)} per spin in every ${c.gameName} Shop weapon box, or ${oneIn(o.godlyPct)}. That is ~${fmtDraws(
        expectedDraws(o.godlyPct),
      )} spins on average, with a 50% chance by ${fmtDraws(medianDraws(o.godlyPct))} spins.`,
    },
    {
      q: `What are the Chroma odds in ${c.shortName}?`,
      a: `${pct(o.chromaPct)} per spin, or ${oneIn(o.chromaPct)}: ~${fmtDraws(expectedDraws(o.chromaPct))} spins on average, with a 50% chance by ${fmtDraws(
        medianDraws(o.chromaPct),
      )} spins.`,
    },
    {
      q: `How much does a ${c.shortName} box spin cost?`,
      a: `${d.spinPrice ? priceList(d.spinPrice) : `${fmtDraws(o.spinCoins)} Coins`} per spin.${
        o.keyDiamonds ? ` A Mystery Key costs ${o.keyDiamonds} Diamonds in the Shop, so paying 100 Diamonds directly is cheaper.` : ''
      } At ${o.coinsPerRound} Coins a round, one spin is ${fmtDraws(o.spinCoins / o.coinsPerRound)} full-bag rounds.`,
    },
  ]
  if (d.best?.ev) {
    qa.push({
      q: `Which ${c.shortName} box is the best to spin?`,
      a: `At today's prices, ${d.best.box.name}: a 1,000-Coin spin returns ≈ ${usd(d.best.ev.usd)} of items on average, the most of the ${d.shopCount} Shop boxes.`,
    })
  }
  if (d.rounding) {
    qa.push({
      q: `Why do ${c.shortName} box odds add up to ${pct(d.rounding.total)}?`,
      a: `The in-game Chances Per Item screen shows 70% + 15% + 10% + 5% + 0.2% = ${pct(d.rounding.total)}, plus a separate Chroma line. They are the game's rounded display figures; the true weights are not published.`,
    })
  }
  if (d.egg) {
    const g = boxTier(d.egg, 'Godly')
    if (g?.pct && g.perItemPct) {
      qa.push({
        q: `What are the Common Egg odds in ${c.shortName}?`,
        a: `A Godly Fire pet is ${pct(g.pct)} per hatch, split across ${g.items.length} pets (${pct(g.perItemPct)} each). Common 70%, Uncommon 15%, Rare 10%, Legendary 5%.`,
      })
    }
  }
  qa.push({
    q: `Can you still open old ${c.shortName} event boxes?`,
    a: `No. ${d.retiredCount} boxes have left the Shop; their items are trade-only now.`,
  })
  return qa
}

// ── one box ─────────────────────────────────────────────────────────────────

export const boxH1 = (c: CopyCtx, b: Pick<MmBox, 'name' | 'kind'>) =>
  b.kind === 'egg'
    ? `${c.shortName} ${b.name}: Hatch Rates and Every Pet Inside`
    : `${c.shortName} ${b.name}: Drop Rates and Every Item Inside`

export const boxMetaTitle = (c: CopyCtx, b: Pick<MmBox, 'name' | 'kind'>) =>
  `${c.shortName} ${b.name} Odds: ${b.kind === 'egg' ? 'Hatch Rates and Pets' : 'Drop Rates, Items and Value'}`

const spin = (b: Pick<MmBox, 'kind'>) => (b.kind === 'egg' ? 'hatch' : 'spin')

export function boxSubline(c: CopyCtx, b: MmBox): string {
  return b.inShop
    ? `Every item in ${c.gameName}'s ${b.name}, its chance per ${spin(b)} and what it sells for today.`
    : `Every item ${b.name} held, its old drop rate and what it sells for today, trade-only.`
}

/** The godly phrase: "Gemstone", "Lightbringer and Darkbringer", "a Fire pet". */
function godlyName(v: BoxView): string {
  const g = v.box.godlies
  if (v.box.kind === 'egg') return 'a Godly Fire pet'
  return g.length === 1 ? g[0].name : listPhrase(g.map((x) => x.name))
}

export function boxMetaDescription(c: CopyCtx, v: BoxView, eventName: string | null): string {
  const head = boxAnswer(c, v, eventName).strong
  return v.ev
    ? `${head} A ${spin(v.box)} is worth ≈ ${usd(v.ev.usd)} at today's prices: every item, its odds and its value.`
    : `${head} Every item inside, its odds and what it sells for today.`
}

/** The answer paragraph (bold first clause = the quotable answer). */
export function boxAnswer(c: CopyCtx, v: BoxView, eventName: string | null): { strong: string; rest: string } {
  const b = v.box
  const g = boxTier(b, 'Godly')
  const ch = boxTier(b, 'Chroma')
  const price = priceList(b.prices)
  if (b.inShop && g?.pct != null) {
    const strong =
      b.kind === 'egg'
        ? `The ${b.name} hatches ${godlyName(v)} at ${pct(g.pct)} (${oneIn(g.pct)}), split across ${g.items.length} pets.`
        : b.splitUnconfirmed
          ? `${b.name} holds two Godlies, ${godlyName(v)}: together ${pct(g.pct)} a spin, ${oneIn(g.pct)}.`
          : `${b.name} gives its Godly, ${godlyName(v)}, at ${pct(g.pct)} a spin: ${oneIn(g.pct)}.`
    const chroma =
      ch?.pct != null
        ? b.kind === 'egg'
          ? ` One ${pct(ch.pct)} line covers its ${ch.items.length} Chroma Fire pets.`
          : ` ${b.chromas.length === 1 ? `Its Chroma, ${b.chromas[0].name}, is` : 'Its Chromas are'} ${pct(ch.pct)} (${oneIn(ch.pct)}).`
        : ''
    const value = v.ev ? ` At today's prices a ${spin(b)} returns ≈ ${usd(v.ev.usd)} of items on average.` : ''
    return { strong, rest: `A ${spin(b)} costs ${price}.${chroma}${value}` }
  }
  const when = dateRange(b.released, b.retired)
  const strong = `${b.name} is no longer in the ${c.shortName} Shop, so its items are trade-only now.`
  const origin = eventName ? `It came with the ${eventName} event${when ? ` (${when})` : ''}` : when ? `It was in the Shop ${when}` : 'It was an early Shop box'
  const top = v.godly
  const godlyLine =
    top && g
      ? ` Its Godly, ${top.name}, was ${g.pct != null ? `a ${pct(g.pct)} drop` : `listed at ${oddsText(g.text).toLowerCase()}`}${
          top.cheapestUsd != null ? ` and sells for ${usd(top.cheapestUsd)} today` : ''
        }.`
      : ''
  const noOdds = b.oddsUsable ? '' : ' Its old drop rates do not add up, so only its items are listed.'
  return { strong, rest: `${origin} and cost ${price} a ${spin(b)}.${godlyLine}${noOdds}` }
}

export interface Fact {
  label: string
  value: string
}

export function boxFacts(v: BoxView, coinsPerRound: number): Fact[] {
  const b = v.box
  const g = boxTier(b, 'Godly')
  const ch = boxTier(b, 'Chroma')
  const odds = (t: typeof g) => (t?.pct != null ? `${pct(t.pct)} · ${oneIn(t.pct)}` : t ? oddsText(t.text) : 'None Inside')
  if (b.inShop) {
    const coins = b.prices.find((p) => p.unit === 'Coins')
    return [
      { label: `Price Per ${b.kind === 'egg' ? 'Hatch' : 'Spin'}`, value: coins ? `${formatAmount(coins.amount, 'Coins')} · ${fmtDraws(coins.amount / coinsPerRound)} Rounds` : priceList(b.prices) },
      { label: 'Godly Chance', value: odds(g) },
      { label: 'Chroma Chance', value: odds(ch) },
      { label: `Value Per ${b.kind === 'egg' ? 'Hatch' : 'Spin'}`, value: v.ev ? approxUsd(v.ev.usd) : 'Not Priced Yet' },
    ]
  }
  return [
    { label: 'Was Sold For', value: priceList(b.prices) },
    { label: 'In the Shop', value: dateRange(b.released, b.retired) ?? 'Before Season 1' },
    { label: 'Godly Chance', value: b.oddsUsable ? odds(g) : 'Not Reliable' },
    { label: 'Items Inside', value: count(b.items.length, 'Item') },
  ]
}

export function evCallout(v: BoxView): { title: string; body: string } | null {
  if (!v.box.inShop || !v.ev) return null
  return {
    title: `≈ ${usd(v.ev.usd)} a ${spin(v.box) === 'hatch' ? 'Hatch' : 'Spin'}`,
    body: `the average value of what one ${spin(v.box)} gives: each rarity's chance times the average price of its ${
      v.ev.pricedItems === v.ev.items ? '' : 'priced '
    }items today`,
  }
}

export function retiredCallout(c: CopyCtx, v: BoxView, eventName: string | null): { title: string; body: string } | null {
  const b = v.box
  if (b.inShop) return null
  // A full date only ("Nov 21, 2025"); a bare year reads oddly after "on".
  const end = b.retired?.length === 10 ? dateRange(b.retired, null) : null
  return {
    title: 'No Longer in the Shop',
    body: `${b.name} left${eventName ? ` with the ${eventName} event` : ''}${end ? ` on ${end}` : ''}; its ${count(b.items.length, 'item')} are trade-only in ${c.shortName} now`,
  }
}

export const oddsTableHeading = (b: Pick<MmBox, 'name' | 'kind'>) => `${b.name} ${b.kind === 'egg' ? 'Hatch' : 'Drop'} Rates by Rarity`

/** The odds table's one note (most specific first). */
export function oddsTableNote(b: MmBox): { title: string; body: string } | null {
  if (!b.oddsUsable) {
    return {
      title: 'Old Figures',
      body:
        b.oddsBasis === 'none'
          ? 'no drop rates were ever published for this box, so only its items are listed'
          : "the drop rates recorded for this pre-2019 box do not add up, so they are not shown",
    }
  }
  return (
    mysteryBox2Callout(b) ??
    eggCallout(b) ??
    (b.oddsBasis === 'wiki'
      ? {
          title: 'Wiki Figures',
          body: 'the game showed no odds before Sep 1, 2026; these are the rates players recorded, and "estimate" marks a guess',
        }
      : roundingCallout(b))
  )
}

/** One table row's "Each Item" cell. */
export function eachItemCell(t: { pct: number | null; perItemPct: number | null; perItemBasis: string; items: unknown[]; text: string | null }): string {
  if (t.perItemBasis === 'unconfirmed') return 'Unconfirmed'
  if (t.perItemPct != null) return t.perItemBasis === 'shared' ? `${pct(t.perItemPct)} (Shared Line)` : pct(t.perItemPct)
  return t.pct == null ? '—' : pct(t.pct)
}

/** The tier's "Chance" cell. */
export const chanceCell = (t: { pct: number | null; text: string | null }, usable: boolean) =>
  t.pct != null ? pct(t.pct) : usable ? oddsText(t.text) : 'Not Reliable'

/** An item card's odds line. */
export function itemOddsLine(i: { pct: number | null; basis: string }, b: Pick<MmBox, 'kind' | 'oddsUsable'>): string {
  if (i.basis === 'unconfirmed') return 'Rate Unconfirmed'
  if (i.pct == null) return b.oddsUsable ? 'Odds Not Published' : 'Old Odds Unreliable'
  return `${pct(i.pct)} a ${spin(b) === 'hatch' ? 'Hatch' : 'Spin'}`
}

export const itemsHeading = (b: Pick<MmBox, 'name' | 'kind'>) =>
  `Every ${b.kind === 'egg' ? 'Pet' : 'Item'} in ${b.name} and What It's Worth`

export interface MathStep {
  icon: 'coins' | 'value' | 'godly' | 'chroma'
  title: string
  value: string
}

/** Row 1 of the Spin or Buy section (Shop boxes with a Godly figure). */
export function unboxRow(v: BoxView, coinsPerRound: number): { heading: string; steps: MathStep[]; total: { title: string; body: string } | null } | null {
  const b = v.box
  const g = boxTier(b, 'Godly')
  if (!b.inShop || g?.pct == null) return null
  const ch = boxTier(b, 'Chroma')
  const coins = b.prices.find((p) => p.unit === 'Coins')?.amount ?? null
  const draws = expectedDraws(g.pct)
  const noun = spin(b) === 'hatch' ? 'Hatches' : 'Spins'
  const steps: MathStep[] = []
  if (coins) steps.push({ icon: 'coins', title: `${fmtDraws(coins)} Coins a ${spin(b) === 'hatch' ? 'Hatch' : 'Spin'}`, value: `${fmtDraws(coins / coinsPerRound)} full-bag rounds at ${coinsPerRound} Coins` })
  if (v.ev) steps.push({ icon: 'value', title: `${approxUsd(v.ev.usd)} Back`, value: `Average item value per ${spin(b)} today` })
  steps.push({ icon: 'godly', title: `~${fmtDraws(draws)} ${noun} for a Godly`, value: `50% chance by ${fmtDraws(medianDraws(g.pct))}` })
  if (ch?.pct != null) steps.push({ icon: 'chroma', title: `~${fmtDraws(expectedDraws(ch.pct))} ${noun} for a Chroma`, value: `50% chance by ${fmtDraws(medianDraws(ch.pct))}` })
  const total = coins
    ? {
        title: `~${fmtDraws(draws)} ${noun} = ${fmtDraws(draws * coins)} Coins`,
        body: `about ${fmtDraws((draws * coins) / coinsPerRound)} full-bag rounds for one Godly, on average${
          v.ev ? `, and ≈ ${usd(draws * v.ev.usd)} of items along the way` : ''
        }`,
      }
    : null
  return { heading: `Unbox It: ~${fmtDraws(draws)} ${noun} for a Godly`, steps, total }
}

export function endedRow(c: CopyCtx, v: BoxView, eventName: string | null): { heading: string; body: string } | null {
  const b = v.box
  if (b.inShop) return null
  return {
    heading: `Unboxing Ended: ${b.name} Items Are Trade-Only`,
    body: `${b.name} left the ${c.gameName} Shop${eventName ? ` when the ${eventName} event ended` : ''}${
      b.retired && b.retired.length === 10 ? ` on ${dateRange(b.retired, null)}` : ''
    }. The only way to get its items now is a trade.`,
  }
}

export function buyRow(
  c: CopyCtx,
  v: BoxView,
): { heading: string; cta: string; steps: { icon: 'store' | 'cart' | 'bolt'; title: string; value: string }[] } | null {
  const g = v.cheapestGodly
  if (!g || g.cheapestUsd == null) return null
  const draws = v.box.inShop ? boxTier(v.box, 'Godly')?.pct : null
  return {
    heading: `Buy ${g.name} Instead: ${usd(g.cheapestUsd)}`,
    cta: `Buy ${g.name}`,
    steps: [
      {
        icon: 'store',
        title: `${g.name} From ${usd(g.cheapestUsd)}`,
        value: draws ? `Skip ~${fmtDraws(expectedDraws(draws))} ${spin(v.box)}s` : `No box to open: trade only`,
      },
      { icon: 'cart', title: 'Reputable Sellers', value: `${c.shortName} listings, ID-verified` },
      { icon: 'bolt', title: 'Get It In Minutes', value: `Delivered by in-game trade in ${c.gameName}` },
    ],
  }
}

export function boxFaq(c: CopyCtx, v: BoxView, eventName: string | null, o: ShopOdds): { q: string; a: string }[] {
  const b = v.box
  const g = boxTier(b, 'Godly')
  const ch = boxTier(b, 'Chroma')
  const answer = boxAnswer(c, v, eventName)
  const qa: { q: string; a: string }[] = [
    { q: `What are the ${b.name} odds in ${c.shortName}?`, a: `${answer.strong} ${answer.rest}` },
    {
      q: `What's inside the ${c.shortName} ${b.name}?`,
      a: `${count(b.items.length, b.kind === 'egg' ? 'pet' : 'item')}: ${b.tiers
        .map((t) => `${t.rarity} ${listPhrase(t.items.map((i) => i.name))}`)
        .join('; ')}.`,
    },
  ]
  if (b.inShop && g?.pct != null) {
    qa.push({
      q: `How many spins does it take to get a Godly from ${b.name}?`,
      a: `~${fmtDraws(expectedDraws(g.pct))} ${spin(b)}s on average at ${pct(g.pct)}, with a 50% chance by ${fmtDraws(medianDraws(g.pct))}.${
        ch?.pct != null ? ` A Chroma at ${pct(ch.pct)} takes ~${fmtDraws(expectedDraws(ch.pct))} on average.` : ''
      }`,
    })
    if (v.ev) {
      const top = v.godly
      qa.push({
        q: `Is ${b.name} worth spinning?`,
        a: `A ${spin(b)} returns ≈ ${usd(v.ev.usd)} of items on average at today's prices.${
          top?.cheapestUsd != null ? ` Its Godly, ${top.name}, sells for ${usd(top.cheapestUsd)}, so buying it skips ~${fmtDraws(expectedDraws(g.pct))} ${spin(b)}s.` : ''
        }`,
      })
    }
    if (b.prices.some((p) => p.unit === 'Mystery Key') && o.keyDiamonds) {
      qa.push({
        q: `Should I open ${b.name} with a Mystery Key or Diamonds?`,
        a: `Diamonds, if you are buying: a spin is 100 Diamonds, and a Mystery Key costs ${o.keyDiamonds} Diamonds in the Shop. A key you already own is a free spin.`,
      })
    }
  } else {
    const ended = endedRow(c, v, eventName)
    qa.push({ q: `Can you still get ${b.name} in ${c.shortName}?`, a: ended ? `No. ${ended.body}` : 'No.' })
  }
  return qa
}

export const relatedTitle = (c: CopyCtx, b: MmBox) => (b.inShop ? `More ${c.shortName} Shop Boxes` : `More Retired ${c.shortName} Boxes`)
