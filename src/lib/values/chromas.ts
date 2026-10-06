/**
 * The MM2 Chroma hub's model and maths (/[game]/chromas). Pure and
 * client-safe: the page joins the catalogue (values_items + values_prices),
 * the published events (values_events) and the researched Shop box seed
 * (lib/values/shop-boxes) into one row per Chroma, and everything the page
 * says — counts, the most expensive, the average multiple over the normal
 * version, the unbox maths — is computed here from that data. `chromas.test.ts`
 * pins each rule.
 *
 * Odds honesty (murder-mystery-2.boxes.json notes): every Shop weapon box
 * shows one "Chroma 0.004%" line. A box with ONE Chroma gives that Chroma at
 * 0.004%. The Common Egg's line is shared by its Fire pets (in-game "Chances
 * Per Item" screen), so one specific pet is 0.004% / 7. A weapon box with two
 * Chromas (Mystery Box 2) has no confirmed per-item rate: the page never
 * quotes one for it.
 */

import { MM2_ECONOMY, expectedSpins, spinsForChance } from './free-guide'
import type { ShopBox } from './shop-boxes'

/** Where a Chroma comes from. `box`/`egg` = a Shop box today; `event` = a published event. */
export type ChromaSourceKind = 'box' | 'egg' | 'event' | 'craft' | 'other'

export interface ChromaSource {
  kind: ChromaSourceKind
  /** "Knife Box 4", "Common Egg", "2023 Halloween Box", "Christmas 2025 Event"; null when unknown. */
  label: string | null
  /** The event's page slug (event Chromas). */
  eventSlug: string | null
  /**
   * Chance of THIS Chroma per spin/hatch in %, only where the data confirms
   * it (one-Chroma Shop box, or the egg's shared line split by its pets).
   */
  oddsPct: number | null
  /** Shop box with several Chromas and no confirmed per-item rate (Mystery Box 2). */
  oddsUnconfirmed: boolean
}

export interface ChromaEntry {
  slug: string
  name: string
  /** knife | gun | pet | … (values_items.item_type). */
  itemType: string | null
  imageUrl: string | null
  cheapestUsd: number | null
  marketUsd: number | null
  /** Its value page, or null when it has none (unpriced). */
  href: string | null
  /** The normal version (values_items.base_item_id), when the catalogue links one. */
  base: { slug: string; name: string; cheapestUsd: number | null; href: string | null } | null
  source: ChromaSource
}

// ── sources ─────────────────────────────────────────────────────────────────

export interface ShopChromaSource {
  kind: 'box' | 'egg'
  boxName: string
  oddsPct: number | null
  oddsUnconfirmed: boolean
}

/** Every Shop box Chroma by slug, with its own per-item rate where the data confirms one. */
export function shopChromaSources(boxes: ShopBox[]): Map<string, ShopChromaSource> {
  const out = new Map<string, ShopChromaSource>()
  for (const b of boxes) {
    const n = b.chromas.length
    for (const c of b.chromas) {
      if (!c.slug) continue
      const shared = b.kind === 'egg'
      const single = n === 1
      out.set(c.slug, {
        kind: b.kind,
        boxName: b.name,
        oddsPct: shared ? b.odds.chroma / n : single ? b.odds.chroma : null,
        oddsUnconfirmed: !shared && !single,
      })
    }
  }
  return out
}

/**
 * One Chroma's source: a Shop box first (still unboxable today), then the
 * event it came from, then crafting (Chroma Seer), else the catalogue's own
 * origin label. An event Chroma keeps the catalogue's specific label when it
 * names a box or gamepass ("2023 Halloween Box", "Sweet Gamepass").
 */
export function resolveChromaSource(
  slug: string,
  origin: string | null,
  shop: Map<string, ShopChromaSource>,
  events: Map<string, { slug: string; name: string }>,
): ChromaSource {
  const s = shop.get(slug)
  if (s) return { kind: s.kind, label: s.boxName, eventSlug: null, oddsPct: s.oddsPct, oddsUnconfirmed: s.oddsUnconfirmed }
  const e = events.get(slug)
  if (e) {
    const label = origin && /\b(box|gamepass)\b/i.test(origin) ? origin : `${e.name} Event`
    return { kind: 'event', label, eventSlug: e.slug, oddsPct: null, oddsUnconfirmed: false }
  }
  if (origin && /^craft/i.test(origin)) {
    return { kind: 'craft', label: 'Crafting Station', eventSlug: null, oddsPct: null, oddsUnconfirmed: false }
  }
  return { kind: 'other', label: origin?.trim() || null, eventSlug: null, oddsPct: null, oddsUnconfirmed: false }
}

/** The two source groups the page compares: Shop boxes (+ egg) vs events. */
export type ChromaGroup = 'box' | 'event' | 'other'
export const chromaGroup = (s: Pick<ChromaSource, 'kind'>): ChromaGroup =>
  s.kind === 'box' || s.kind === 'egg' ? 'box' : s.kind === 'event' ? 'event' : 'other'

// ── multiples ───────────────────────────────────────────────────────────────

/** How many times its normal version's price a Chroma sells for; null without both prices. */
export function chromaMultiple(e: Pick<ChromaEntry, 'cheapestUsd' | 'base'>): number | null {
  const c = e.cheapestUsd
  const b = e.base?.cheapestUsd
  if (c == null || b == null || !(c > 0) || !(b > 0)) return null
  return c / b
}

/** "×31.1" (one decimal; the page and the copy share it). */
export const fmtMultiple = (m: number) => `×${m.toFixed(1)}`

/** "31.1 times" for prose. */
export const fmtTimes = (m: number) => `${m.toFixed(1)} times`

/** The multiple bar's fill: a colour shift through Chroma blue, Ancient violet and Godly pink (rarity.ts). */
export const CHROMA_BAR = 'linear-gradient(90deg, #7AB6FF 0%, #A58BFF 55%, #FF5CC8 100%)'

/** Bar fill (0–100) for a multiple on a log scale up to `max`, so ×1.2 and ×39.9 both read. */
export function multipleBarPct(m: number, max: number): number {
  if (!(m > 1) || !(max > 1)) return 4
  return Math.max(4, Math.min(100, (Math.log(m) / Math.log(max)) * 100))
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export interface MultiplePair {
  entry: ChromaEntry
  multiple: number
}

/** Every Chroma with both prices, biggest multiple first. */
export function multiplePairs(entries: ChromaEntry[]): MultiplePair[] {
  return entries
    .map((entry) => ({ entry, multiple: chromaMultiple(entry) }))
    .filter((p): p is MultiplePair => p.multiple != null)
    .sort((a, b) => b.multiple - a.multiple || a.entry.name.localeCompare(b.entry.name))
}

/** The `n` biggest and `n` smallest multiples (no Chroma in both lists). */
export function multipleExtremes(entries: ChromaEntry[], n: number): { biggest: MultiplePair[]; smallest: MultiplePair[] } {
  const pairs = multiplePairs(entries)
  const k = Math.min(n, Math.floor(pairs.length / 2))
  return { biggest: pairs.slice(0, k), smallest: pairs.slice(pairs.length - k).reverse() }
}

export interface ChromaStats {
  count: number
  priced: number
  byType: { knife: number; gun: number; pet: number; other: number }
  mostExpensive: ChromaEntry | null
  /** Chromas with both prices. */
  pairs: number
  averageMultiple: number | null
  medianMultiple: number | null
  /** Pairs whose Chroma sells for more than its normal version. */
  pairsAbove: number
  biggest: MultiplePair | null
  smallest: MultiplePair | null
  groups: Record<ChromaGroup, { pairs: number; average: number | null }>
  /** By source: Shop box (+ egg) and event counts. */
  fromBoxes: number
  fromEvents: number
}

export function chromaStats(entries: ChromaEntry[]): ChromaStats {
  const priced = entries.filter((e) => e.cheapestUsd != null)
  const pairs = multiplePairs(entries)
  const ms = pairs.map((p) => p.multiple)
  const group = (g: ChromaGroup) => {
    const xs = pairs.filter((p) => chromaGroup(p.entry.source) === g).map((p) => p.multiple)
    return { pairs: xs.length, average: mean(xs) }
  }
  const type = (t: string) => entries.filter((e) => e.itemType === t).length
  return {
    count: entries.length,
    priced: priced.length,
    byType: {
      knife: type('knife'),
      gun: type('gun'),
      pet: type('pet'),
      other: entries.filter((e) => !['knife', 'gun', 'pet'].includes(e.itemType ?? '')).length,
    },
    mostExpensive: [...priced].sort((a, b) => b.cheapestUsd! - a.cheapestUsd!)[0] ?? null,
    pairs: pairs.length,
    averageMultiple: mean(ms),
    medianMultiple: median(ms),
    pairsAbove: ms.filter((m) => m > 1).length,
    biggest: pairs[0] ?? null,
    smallest: pairs[pairs.length - 1] ?? null,
    groups: { box: group('box'), event: group('event'), other: group('other') },
    fromBoxes: entries.filter((e) => chromaGroup(e.source) === 'box').length,
    fromEvents: entries.filter((e) => chromaGroup(e.source) === 'event').length,
  }
}

// ── unbox maths ─────────────────────────────────────────────────────────────

/**
 * What one box Chroma costs in play, on average: at `chromaPct`% a spin,
 * 1/p spins; each spin is 1,000 Coins; Coins come at `coinsPerRound` (the
 * coin bag cap, hub-config earnRate). `half` = spins for a 50% chance.
 * `eggPets` = the Fire pets sharing the Common Egg's Chroma line.
 */
export function unboxMaths(chromaPct: number, godlyPct: number, coinsPerRound: number, eggPets: number) {
  const spins = expectedSpins(chromaPct)
  const coins = spins * MM2_ECONOMY.spinCoins
  return {
    chromaPct,
    spins,
    coins,
    rounds: coins / coinsPerRound,
    coinsPerRound,
    spinCoins: MM2_ECONOMY.spinCoins,
    half: spinsForChance(chromaPct, 0.5),
    /** 0.2% Godly ÷ 0.004% Chroma = 50. */
    rarerThanGodly: godlyPct / chromaPct,
    eggPets,
    /** One specific Chroma Fire pet: the shared line split by the pets. */
    eggPetPct: eggPets > 0 ? chromaPct / eggPets : null,
    eggPetHatches: eggPets > 0 ? expectedSpins(chromaPct / eggPets) : null,
  }
}
export type UnboxMaths = ReturnType<typeof unboxMaths>

// ── grid filters + sorts (client) ───────────────────────────────────────────

export const CHROMA_FILTERS = [
  { key: 'knife', label: 'Knives' },
  { key: 'gun', label: 'Guns' },
  { key: 'pet', label: 'Pets' },
  { key: 'box', label: 'From Boxes' },
  { key: 'event', label: 'From Events' },
] as const
export type ChromaFilterKey = 'all' | (typeof CHROMA_FILTERS)[number]['key']

export function matchesChromaFilter(e: Pick<ChromaEntry, 'itemType' | 'source'>, key: ChromaFilterKey): boolean {
  if (key === 'all') return true
  if (key === 'box' || key === 'event') return chromaGroup(e.source) === key
  return e.itemType === key
}

export const CHROMA_SORTS = [
  { value: 'price', label: 'Highest Price' },
  { value: 'multiple', label: 'Biggest Multiple' },
] as const
export type ChromaSort = (typeof CHROMA_SORTS)[number]['value']

/** Highest price first, or biggest multiple first; unpriced / unpaired last, then by name. */
export function sortChromas<T extends ChromaEntry>(entries: T[], sort: ChromaSort): T[] {
  const key = (e: T) => (sort === 'multiple' ? chromaMultiple(e) : e.cheapestUsd)
  return [...entries].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    if (ka == null || kb == null) return ka == null && kb == null ? a.name.localeCompare(b.name) : ka == null ? 1 : -1
    return kb - ka || (b.cheapestUsd ?? 0) - (a.cheapestUsd ?? 0) || a.name.localeCompare(b.name)
  })
}
