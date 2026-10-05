/**
 * The verified "How To Get" facts for one value item (values_items.how_to_get,
 * loaded by `pnpm values:mm2:how-to-get`) and the plain maths the item page
 * shows from them. Pure: the parser guards what comes out of the DB, and the
 * maths only ever uses the data's own numbers (stated odds, stated per-spin
 * costs) — an estimate ("under 1% (wiki estimate)") is never turned into a
 * number.
 */

export type HowToGetStatus = 'obtainable' | 'unobtainable' | 'unknown' | 'seasonal'

export interface ValueHowToGet {
  status: HowToGetStatus
  method: string
  costs: string | null
  odds: string | null
  released: string | null
  note: string | null
  sources: string[]
  confidence: 'high' | 'medium' | 'low'
  /** YYYY-MM-DD the facts were last checked. */
  checkedAt: string
}

const STATUSES = new Set<HowToGetStatus>(['obtainable', 'unobtainable', 'unknown', 'seasonal'])
const CONFIDENCE = new Set(['high', 'medium', 'low'])

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** The stored jsonb → a typed entry, or null when it is missing or malformed (no section). */
export function parseHowToGet(raw: unknown): ValueHowToGet | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const status = r.status as HowToGetStatus
  const method = text(r.method)
  const checkedAt = text(r.checked_at)
  if (!STATUSES.has(status) || !method || !checkedAt || !/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)) return null
  const sources = Array.isArray(r.sources)
    ? r.sources.filter((s): s is string => typeof s === 'string' && /^https:\/\//.test(s))
    : []
  return {
    status,
    method,
    costs: text(r.costs),
    odds: text(r.odds),
    released: text(r.released),
    note: text(r.note),
    sources,
    confidence: (CONFIDENCE.has(r.confidence as string) ? r.confidence : 'low') as ValueHowToGet['confidence'],
    checkedAt,
  }
}

/** "0.004% per spin" → 0.004. Anything hedged (estimate, "under", "<", a range) → null. */
export function parseStatedOddsPct(odds: string | null): number | null {
  const m = odds?.trim().match(/^(\d+(?:\.\d+)?)%\s+per\s+(?:spin|hatch)$/i)
  if (!m) return null
  const pct = Number(m[1])
  return pct > 0 && pct <= 100 ? pct : null
}

export interface SpinPrice {
  amount: number
  /** Singular unit as written: "Coins", "Diamonds", "Mystery Key". */
  unit: string
}

/** "1,000 Coins, 100 Diamonds or 1 Mystery Key per spin" (or "per hatch", eggs) → three prices. Null unless every part parses. */
export function parseSpinPrices(costs: string | null): SpinPrice[] | null {
  const m = costs?.trim().match(/^(.+?)\s+per\s+(?:spin|hatch)$/i)
  if (!m) return null
  // ", " and " or " separate prices; "1,000" keeps its thousands comma.
  const parts = m[1].split(/,\s+|\s+or\s+/).map((p) => p.trim()).filter(Boolean)
  const out: SpinPrice[] = []
  for (const p of parts) {
    const pm = p.match(/^(\d{1,3}(?:,\d{3})*|\d+)\s+([A-Za-z][A-Za-z ]*)$/)
    if (!pm) return null
    out.push({ amount: Number(pm[1].replace(/,/g, '')), unit: pm[2].trim() })
  }
  return out.length ? out : null
}

export const plural = (unit: string, n: number) => (n === 1 || /s$/i.test(unit) ? unit : `${unit}s`)

export const formatCount = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })

/** "25,000,000 Coins" / "500 Mystery Keys". */
export const formatAmount = (amount: number, unit: string) => `${formatCount(amount)} ${plural(unit, amount)}`

export interface UnboxExpectation {
  /** Stated drop chance per spin, in percent. */
  oddsPct: number
  /** Expected spins (or hatches) to get one: 1 / p, rounded. */
  spins: number
  /** A box is spun, an egg is hatched (MM2 pets). */
  action: 'spin' | 'hatch'
  /** Each way to pay for those spins, first-listed first: spins × the per-spin price. */
  totals: Array<SpinPrice & { total: number }>
}

/**
 * The "Unbox It" expectation: only for an item that is obtainable now from a
 * box with stated odds and stated per-spin prices. Expected value of a
 * geometric draw — "on average", not a promise.
 */
export function unboxExpectation(h: ValueHowToGet): UnboxExpectation | null {
  if (h.status !== 'obtainable') return null
  const oddsPct = parseStatedOddsPct(h.odds)
  const prices = parseSpinPrices(h.costs)
  if (oddsPct == null || !prices) return null
  const spins = Math.round(100 / oddsPct)
  const action = /per\s+hatch$/i.test(h.odds ?? '') || /per\s+hatch$/i.test(h.costs ?? '') ? 'hatch' : 'spin'
  return { oddsPct, spins, action, totals: prices.map((p) => ({ ...p, total: p.amount * spins })) }
}

/** Crafted at the Crafting Station (MM2's Seers). */
export const isCrafted = (h: ValueHowToGet) => /^crafted\b/i.test(h.method)

export interface RecipePart {
  /** "20 Legendary Shards" */
  label: string
  /** "salvage at least 10 Legendary weapons" */
  hint: string | null
}

/** "10 Godly Shards + 10 Godly Metals per craft" → two parts; a trailing "(…)" becomes the hint. */
export function parseRecipe(costs: string | null): RecipePart[] | null {
  const body = costs?.trim().replace(/\s+per\s+craft$/i, '')
  if (!body) return null
  const parts = body.split(/\s+\+\s+/).map((p) => {
    const m = p.match(/^(.*?)\s*\(([^)]*)\)\s*$/)
    return m ? { label: m[1].trim(), hint: m[2].trim() || null } : { label: p.trim(), hint: null }
  })
  return parts.every((p) => p.label) ? parts : null
}
