/**
 * Eldorado RMT demand signal — names only.
 *
 * Eldorado publishes its per-game seller fees on a public help-centre page.
 * A game appearing there means Eldorado opened a category for it, which is
 * the clearest public sign of real-money demand. We fetch the page weekly,
 * diff the game names against the previous snapshot, and store the new ones
 * as `rmt_chart` trend events. No offer/listing scraping anywhere.
 *
 * Verified live 2026-09-18: `https://www.eldorado.gg/sell` links to
 * `support.eldorado.gg/en/articles/8409025-fees`, which 301s to the URL
 * below. Six <table>s: a summary, then one per section whose first row is
 * `[<Section>, 'Sales Fee']` — Currency / Top Up / Items / Accounts / Boosting
 * — followed by `[<name>, '<fee>']` rows (209 rows, 183 distinct names).
 */
import { decideMatch, normalizeTitle } from '@/lib/games/icons'

export const ELDORADO_FEES_URL = 'https://support.eldorado.gg/en/articles/8409025-seller-fees'

export type FeeSection = 'currency' | 'top_up' | 'items' | 'accounts' | 'boosting' | 'other'

export interface FeeRow {
  section: FeeSection
  /** Name exactly as the page prints it, e.g. "Grow a Garden Sheckles". */
  rawName: string
  /** The game the row is about, unit suffix removed. */
  gameName: string
  /** "15%" — arrows, emoji and dated notes removed. */
  fee: string
}

// ── pure: HTML → rows ──────────────────────────────────────────────────────

const SECTION_BY_HEADER: Record<string, FeeSection> = {
  currency: 'currency',
  'top up': 'top_up',
  items: 'items',
  accounts: 'accounts',
  boosting: 'boosting',
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
}

function cellText(cellHtml: string): string {
  return decodeEntities(cellHtml.replace(/<[^>]+>/g, ' '))
    .replace(/[​‌‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normaliseFee(raw: string): string {
  const m = raw.match(/(\d+(?:\.\d+)?)\s*%/)
  return m ? `${m[1]}%` : raw.replace(/[^\d.%]/g, '')
}

/**
 * Currency / top-up rows are "<game> <unit>"; accounts rows can be
 * "<game> Accounts". Strip a trailing unit only — "Gold Rush Tycoon" keeps
 * its Gold.
 */
const UNIT_WORDS = [
  'gold', 'coins', 'coin', 'gems', 'diamonds', 'tokens', 'sheckles', 'credits', 'points',
  'v-bucks', 'vbucks', 'platinum', 'silver', 'robux', 'money', 'cash', 'bucks', 'shards',
  'crystals', 'essence', 'orbs', 'keys', 'gil', 'zeny', 'mesos', 'kamas', 'adena', 'yang',
  'kinah', 'dil', 'currency', 'accounts', 'account', 'items', 'skins', 'pets', 'fruits',
  'candy', 'seeds', 'eggs', 'gpo', 'cr', 'fc', 'cp',
]

export function stripUnitSuffix(name: string): string {
  let out = name.trim()
  // Strip up to two trailing unit tokens ("Roblox Rivals Keys", "WoW Gold").
  for (let i = 0; i < 2; i += 1) {
    const m = out.match(/^(.*\S)\s+(\S+)$/)
    if (!m) break
    if (!UNIT_WORDS.includes(m[2].toLowerCase())) break
    out = m[1]
  }
  return out
}

export function parseSellerFeePage(html: string): FeeRow[] {
  const rows: FeeRow[] = []
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? []
  for (const table of tables) {
    const trs = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
    let section: FeeSection | null = null
    for (const tr of trs) {
      const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(cellText)
      if (cells.length !== 2) continue
      const [name, fee] = cells
      if (/^sales fee$/i.test(fee)) {
        section = SECTION_BY_HEADER[name.toLowerCase()] ?? 'other'
        continue
      }
      if (!section || !name) continue
      rows.push({ section, rawName: name, gameName: stripUnitSuffix(name), fee: normaliseFee(fee) })
    }
  }
  return rows
}

/** Distinct game names on the chart, first spelling wins. */
export function chartGameNames(html: string): string[] {
  const seen = new Map<string, string>()
  for (const r of parseSellerFeePage(html)) {
    const key = normalizeTitle(r.gameName)
    if (key && !seen.has(key)) seen.set(key, r.gameName)
  }
  return [...seen.values()]
}

// ── pure: snapshot diff + catalogue match ──────────────────────────────────

export interface ChartDiff {
  added: string[]
  removed: string[]
  /** True when there was no previous snapshot: this run only seeds. */
  seeded?: boolean
}

export function diffChart(previous: string[] | null, current: string[]): ChartDiff {
  if (previous === null) return { added: [], removed: [], seeded: true }
  const prev = new Set(previous.map(normalizeTitle))
  const cur = new Set(current.map(normalizeTitle))
  return {
    added: current.filter((n) => !prev.has(normalizeTitle(n))),
    removed: previous.filter((n) => !cur.has(normalizeTitle(n))),
  }
}

export interface CatalogueTitle {
  slug: string
  name: string
}

export interface ChartMatch {
  status: 'matched' | 'unmatched' | 'ambiguous'
  slug?: string
  confidence: number
  candidates: string[]
}

/** Same matcher as the icon filler: exact/noise-variant ≥ 0.9, duplicates refused. */
export function matchChartName(name: string, catalogue: CatalogueTitle[]): ChartMatch {
  const decision = decideMatch(
    name,
    catalogue.map((c) => ({ title: c.name, id: c.slug })),
  )
  return {
    status: decision.status,
    slug: decision.best ? String(decision.best.id) : undefined,
    confidence: decision.confidence,
    candidates: (decision.candidates ?? []).map((c) => String(c.id)),
  }
}
