/**
 * The maths behind the Box Odds pages (/[game]/boxes). Pure, game-agnostic
 * and unit-tested (box-odds.test.ts): per-item odds, expected value per
 * spin, expected and median spins, the rounding note and the percent format.
 *
 * Honesty rules, pinned by the tests:
 *  - Odds are used exactly as the source shows them. The tiers of a current
 *    MM2 box add up to 100.2% (the game's own rounded display); nothing here
 *    normalises them. `oddsTotal` reports the total, `roundingNote` says so.
 *  - A missing figure is never guessed. A tier with no stated percent makes
 *    the expected value null, and so does a tier with no priced item.
 *  - Spins are geometric-draw facts: 1 / p on average, and the median is the
 *    smallest n with at least a 50% chance of one hit (ln 0.5 / ln(1 − p),
 *    rounded up).
 */

/** Expected draws for one hit at `pct`% a draw (geometric mean, 1/p). */
export function expectedDraws(pct: number): number {
  if (!(pct > 0) || pct > 100) throw new RangeError(`expectedDraws: pct must be in (0, 100], got ${pct}`)
  return 100 / pct
}

/** Smallest number of draws with at least `chance` (0–1) of one hit at `pct`% a draw. */
export function drawsForChance(pct: number, chance: number): number {
  if (!(pct > 0) || pct > 100) throw new RangeError(`drawsForChance: pct must be in (0, 100], got ${pct}`)
  if (!(chance > 0) || !(chance < 1)) throw new RangeError(`drawsForChance: chance must be in (0, 1), got ${chance}`)
  if (pct === 100) return 1
  // The tiny epsilon keeps an exact boundary (p = 50%: 1 draw) from rounding up to 2.
  return Math.max(1, Math.ceil(Math.log(1 - chance) / Math.log(1 - pct / 100) - 1e-9))
}

/** Draws for a 50% chance of one hit: the median of the geometric draw. */
export const medianDraws = (pct: number) => drawsForChance(pct, 0.5)

/** A tier's chance split evenly across its items (the in-game "Chances Per Item" rule). */
export function perItemPct(tierPct: number | null, itemsInTier: number): number | null {
  if (tierPct == null || !(tierPct > 0) || !(itemsInTier > 0)) return null
  return tierPct / itemsInTier
}

/** One tier for the expected value: its stated chance and its items' prices (null = unpriced). */
export interface EvTier {
  pct: number | null
  prices: Array<number | null>
}

export interface ExpectedValue {
  /** USD per draw: Σ tier% × the average price of that tier's priced items. */
  usd: number
  pricedItems: number
  items: number
}

/**
 * Expected USD value of one draw: Σ (tier % / 100) × the average price of
 * the tier's priced items. Null when any tier with items has no stated
 * chance, or has items but none priced — the page then says nothing rather
 * than a partial number. Tiers without items are ignored.
 */
export function expectedValue(tiers: EvTier[]): ExpectedValue | null {
  let usd = 0
  let pricedItems = 0
  let items = 0
  let any = false
  for (const t of tiers) {
    if (t.prices.length === 0) continue
    if (t.pct == null || !(t.pct >= 0)) return null
    const priced = t.prices.filter((p): p is number => p != null && Number.isFinite(p) && p >= 0)
    if (priced.length === 0) return null
    usd += (t.pct / 100) * (priced.reduce((a, b) => a + b, 0) / priced.length)
    pricedItems += priced.length
    items += t.prices.length
    any = true
  }
  return any ? { usd, pricedItems, items } : null
}

/** Rounded to `dp` decimals without float noise (70 + 15 + 10 + 5 + 0.2 → 100.2, not 100.20000000000002). */
const round = (n: number, dp = 4) => Math.round(n * 10 ** dp) / 10 ** dp

/**
 * The sum of the stated tier chances, the separate Chroma line excluded (the
 * game lists it under Godly as its own line). Null when any tier lacks a figure.
 */
export function oddsTotal(tiers: Array<{ rarity: string; pct: number | null }>, separateLine = 'Chroma'): number | null {
  const main = tiers.filter((t) => t.rarity !== separateLine)
  if (main.length === 0 || main.some((t) => t.pct == null)) return null
  return round(main.reduce((a, t) => a + (t.pct as number), 0))
}

/** When the stated tiers do not add up to 100%: the total and how far over (or under) it is. */
export function roundingNote(
  tiers: Array<{ rarity: string; pct: number | null }>,
  separateLine = 'Chroma',
): { total: number; over: number } | null {
  const total = oddsTotal(tiers, separateLine)
  if (total == null || total === 100) return null
  return { total, over: round(total - 100) }
}

/**
 * A percent for display, without a % sign: whole and short numbers as they
 * are (70, 17.5, 23.33, 0.2, 0.004), small ones to two significant figures
 * (0.0286 → 0.029, 0.000571 → 0.00057). Never an exponent.
 */
export function fmtOddsPct(p: number): string {
  if (p >= 1) return String(round(p, 2))
  if (p >= 0.001) {
    const s = Number(p.toPrecision(2))
    // 0.2 / 0.15 / 0.004 keep their stated digits; 0.0286 → 0.029.
    return String(round(p, 4) === round(p, 3) ? round(p, 3) : s)
  }
  return p.toFixed(20).replace(/^(0\.0*[1-9]\d?).*$/, '$1').replace(/0+$/, '')
}

/** "~500" / "~25,000": a whole count with thousands commas. */
export const fmtDraws = (n: number) => Math.round(n).toLocaleString('en-US')
