/**
 * The honest "free items" guide + codes data for a values hub game, imported
 * at BUILD time from the researched seed (scripts/values-seeds/<game>.free-items.json
 * and its README). No DB, no migration: a correction is a JSON edit + deploy,
 * and the weekly watch job (scripts/mm2-watch.mjs) says when one is due.
 *
 * Pure and client-safe. The maths only ever uses the data's own figures (box
 * odds from murder-mystery-2.boxes.json, recipes and per-round coin caps from
 * the guide), and `free-guide.test.ts` proves every derived number matches
 * what the research states — so the page can never drift from its sources.
 */

import mm2Raw from '../../../scripts/values-seeds/murder-mystery-2.free-items.json'

export interface FreeWay {
  slug: string
  title: string
  whatYouGet: string
  how: string
  costOrTime: string | null
  odds: string | null
  notes: string | null
  sources: string[]
  confidence: 'high' | 'medium' | 'low'
}

export interface ExpiredCode {
  code: string
  reward: string
  when: string
  source: string
  notes: string | null
}

export interface PromoCode {
  item: string
  how: string
  when: string
  status: string
  source: string
}

export interface CodeScam {
  title: string
  howItWorks: string
  howToSpot: string
}

export interface FreeGuide {
  gameSlug: string
  /** YYYY-MM-DD the research was last checked. */
  checkedAt: string
  ways: FreeWay[]
  codes: {
    /** The in-game Enter Code box exists (UI only — not proof a code redeems). */
    redemptionAvailable: boolean
    redemptionUiNote: string
    working: string[]
    expired: ExpiredCode[]
    promo: PromoCode[]
    whereAnnounced: string[]
    notes: string
  }
  scams: CodeScam[]
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

function parse(gameSlug: string, raw: typeof mm2Raw): FreeGuide {
  if (raw.game !== gameSlug || !/^\d{4}-\d{2}-\d{2}$/.test(raw.checked_at)) {
    throw new Error(`free-guide: bad seed for ${gameSlug}`)
  }
  return {
    gameSlug,
    checkedAt: raw.checked_at,
    ways: raw.ways.map((w) => ({
      slug: w.slug,
      title: w.title,
      whatYouGet: w.what_you_get,
      how: w.how,
      costOrTime: str(w.cost_or_time),
      odds: str(w.odds),
      notes: str(w.notes),
      sources: w.sources,
      confidence: (['high', 'medium', 'low'].includes(w.confidence) ? w.confidence : 'low') as FreeWay['confidence'],
    })),
    codes: {
      redemptionAvailable: raw.codes.redemption_available,
      redemptionUiNote: raw.codes.redemption_ui_note,
      working: raw.codes.working.map(String),
      expired: raw.codes.expired.map((c) => ({
        code: c.code,
        reward: c.reward,
        when: c.when,
        source: c.source,
        notes: str((c as { notes?: string }).notes),
      })),
      promo: raw.codes.promo_codes_not_free.map((p) => ({ ...p })),
      whereAnnounced: raw.codes.where_announced,
      notes: raw.codes.notes,
    },
    scams: raw.scams.map((s) => ({ title: s.title, howItWorks: s.how_it_works, howToSpot: s.how_to_spot })),
  }
}

const GUIDES: Record<string, FreeGuide> = {
  'murder-mystery-2': parse('murder-mystery-2', mm2Raw),
}

/** The guide for a game, or null when it has none (the route then 404s). */
export function getFreeGuide(gameSlug: string): FreeGuide | null {
  return GUIDES[gameSlug] ?? null
}

/** The research date for the sitemap's lastmod (ISO midnight UTC), or null. */
export function freeGuideLastmod(gameSlug: string): string | null {
  const g = GUIDES[gameSlug]
  return g ? `${g.checkedAt}T00:00:00Z` : null
}

export function freeWay(guide: FreeGuide, slug: string): FreeWay {
  const w = guide.ways.find((x) => x.slug === slug)
  if (!w) throw new Error(`free-guide: no way "${slug}" for ${guide.gameSlug}`)
  return w
}

// ── dates ──────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON = MONTHS.map((m) => m.slice(0, 3))

/** "2026-10-05" → "October 5, 2026" (UTC, no locale drift between server and test). */
export function formatCheckedDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

/** "2026-10-05" → "October 2026" — the month the H1 promises. */
export function checkedMonthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

/**
 * A seed date line for display: every ISO date becomes "Dec 28, 2014"; a
 * "2014-12-28/29" day range becomes "Dec 28–29, 2014". The rest of the text
 * (durations, "year not recorded") is kept as researched.
 */
export function formatCodeWhen(when: string): string {
  return when.replace(/(\d{4})-(\d{2})-(\d{2})(?:\/(\d{2}))?/g, (_m, y: string, mo: string, d: string, d2?: string) => {
    const day = Number(d)
    return `${MON[Number(mo) - 1]} ${day}${d2 ? `–${Number(d2)}` : ''}, ${y}`
  })
}

/** Newest-first sort key: the line's full ISO date, or '' (year-only / undated lines sort last). */
export function codeSortKey(when: string): string {
  return /(\d{4}-\d{2}-\d{2})/.exec(when)?.[1] ?? ''
}

/** "May 2020" for a code dated to the day; null otherwise. */
export function codeMonthYear(when: string): string | null {
  const k = codeSortKey(when)
  return k ? checkedMonthYear(k) : null
}

/** Codes newest first; undated ones keep the seed's order, after the dated. */
export function sortCodesNewestFirst<T extends { when: string }>(codes: T[]): T[] {
  return codes
    .map((c, i) => ({ c, i, k: codeSortKey(c.when) }))
    .sort((a, b) => (a.k && b.k ? b.k.localeCompare(a.k) : a.k ? -1 : b.k ? 1 : a.i - b.i))
    .map((x) => x.c)
}

/** The newest expired code (COMB4T2 for MM2), for copy. */
export function newestExpiredCode(guide: FreeGuide): ExpiredCode | null {
  return sortCodesNewestFirst(guide.codes.expired)[0] ?? null
}

// ── the maths (MM2 economy, from the guide's own figures) ──────────────────

/**
 * MM2's fixed numbers, as the guide states them (free-guide.test.ts checks
 * each against the seed's text): a Shop spin costs 1,000 Coins; a full coin
 * bag is 40 Coins a round (50 with the paid Elite pass); salvaging a weapon
 * gives 2 shards of its rarity; 12 shards craft one weapon of the next
 * rarity; Seer takes 20 Legendary shards.
 */
export const MM2_ECONOMY = {
  spinCoins: 1000,
  coinsPerRound: 40,
  eliteCoinsPerRound: 50,
  shardsPerSalvage: 2,
  shardsPerCraft: 12,
  seerLegendaryShards: 20,
} as const

/** Tier odds of a Shop box, in percent. */
export interface TierOdds {
  common: number
  uncommon: number
  rare: number
  legendary: number
  godly: number
  chroma: number
}

/** Expected draws for one hit at `pct`% a draw (geometric mean, 1/p). */
export const expectedSpins = (pct: number) => 100 / pct

/** Draws needed for a `chance` (0–1) of at least one hit at `pct`% a draw. */
export function spinsForChance(pct: number, chance: number): number {
  return Math.ceil(Math.log(1 - chance) / Math.log(1 - pct / 100))
}

/**
 * Average box spins for a Seer when every drop is salvaged and crafted up:
 * each spin yields Legendary shards directly (5% × 2) and, through the
 * 12-shards → 1 weapon → 2 shards ladder (6 : 1 per step), from every lower
 * tier. Seer = 20 Legendary shards ÷ shards per spin.
 */
export function seerSpins(o: TierOdds, e = MM2_ECONOMY): number {
  const step = e.shardsPerCraft / e.shardsPerSalvage // 6 shards of one tier = 1 shard of the next
  const per = (pct: number) => (pct / 100) * e.shardsPerSalvage
  const uncommon = per(o.uncommon) + per(o.common) / step
  const rare = per(o.rare) + uncommon / step
  const legendary = per(o.legendary) + rare / step
  return e.seerLegendaryShards / legendary
}

/** Full-bag rounds to earn `coins` (at 40 a round, or Elite's 50). */
export const roundsFor = (coins: number, elite = false) =>
  coins / (elite ? MM2_ECONOMY.eliteCoinsPerRound : MM2_ECONOMY.coinsPerRound)

/** 12,500 → "12,500"; rounded to a whole number. */
export const fmtCount = (n: number) => Math.round(n).toLocaleString('en-US')

/** Rounded to the nearest `to` (≈ figures: 1,150 not 1,151). */
export const approx = (n: number, to: number) => Math.round(n / to) * to
