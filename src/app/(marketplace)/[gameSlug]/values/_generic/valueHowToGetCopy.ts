/**
 * Copy for the "How To Get" section of a value-list item page, built ONLY
 * from the item's verified how_to_get entry (values_items.how_to_get) and its
 * published price. Pure, so it is unit-tested and the section, the visible
 * FAQ and the FAQPage schema all say the same thing.
 *
 * Honesty rules (owner, 2026-10-05):
 *   - "unknown" never reads as obtainable: no cost, no odds, no note, only the
 *     "couldn't confirm" line and the trade/buy line;
 *   - an unobtainable item's cost is labelled as the ORIGINAL cost;
 *   - the unbox maths uses stated odds only, labelled "On average"; a wiki
 *     estimate is shown as written and never turned into a number.
 */

import {
  formatAmount,
  formatCount,
  isCrafted,
  plural,
  parseRecipe,
  unboxExpectation,
  type ValueHowToGet,
} from '@/lib/values/how-to-get'

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`)

/* ───────────────────────── Two ways (owner, 2026-10-05) ─────────────────────────
 * The section answers the search people make — "how to get <item> for free in
 * Murder Mystery 2" — with TWO ways side by side:
 *   1. The free way: the in-game route in short steps, each with its number
 *      (cost per spin, odds, spins), ending in the honest total (Coins and
 *      rounds of play). Gone / unconfirmed when it can't be done any more.
 *   2. The fast way: DropMarket → buy the item → delivered in minutes.
 * Every string is written for search: the title and the answer carry the
 * query words, and the FAQ + FAQPage schema reuse the same sentences.
 */

export type WayIcon = 'coins' | 'box' | 'spin' | 'target' | 'materials' | 'craft' | 'history' | 'store' | 'cart' | 'bolt'

export interface WayStep {
  icon: WayIcon
  title: string
  /** The number or fact for this step ("1,000 Coins per spin"). */
  value: string
}

export interface FreeWay {
  state: 'available' | 'gone' | 'unconfirmed'
  /** Chip over the panel: "Free · Takes A While". */
  tag: string
  /** Panel heading: "Unbox It For Free". */
  heading: string
  steps: WayStep[]
  /** The bottom line: what the free way really costs. */
  total: { label: string; value: string; detail: string | null } | null
  /** One line when the free way is gone / unconfirmed. */
  message: string | null
}

export interface HowToGetWays {
  /** H2 — the search phrase. */
  title: string
  /** Bold first sentence of the answer. */
  lead: string
  /** The rest of the answer. */
  body: string
  free: FreeWay
  fast: {
    heading: string
    tag: string
    steps: WayStep[]
    /** The paid way's one-line callout: "Total Cost: Around $2.17 · …". */
    total: { label: string; value: string | null; detail: string }
  }
}

const noDot = (s: string) => s.replace(/[.\s]+$/, '')
const usd = (n: number | null) =>
  n == null ? null : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** "Unboxed from Mystery Box 2 in the in-game Shop (Chroma drop)." → "Mystery Box 2" */
export function boxName(method: string): string | null {
  const m = method.match(/\bfrom (?:the )?(.+?) in the in-game Shop\b/i)
  return m ? m[1].trim() : null
}


export interface WaysInput {
  name: string
  /** "Murder Mystery 2" — titles use the full name (it's what people type). */
  gameName: string
  /** "MM2" — the second half of the search volume. */
  shortName: string
  h: ValueHowToGet
  cheapestUsd: number | null
  earnRate?: { unit: string; perRound: number } | null
}

function fastWay(name: string, gameName: string, shortName: string, price: string | null) {
  return {
    heading: 'Buy It for Cheap',
    tag: 'Fastest · Minutes',
    // The same one-line callout as the free way's total, for the paid way.
    total: {
      label: 'Total Cost',
      value: price ? `Around ${price}` : null,
      detail: 'Sold by ID-verified sellers · Safe and quick service.',
    },
    steps: [
      { icon: 'store' as const, title: 'Open DropMarket', value: `${shortName} listings for ${name}` },
      { icon: 'cart' as const, title: `Buy ${name}`, value: price ? `From ${price}, reputable sellers` : 'From reputable sellers' },
      { icon: 'bolt' as const, title: 'Get It In Minutes', value: `Delivered by in-game trade in ${gameName}` },
    ],
  }
}

export function howToGetWays(i: WaysInput): HowToGetWays {
  const { name, gameName, shortName, h } = i
  const price = usd(i.cheapestUsd)
  const fromPrice = price ? ` from ${price}` : ''
  const fast = fastWay(name, gameName, shortName, price)

  if (h.status !== 'obtainable') {
    const unconfirmed = h.status === 'unknown'
    const seasonal = h.status === 'seasonal'
    return {
      title: `How To Get ${name} in ${gameName}`,
      lead: unconfirmed
        ? `We couldn’t confirm a free way to get ${name} in ${shortName} right now.`
        : seasonal
          ? `${name} only comes back with its event in ${shortName}.`
          : `There’s no free way to get ${name} in ${shortName} anymore.`,
      body: unconfirmed
        ? `Until that’s confirmed, the sure way is to buy it from another player${fromPrice} and get it traded to you in-game.`
        : `It isn’t in the Shop or sold for Robux, so buying it from another player${fromPrice} is the way to get it now — delivered by in-game trade in minutes.`,
      free: {
        state: unconfirmed ? 'unconfirmed' : 'gone',
        tag: unconfirmed ? 'Unconfirmed' : seasonal ? 'Event Only' : 'No Longer Available',
        heading: unconfirmed ? 'Free Way: Unconfirmed' : 'The Free Way Has Ended',
        steps: unconfirmed
          ? []
          : [
              { icon: 'history', title: 'How It Was Obtained', value: noDot(h.method) },
              ...(h.costs ? [{ icon: 'coins' as const, title: 'What It Cost', value: noDot(h.costs) }] : []),
              ...(h.released ? [{ icon: 'target' as const, title: 'Released', value: h.released }] : []),
            ],
        total: null,
        message: unconfirmed
          ? `Sources disagree on whether ${name} can still be obtained in ${shortName}, so we don’t list a free way.`
          : seasonal
            ? 'It returns only during its event. Until then, buying is the way to get it.'
            : `It hasn’t returned since, and it isn’t sold for Robux.`,
      },
      fast,
    }
  }

  const e = unboxExpectation(h)
  if (e) {
    const box = boxName(h.method)
    const hatch = e.action === 'hatch'
    const verb = hatch ? 'hatch' : 'spin'
    const verbs = hatch ? 'hatches' : 'spins'
    const coins = e.totals.find((t) => /^coins?$/i.test(t.unit))
    const pay = coins ?? e.totals[0]
    const rate = i.earnRate && coins && i.earnRate.unit.toLowerCase() === 'coins' ? i.earnRate.perRound : null
    const rounds = rate ? Math.ceil(pay.total / rate) : null
    const perSpin = e.totals.map((t) => formatAmount(t.amount, t.unit)).join(', ').replace(/, ([^,]*)$/, ' or $1')
    return {
      title: `How To Get ${name} for Free in ${gameName}`,
      lead: `Yes, you can get ${name} for free in ${shortName}${box ? ` from ${box}` : ''}.`,
      body: `It’s a ${e.oddsPct}% chance per ${verb}, so expect about ${formatCount(e.spins)} ${verbs} — ${formatAmount(pay.total, pay.unit)}${rounds ? `, or about ${formatCount(rounds)} rounds of play` : ''}. Most players skip the grind and buy it${fromPrice}, delivered in minutes.`,
      free: {
        state: 'available',
        tag: 'Free · Takes A While',
        heading: 'How To Get It For Free',
        steps: [
          {
            icon: 'coins',
            title: coins ? 'Earn Coins' : `Get ${plural(pay.unit, 2)}`,
            value: coins && rate ? `Up to ${rate} Coins per round` : coins ? 'Collect Coins in every round' : `Pay in ${plural(pay.unit, 2)}`,
          },
          { icon: 'box', title: `Open ${box ?? (hatch ? 'The Egg' : 'The Box')}`, value: 'In the in-game Shop' },
          { icon: 'spin', title: hatch ? 'Hatch It' : 'Spin It', value: `${perSpin} per ${verb}` },
          { icon: 'target', title: 'Land The Drop', value: `${e.oddsPct}% per ${verb} — about ${formatCount(e.spins)} ${verbs}` },
        ],
        total: {
          label: 'Total',
          value: formatAmount(pay.total, pay.unit),
          detail: rounds
            ? `You’d have to play about ${formatCount(rounds)} rounds to get it.`
            : `About ${formatCount(e.spins)} ${verbs} on average to get it.`,
        },
        message: null,
      },
      fast,
    }
  }

  const recipe = isCrafted(h) ? parseRecipe(h.costs) : null
  if (recipe) {
    const needs = recipe.map((r) => r.label).join(' + ')
    return {
      title: `How To Get ${name} for Free in ${gameName}`,
      lead: `Yes, you can craft ${name} for free in ${shortName}.`,
      body: `Collect ${needs} and craft it at the Crafting Station — no Robux needed. Or skip the grind and buy it${fromPrice}, delivered in minutes.`,
      free: {
        state: 'available',
        tag: 'Free · Takes A While',
        heading: 'How To Get It For Free',
        steps: [
          ...recipe.map((r) => ({
            icon: 'materials' as const,
            title: `Collect ${r.label}`,
            value: r.hint ? `${r.hint.charAt(0).toUpperCase()}${r.hint.slice(1)}` : 'From salvaging weapons',
          })),
          { icon: 'craft' as const, title: 'Open The Crafting Station', value: `In ${shortName}` },
          { icon: 'target' as const, title: `Craft ${name}`, value: 'No Robux needed' },
        ],
        total: { label: 'Total', value: needs, detail: 'Crafted at the Crafting Station. No Robux needed.' },
        message: null,
      },
      fast,
    }
  }

  return {
    title: `How To Get ${name} in ${gameName}`,
    lead: `Yes, ${name} can still be obtained in ${shortName}.`,
    body: `${sentence(h.method)}${h.costs ? ` It costs ${noDot(h.costs)}.` : ''} You can also buy it${fromPrice}, delivered in minutes.`,
    free: {
      state: 'available',
      tag: 'In-Game',
      heading: 'How To Get It In-Game',
      steps: [
        { icon: 'box', title: 'How', value: noDot(h.method) },
        ...(h.costs ? [{ icon: 'coins' as const, title: 'Cost', value: noDot(h.costs) }] : []),
      ],
      total: null,
      message: null,
    },
    fast,
  }
}

/** FAQ entries (visible FAQ + FAQPage schema), worded like the searches. */
export function howToGetFaqs(i: WaysInput): { q: string; a: string }[] {
  const w = howToGetWays(i)
  const answer = `${w.lead} ${w.body}`
  const freeSteps =
    w.free.state === 'available' && w.free.steps.length
      ? ` The free way, step by step: ${w.free.steps.map((s, n) => `${n + 1}. ${s.title} (${noDot(s.value)}).`).join(' ')}`
      : ''
  const fastSteps = ` The fast way: ${w.fast.steps.map((s, n) => `${n + 1}. ${s.title}.`).join(' ')}`
  return [
    { q: `How do you get ${i.name} in ${i.shortName}?`, a: `${answer}${freeSteps}${fastSteps}` },
    { q: `Can you get ${i.name} for free in ${i.gameName}?`, a: answer },
  ]
}
