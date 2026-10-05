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
  type HowToGetStatus,
  type ValueHowToGet,
} from '@/lib/values/how-to-get'

/** Wiki text is CC BY-SA; the credit goes next to the source link. */
export const WIKI_LICENSE = 'CC BY-SA 3.0'

export interface StatusMeta {
  label: string
  /** Tailwind background for the status dot — the only colour in the pill. */
  dot: string
}

export function howToGetStatusMeta(status: HowToGetStatus): StatusMeta {
  switch (status) {
    case 'obtainable':
      return { label: 'Obtainable Now', dot: 'bg-success' }
    case 'unobtainable':
      return { label: 'No Longer Obtainable', dot: 'bg-text-tertiary' }
    case 'seasonal':
      return { label: 'Returns Seasonally', dot: 'bg-info' }
    default:
      return { label: 'Unconfirmed', dot: 'bg-warning' }
  }
}

/**
 * The short muted line under the steps. Never on an unconfirmed item (its
 * note is a research memo). On an unobtainable item the data's closing
 * "trading or buying is the only way now" is dropped: the answer above says
 * exactly that, so the card doesn't say it twice.
 */
export function howToGetNote(h: ValueHowToGet): string | null {
  if (h.status === 'unknown' || !h.note) return null
  if (h.status !== 'unobtainable') return h.note
  const note = h.note
    .replace(/;\s*trading or buying is the only way( to get it)? now\.$/i, '.')
    .replace(/\s*Trading or buying is the only way( to get it)? now\.$/, '')
    .trim()
  return note || null
}

export interface SourceGroup {
  /** "Murder Mystery 2 Wiki" */
  label: string
  /** "CC BY-SA 3.0" for a wiki. */
  license: string | null
  links: Array<{ title: string; href: string }>
}

const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** Sources grouped by site, in first-seen order: wiki pages by title, the Roblox API as one link. */
export function howToGetSources(h: ValueHowToGet): SourceGroup[] {
  const groups = new Map<string, SourceGroup>()
  for (const href of h.sources) {
    let url: URL
    try {
      url = new URL(href)
    } catch {
      continue
    }
    const fandom = url.hostname.match(/^([a-z0-9-]+)\.fandom\.com$/)
    let key: string
    let group: Omit<SourceGroup, 'links'>
    let title: string
    if (fandom) {
      key = url.hostname
      group = { label: `${titleCase(fandom[1])} Wiki`, license: WIKI_LICENSE }
      const page = url.pathname.replace(/^\/wiki\//, '')
      title = decodeURIComponent(page).replace(/_/g, ' ') || group.label
    } else if (/(^|\.)roblox\.com$/.test(url.hostname)) {
      key = 'roblox'
      group = { label: 'Roblox', license: null }
      title = /game-passes/.test(url.pathname) ? 'Game Pass Listing' : 'Roblox'
    } else {
      key = url.hostname
      group = { label: url.hostname.replace(/^www\./, ''), license: null }
      title = url.hostname.replace(/^www\./, '')
    }
    const g = groups.get(key) ?? { ...group, links: [] }
    if (!g.links.some((l) => l.href === href)) g.links.push({ title, href })
    groups.set(key, g)
  }
  return [...groups.values()]
}

/** "Checked Oct 5, 2026" */
export function checkedLabel(h: ValueHowToGet): string {
  const d = new Date(`${h.checkedAt}T00:00:00Z`)
  return `Checked ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
}

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`)

/* ───────────────────────── The guide (owner, 2026-10-05) ─────────────────────────
 * One card that reads like a short guide, not a data table: a direct answer
 * (Yes / No / Unconfirmed, and whether it can be had FREE — what players
 * search), then numbered steps, then one "or buy it" line. The same answer
 * feeds the FAQ + FAQPage schema, so the page and Google say the same thing.
 */

export interface GuideStep {
  title: string
  body: string
}

export interface HowToGetGuide {
  /** "Yes, you can get it free." — the answer's first, bold clause. */
  lead: string
  /** The rest of the answer paragraph. */
  body: string
  /** Numbered steps (empty when there is nothing honest to list). */
  steps: GuideStep[]
  /** "Originally: …" / "Released …" — the item's history, one muted line. */
  history: string | null
  /** Label over the price in the closing bar: "Or skip the grind" / "Buy it now". */
  buyLabel: string
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const noDot = (s: string) => s.replace(/[.\s]+$/, '')
const usd = (n: number | null) =>
  n == null ? null : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** "Unboxed from Mystery Box 2 in the in-game Shop (Chroma drop)." → "Mystery Box 2" */
export function boxName(method: string): string | null {
  const m = method.match(/\bfrom (?:the )?(.+?) in the in-game Shop\b/i)
  return m ? m[1].trim() : null
}

function historyLine(h: ValueHowToGet, past: boolean): string | null {
  const parts: string[] = []
  if (past) parts.push(`Originally: ${noDot(h.method)}${h.costs ? ` (${noDot(h.costs)})` : ''}`)
  if (h.released) parts.push(`Released ${h.released}`)
  return parts.length ? `${parts.join(' · ')}.` : null
}

const TRADE_STEPS = (name: string, price: string | null): GuideStep[] => [
  { title: 'Check What It’s Worth', body: 'Use the prices on this page so you know what a fair deal looks like.' },
  {
    title: 'Buy Or Trade For It',
    body: `Buy it from a reputable seller${price ? ` (from ${price})` : ''}, or trade for it with another player.`,
  },
  { title: 'Get It In-Game', body: `The seller sends ${name} to you through an in-game trade.` },
]

export function howToGetGuide(opts: {
  name: string
  shortName: string
  h: ValueHowToGet
  cheapestUsd: number | null
}): HowToGetGuide {
  const { name, shortName, h } = opts
  const price = usd(opts.cheapestUsd)
  const fromPrice = price ? `, from ${price}` : ''

  if (h.status === 'unobtainable') {
    return {
      lead: `No, ${name} can’t be obtained in ${shortName} anymore.`,
      body: `There’s no free way to get it now, and it isn’t sold for Robux either. Trading or buying from another player is the only way${fromPrice}.`,
      steps: TRADE_STEPS(name, price),
      history: historyLine(h, true),
      buyLabel: 'Buy It Now',
    }
  }
  if (h.status === 'unknown') {
    return {
      lead: `Unconfirmed: we couldn’t verify whether ${name} can still be obtained in ${shortName}.`,
      body: `Until that’s confirmed, trading or buying is the sure way to get it${fromPrice}.`,
      steps: TRADE_STEPS(name, price),
      history: historyLine(h, true),
      buyLabel: 'Buy It Now',
    }
  }
  if (h.status === 'seasonal') {
    return {
      lead: `Only during its event: ${name} comes back with its event in ${shortName}.`,
      body: `Until then, trading or buying is the way to get it${fromPrice}.`,
      steps: TRADE_STEPS(name, price),
      history: historyLine(h, true),
      buyLabel: 'Buy It Now',
    }
  }

  // Obtainable now.
  const e = unboxExpectation(h)
  if (e) {
    const coins = e.totals.find((t) => /^coins?$/i.test(t.unit))
    const box = boxName(h.method)
    const first = e.totals[0]
    const perSpin = e.totals.map((t) => formatAmount(t.amount, t.unit)).join(', ')
    const others = e.totals.filter((t) => t !== (coins ?? first)).map((t) => plural(t.unit, 2))
    // A box is spun, an egg (pets) is hatched — the steps use the game's word.
    const hatch = e.action === 'hatch'
    const verb = hatch ? 'hatch' : 'spin'
    const verbs = hatch ? 'hatches' : 'spins'
    const where = box ?? (hatch ? 'an egg in the in-game Shop' : 'a box in the in-game Shop')
    return {
      lead: coins
        ? `Yes, you can get ${name} for free in ${shortName}.`
        : `Yes, ${name} can still be obtained in ${shortName}.`,
      body: `It ${hatch ? 'hatches' : 'drops'} from ${where}${coins ? `, and you can ${verb} ${hatch ? 'it' : 'it'} with Coins you earn by playing` : ''}. It’s a ${e.oddsPct}% chance, so it takes about ${formatCount(e.spins)} ${verbs} (${formatAmount((coins ?? first).total, (coins ?? first).unit)}) on average. That’s why most players buy or trade for it instead${fromPrice}.`,
      steps: [
        {
          title: coins ? 'Earn Coins' : `Get ${plural(first.unit, 2)}`,
          body: coins
            ? `Play rounds to earn Coins.${others.length ? ` ${others.join(' or ')} work too.` : ''}`
            : `Each ${verb} is paid with ${plural(first.unit, 2)}.`,
        },
        { title: `Open ${box ?? (hatch ? 'The Egg' : 'The Box')}`, body: `Find ${box ?? (hatch ? 'the egg' : 'the box')} in the in-game Shop.` },
        { title: hatch ? 'Hatch It' : 'Spin It', body: `Each ${verb} costs ${perSpin.replace(/, ([^,]*)$/, ' or $1')}.` },
        {
          title: hatch ? 'Keep Hatching' : 'Keep Spinning',
          body: `At ${e.oddsPct}% per ${verb}, expect about ${formatCount(e.spins)} ${verbs} on average — luck can make it far more or far fewer.`,
        },
      ],
      history: historyLine(h, false),
      buyLabel: 'Or Skip The Grind',
    }
  }

  const recipe = isCrafted(h) ? parseRecipe(h.costs) : null
  if (recipe) {
    const needs = recipe.map((r) => r.label).join(' + ')
    return {
      lead: `Yes, you can craft ${name} for free in ${shortName}.`,
      body: `It’s made at the Crafting Station from ${needs} — no Robux needed. Buying one is the shortcut${fromPrice}.`,
      steps: [
        ...recipe.map((r) => ({
          title: `Collect ${r.label}`,
          body: r.hint ? `${r.hint.charAt(0).toUpperCase()}${r.hint.slice(1)}.` : `You need ${r.label}.`,
        })),
        { title: 'Open The Crafting Station', body: 'Use the Crafting Station in MM2.' },
        { title: `Craft ${name}`, body: sentence(h.method) },
      ],
      history: historyLine(h, false),
      buyLabel: 'Or Skip The Grind',
    }
  }

  return {
    lead: `Yes, ${name} can still be obtained in ${shortName}.`,
    body: `${sentence(h.method)}${h.costs ? ` It costs ${noDot(h.costs)}.` : ''} You can also buy or trade for it${fromPrice}.`,
    steps: [],
    history: historyLine(h, false),
    buyLabel: 'Or Buy It Now',
  }
}

/** The FAQ entries (visible FAQ + FAQPage schema), worded like the searches. */
export function howToGetFaqs(opts: {
  name: string
  shortName: string
  h: ValueHowToGet
  cheapestUsd: number | null
}): { q: string; a: string }[] {
  const g = howToGetGuide(opts)
  const answer = `${g.lead} ${g.body}`
  const steps = g.steps.length
    ? ` Step by step: ${g.steps.map((s, i) => `${i + 1}. ${noDot(s.title)} — ${noDot(s.body)}.`).join(' ')}`
    : ''
  return [
    { q: `How do you get ${opts.name} in ${opts.shortName}?`, a: `${answer}${steps}` },
    { q: `Can you get ${opts.name} for free in ${opts.shortName}?`, a: answer },
  ]
}
