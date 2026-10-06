/**
 * Every MM2 box and egg — in the Shop now and retired — from the researched
 * seed (scripts/values-seeds/murder-mystery-2.boxes.json + its README),
 * imported at build time and typed here for the Box Odds pages
 * (/[game]/boxes, /[game]/boxes/[boxSlug]). Pure and client-safe: the pages
 * join the item slugs to live prices; the maths is ./box-odds.
 *
 * What the seed says, and how it is used (README "Odds structure" and
 * "Uncertain points"):
 *  - The in-game "Chances Per Item" screen (Sep 1, 2026) shows each tier's
 *    chance split evenly across its items. A tier's per-item chance is
 *    tier % / items ('stated' where a screenshot shows that figure).
 *  - Mystery Box 2 holds two Godlies and two Chromas; the wiki shows the
 *    full tier figure next to each and no screenshot settles the split, so
 *    their per-item chance is UNCONFIRMED (null), never halved by us.
 *  - The Common Egg shows ONE "Chroma 0.004%" line for its seven Chroma Fire
 *    pets: a SHARED line (per pet = the line split evenly, as the Chroma hub
 *    and the item pages already state it).
 *  - The pre-Season 1 classic boxes' figures do not add up (or were never
 *    given): item lists only, no odds (`oddsUsable: false`).
 *  - Figures the wiki only estimates ("<1%*", "0.2%?", "???") keep their text
 *    and have no number.
 */

import mm2Boxes from '../../../scripts/values-seeds/murder-mystery-2.boxes.json'
import { expectedValue, oddsTotal, perItemPct, type ExpectedValue } from './box-odds'

export const BOX_TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Godly', 'Chroma'] as const
export type BoxTierName = (typeof BOX_TIERS)[number]

export interface BoxPrice {
  amount: number
  /** As the Shop writes it: "Coins", "Diamonds", "Mystery Key", "Candies". */
  unit: string
}

export interface BoxItem {
  name: string
  /** values_items slug; null when the catalogue has no row (2 of 639). */
  slug: string | null
  rarity: BoxTierName
  chroma: boolean
  /** knife | gun | pet */
  type: string
}

/** Why an item's per-item chance is what it is. */
export type PerItemBasis = 'stated' | 'split' | 'shared' | 'unconfirmed' | 'none'

export interface BoxTier {
  rarity: BoxTierName
  /** The tier's chance in percent; null when the source gives no exact figure. */
  pct: number | null
  /** The source's own words when there is no figure ("<1%*", "0.2%?"). */
  text: string | null
  items: BoxItem[]
  /** Each item's chance in percent (null: unconfirmed, estimate or no odds). */
  perItemPct: number | null
  perItemBasis: PerItemBasis
}

export type BoxGroup = 'shop' | 'event' | 'classic'

export interface MmBox {
  slug: string
  name: string
  kind: 'box' | 'egg'
  inShop: boolean
  group: BoxGroup
  prices: BoxPrice[]
  /** YYYY-MM-DD, or YYYY when only the year is known; null when unknown. */
  released: string | null
  /** When it left the Shop (event end); null for Shop boxes and unknowns. */
  retired: string | null
  /** The values_events slug of the event it belonged to. */
  eventSlug: string | null
  confidence: 'high' | 'medium' | 'low'
  /** The odds come from the in-game screen ('game'), the wiki only ('wiki'), or are unusable ('none'). */
  oddsBasis: 'game' | 'wiki' | 'none'
  oddsUsable: boolean
  /** Tiers in game order (Common → Chroma), only those with items. */
  tiers: BoxTier[]
  items: BoxItem[]
  godlies: BoxItem[]
  chromas: BoxItem[]
  /** Several Godlies/Chromas with no confirmed split (Mystery Box 2). */
  splitUnconfirmed: boolean
  /** One Chroma line shared by several pets (Common Egg). */
  sharedChromaLine: boolean
  /** The year group a retired box is listed under (event start year); null for Shop and classic boxes. */
  year: number | null
}

type RawBox = (typeof mm2Boxes.boxes)[number]
type RawItem = RawBox['items'][number] & { pct_per_item?: number | null }
type RawOdds = RawBox['odds_by_rarity'][number] & { pct_text?: string }

/** Boxes whose multi-item Godly/Chroma split no source confirms (README "Uncertain points" 1). */
const SPLIT_UNCONFIRMED = new Set(['mystery-box-2'])

const isTier = (r: string): r is BoxTierName => (BOX_TIERS as readonly string[]).includes(r)

function toItem(i: RawItem): BoxItem | null {
  if (!isTier(i.rarity)) return null
  return { name: i.name, slug: i.slug ?? null, rarity: i.rarity, chroma: i.chroma === true, type: i.type }
}

/** Stated tiers add up (100% before Godly/Chroma, within rounding) — else the figures are not odds. */
function tiersAddUp(odds: RawOdds[]): boolean {
  const base = odds.filter((o) => o.rarity !== 'Godly' && o.rarity !== 'Chroma')
  if (base.length === 0 || base.some((o) => typeof o.pct !== 'number')) return false
  const total = oddsTotal(base.map((o) => ({ rarity: o.rarity, pct: o.pct as number })))
  return total != null && Math.abs(total - 100) <= 0.5
}

export function toBox(b: RawBox): MmBox {
  const rawItems = b.items as RawItem[]
  const items = rawItems.map(toItem).filter((i): i is BoxItem => i !== null)
  const odds = b.odds_by_rarity as RawOdds[]
  const eventSlug = 'event' in b && typeof b.event === 'string' ? b.event : null
  const retired = 'retired' in b && typeof b.retired === 'string' ? b.retired : null
  const released = typeof b.released === 'string' ? b.released : null
  const group: BoxGroup = b.in_shop ? 'shop' : eventSlug ? 'event' : 'classic'
  const confidence = (['high', 'medium', 'low'].includes(b.confidence) ? b.confidence : 'low') as MmBox['confidence']
  // Classic (pre-Season 1) boxes: item lists only (README point 6), unless the
  // figures are a medium-confidence set that adds up (the Pet Box).
  const oddsUsable = tiersAddUp(odds) && !(group === 'classic' && confidence === 'low')
  const splitUnconfirmed = SPLIT_UNCONFIRMED.has(b.slug)
  const sharedChromaLine = b.kind === 'egg' && items.filter((i) => i.rarity === 'Chroma').length > 1

  const tiers: BoxTier[] = BOX_TIERS.flatMap((rarity) => {
    const tierItems = items.filter((i) => i.rarity === rarity)
    if (tierItems.length === 0) return []
    const o = odds.find((x) => x.rarity === rarity)
    const pct = oddsUsable && typeof o?.pct === 'number' ? o.pct : null
    const text = pct == null ? o?.pct_text?.trim() || null : null
    const stated = rawItems.find((i) => i.rarity === rarity && typeof i.pct_per_item === 'number')?.pct_per_item ?? null
    const multi = tierItems.length > 1
    let perItem: number | null = null
    let basis: PerItemBasis = 'none'
    if (pct != null) {
      if (splitUnconfirmed && multi && (rarity === 'Godly' || rarity === 'Chroma')) basis = 'unconfirmed'
      // The screen's own figure confirms the split; the exact share keeps the maths exact (0.2 / 7, not the shown 0.029).
      else if (stated != null) [perItem, basis] = [perItemPct(pct, tierItems.length), 'stated']
      else if (sharedChromaLine && rarity === 'Chroma') [perItem, basis] = [perItemPct(pct, tierItems.length), 'shared']
      else [perItem, basis] = [perItemPct(pct, tierItems.length), 'split']
    }
    return [{ rarity, pct, text, items: tierItems, perItemPct: perItem, perItemBasis: basis }]
  })

  const anyFigure = tiers.some((t) => t.pct != null)
  return {
    slug: b.slug,
    name: b.name,
    kind: b.kind === 'egg' ? 'egg' : 'box',
    inShop: b.in_shop === true,
    group,
    prices: b.price.map((p) => ({ amount: p.amount, unit: p.unit })),
    released,
    retired,
    eventSlug,
    confidence,
    oddsBasis: !anyFigure ? 'none' : confidence === 'high' ? 'game' : 'wiki',
    oddsUsable: oddsUsable && anyFigure,
    tiers,
    items,
    godlies: items.filter((i) => i.rarity === 'Godly'),
    chromas: items.filter((i) => i.rarity === 'Chroma'),
    splitUnconfirmed,
    sharedChromaLine,
    year: group === 'event' && released ? Number(released.slice(0, 4)) : null,
  }
}

/** "The Shop sells it for 125 Diamonds" → 125 (the seed's own note on the Mystery Key). */
export function keyDiamonds(note: string | null | undefined): number | null {
  const m = note?.match(/sells it for (\d+) Diamonds/i)
  return m ? Number(m[1]) : null
}

const BOXES: Record<string, { checkedAt: string; boxes: MmBox[]; keyDiamonds: number | null }> = {
  'murder-mystery-2': {
    checkedAt: mm2Boxes.checked_at,
    boxes: mm2Boxes.boxes.map(toBox),
    keyDiamonds: keyDiamonds(mm2Boxes.about.mystery_key),
  },
}

/** What one Mystery Key costs in the Shop, in Diamonds (MM2: 125). */
export const mysteryKeyDiamonds = (gameSlug: string): number | null => BOXES[gameSlug]?.keyDiamonds ?? null

/** Every box of the game, Shop first (seed order), then retired newest first, then the classic boxes. */
export function allBoxes(gameSlug: string): MmBox[] {
  const boxes = BOXES[gameSlug]?.boxes ?? []
  const shop = boxes.filter((b) => b.group === 'shop')
  const events = boxes
    .filter((b) => b.group === 'event')
    .sort((a, b) => (b.released ?? '').localeCompare(a.released ?? '') || a.name.localeCompare(b.name))
  const classic = boxes.filter((b) => b.group === 'classic')
  return [...shop, ...events, ...classic]
}

export const boxSlugs = (gameSlug: string): string[] => allBoxes(gameSlug).map((b) => b.slug)

export const getBox = (gameSlug: string, boxSlug: string): MmBox | null =>
  allBoxes(gameSlug).find((b) => b.slug === boxSlug) ?? null

/** YYYY-MM-DD the box research was last checked (the pages' sitemap floor). */
export const boxesCheckedAt = (gameSlug: string): string | null => BOXES[gameSlug]?.checkedAt ?? null

/**
 * The box an item is best linked to: a Shop box first (still unboxable), then
 * the newest retired event box, then a classic box. Null when no box holds it.
 */
export function boxForItem(gameSlug: string, itemSlug: string): MmBox | null {
  return allBoxes(gameSlug).find((b) => b.items.some((i) => i.slug === itemSlug)) ?? null
}

/** The boxes of one event (2015 Christmas had a Knife Box and a Gun Box). */
export const boxesForEvent = (gameSlug: string, eventSlug: string): MmBox[] =>
  allBoxes(gameSlug).filter((b) => b.eventSlug === eventSlug)

/** One tier by name. */
export const boxTier = (box: MmBox, rarity: BoxTierName): BoxTier | null => box.tiers.find((t) => t.rarity === rarity) ?? null

/** An item's chance per spin in this box, with the basis (see BoxTier). */
export function itemOdds(box: MmBox, item: Pick<BoxItem, 'rarity'>): { pct: number | null; basis: PerItemBasis } {
  const t = boxTier(box, item.rarity)
  return t ? { pct: t.perItemPct, basis: t.perItemBasis } : { pct: null, basis: 'none' }
}

/** The Coins price of one spin (Shop boxes: 1,000), if the box takes Coins. */
export const coinPrice = (box: MmBox): number | null => box.prices.find((p) => p.unit === 'Coins')?.amount ?? null

/** "<1%*" → "Under 1% (Wiki Estimate)": the source's own words, readable. */
export function oddsText(text: string | null): string {
  const t = text?.trim() ?? ''
  if (!t || /^(\?+|not given)$/i.test(t)) return 'Not Published'
  if (/\?$/.test(t)) return 'Unconfirmed'
  const est = /\*$/.test(t)
  const m = t.replace(/\*$/, '').match(/^([<~])?\s*(\d+(?:\.\d+)?)%/)
  if (!m) return 'Not Published'
  const lead = m[1] === '<' ? 'Under ' : m[1] === '~' ? 'About ' : est ? 'About ' : ''
  return `${lead}${m[2]}%${est ? ' (Wiki Estimate)' : ''}`
}

// ── a box joined to live prices (the pages' view) ──────────────────────────

/** What the page knows about one catalogue item (live price, art, its value page). */
export interface PricedItem {
  cheapestUsd: number | null
  marketUsd: number | null
  imageUrl: string | null
  /** Its value page, or null when it has none. */
  href: string | null
}

export interface BoxItemView extends BoxItem, PricedItem {
  /** This item's chance per spin in this box (null: unconfirmed / estimate / no odds). */
  pct: number | null
  basis: PerItemBasis
}

export interface BoxView {
  box: MmBox
  /** Rarest first (Chroma → Common), seed order inside a tier. */
  items: BoxItemView[]
  /** Expected USD value of one spin at today's cheapest prices; null when a figure is missing. */
  ev: ExpectedValue | null
  /** The priciest Godly (the box's headline item), else the first one. */
  godly: BoxItemView | null
  /** The cheapest priced Godly: the "Buy It Instead" target. */
  cheapestGodly: BoxItemView | null
  /** The priciest Chroma, else the first one. */
  chroma: BoxItemView | null
  /** The headline art: the Godly's, else the priciest item's. */
  art: string | null
}

const NO_PRICE: PricedItem = { cheapestUsd: null, marketUsd: null, imageUrl: null, href: null }
const byPriceDesc = (a: BoxItemView, b: BoxItemView) => (b.cheapestUsd ?? -1) - (a.cheapestUsd ?? -1)

export function boxView(box: MmBox, lookup: (slug: string) => PricedItem | null): BoxView {
  const view = (t: BoxTier) =>
    t.items.map((i): BoxItemView => ({ ...i, ...((i.slug && lookup(i.slug)) || NO_PRICE), pct: t.perItemPct, basis: t.perItemBasis }))
  const byTier = box.tiers.map((t) => ({ t, items: view(t) }))
  const items = [...byTier].reverse().flatMap((x) => x.items)
  const ev = box.oddsUsable ? expectedValue(byTier.map(({ t, items }) => ({ pct: t.pct, prices: items.map((i) => i.cheapestUsd) }))) : null
  const godlies = items.filter((i) => i.rarity === 'Godly')
  const chromas = items.filter((i) => i.rarity === 'Chroma')
  const pricedGodlies = godlies.filter((g) => g.cheapestUsd != null)
  const godly = [...godlies].sort(byPriceDesc)[0] ?? null
  return {
    box,
    items,
    ev,
    godly,
    cheapestGodly: [...pricedGodlies].sort((a, b) => a.cheapestUsd! - b.cheapestUsd!)[0] ?? null,
    chroma: [...chromas].sort(byPriceDesc)[0] ?? null,
    art: godly?.imageUrl ?? [...items].sort(byPriceDesc).find((i) => i.imageUrl)?.imageUrl ?? null,
  }
}

/** The Shop box with the highest expected value per 1,000-Coin spin (ties: seed order). */
export function bestCoinBox(views: BoxView[]): BoxView | null {
  let best: BoxView | null = null
  for (const v of views) {
    if (!v.box.inShop || coinPrice(v.box) !== 1000 || v.ev == null) continue
    if (!best || v.ev.usd > best.ev!.usd) best = v
  }
  return best
}
