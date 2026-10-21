/**
 * adoptmevalues.app catalog fetch + parse — shared by the catalog collector
 * (collect-adoptmevalues.mjs) and the catalog dry run (adoptme-catalog-dryrun.mjs).
 *
 * The values list is paginated: /values is page 1 (60 cards + "Load More"),
 * then /values/page/2 … /values/page/N. Past the last page the site still
 * answers 200 with zero cards, so "a page with no cards" is the stop signal;
 * `maxPages` is only a hard ceiling against a parser that never sees zero.
 *
 * Pure parsing + plain fetch. No DB, no writes.
 */

export const ADOPTMEVALUES_BASE_URL = 'https://www.adoptmevalues.app'
export const ADOPTMEVALUES_LIST_PATH = '/values'
export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'

/** Hard ceiling on list pages (the site had 14 on 2026-10-04). */
export const DEFAULT_MAX_LIST_PAGES = 30

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * GET a page, giving up after 30 s and retrying once. On 2026-10-17 one list
 * page hung for 24 minutes and pushed the weekly job past its time limit.
 */
export async function fetchText(url, { ua = BROWSER_UA, timeoutMs = 30_000 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': ua, accept: 'text/html' }, signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
      return await res.text()
    } catch (err) {
      if (attempt >= 2) throw err
      await sleep(5_000)
    }
  }
}

/** URL of list page `n` (1-based). Page 1 is the bare /values path. */
export function listPageUrl(n) {
  return n <= 1
    ? ADOPTMEVALUES_BASE_URL + ADOPTMEVALUES_LIST_PATH
    : `${ADOPTMEVALUES_BASE_URL}${ADOPTMEVALUES_LIST_PATH}/page/${n}`
}

const round2 = (n) => Math.round(n * 100) / 100

/**
 * "2.1K" → 2100, "1.05M" → 1050000, "905" → 905, "0.02" → 0.02. Small pets
 * are listed in fractions; rounding to whole numbers showed them as Trade 0
 * (2026-10-14), so two decimals are kept.
 */
export function parseCompactNumber(raw) {
  if (raw == null) return null
  const s = String(raw).trim().replace(/,/g, '')
  const m = s.match(/^([0-9]*\.?[0-9]+)\s*([KMB]?)$/i)
  if (!m) return null
  const n = parseFloat(m[1])
  const mult = { '': 1, k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()]
  return round2(n * mult)
}

/** Our 8 Adopt Me forms. Trade values are DropMarket's own (src/lib/pricing/adopt-me-trade-value.ts). */
export const ALL_TRADE_VARIANTS = ['N', 'F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR']

/** adoptmevalues rarity text → our canonical schema value, or null if unknown. */
export function normalizeRarity(raw) {
  const r = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const map = {
    common: 'common',
    uncommon: 'uncommon',
    rare: 'rare',
    ultra_rare: 'ultra_rare',
    legendary: 'legendary',
  }
  return map[r] ?? null // unknown rarities are reported by the caller, never guessed
}

/**
 * @typedef {{
 *   slug: string, name: string, rarity: string | null, rarity_raw: string | null,
 *   image_url: string | null,
 *   trade_values: { FR: number | null, NFR: number | null, MFR: number | null },
 *   obtainability: string | null, demand_rank: number | null, demand_trend: string | null,
 * }} CatalogPet
 */

/**
 * Parse one values list page into pet records. The list is a flat run of
 * anchor cards: <a href="/values/{slug}">…<img alt="Name">…<p>rarity</p>…
 * <p>{base}</p>…<span>N {neon}</span><span>M {mega}</span>. The three numbers
 * are the site's Fly Ride values (FR / Neon FR / Mega FR), kept in the feed
 * for reference only: our trade values are our own. We slice per anchor
 * and pull fields by local regex so one malformed card can't derail the rest.
 */
/** @returns {CatalogPet[]} */
export function parseListPage(html) {
  /** @type {CatalogPet[]} */
  const pets = []
  const parts = String(html).split(/<a href="\/values\//).slice(1)
  for (const part of parts) {
    const slug = (part.match(/^([a-z0-9-]+)"/) || [])[1]
    if (!slug) continue
    const name = (part.match(/<img alt="([^"]+)"/) || [])[1]?.trim()
    // Rarity can be two words ("ultra rare"), so allow spaces in the capture.
    const rarityRaw = (part.match(/uppercase tracking-wider[^>]*>([a-zA-Z -]+)</) || [])[1]
    const baseRaw = (part.match(/font-extrabold[^>]*>([0-9.,KMB]+)</) || [])[1]
    const neonRaw = (part.match(/>\s*N\s*(?:<!--\s*-->)?\s*([0-9.,KMB]+)\s*</) || [])[1]
    const megaRaw = (part.match(/>\s*M\s*(?:<!--\s*-->)?\s*([0-9.,KMB]+)\s*</) || [])[1]
    const image = (part.match(/src="(https:\/\/[^"]*\/images\/pets\/[^"]+)"/) || [])[1]
    if (!name) continue

    pets.push({
      slug,
      name: decodeEntities(name),
      rarity: normalizeRarity(rarityRaw),
      rarity_raw: rarityRaw ?? null,
      image_url: image ? image.replace(/ /g, '%20') : null,
      trade_values: {
        FR: parseCompactNumber(baseRaw),
        NFR: parseCompactNumber(neonRaw),
        MFR: parseCompactNumber(megaRaw),
      },
      obtainability: null, // filled by --enrich
      demand_rank: null,
      demand_trend: null,
    })
  }
  return pets
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
}

/** Per-pet page → obtainability + demand. Best-effort; nulls when absent. */
export function parsePetPage(html) {
  const text = String(html)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')

  let obtainability = null
  if (/\bUnobtainable\b/i.test(text)) obtainability = 'unobtainable'
  else if (/\bLimited\b/i.test(text)) obtainability = 'limited'
  else if (/\bObtainable\b/i.test(text)) obtainability = 'obtainable'

  const demandRank = (text.match(/Demand Rank[^0-9]*#?\s*([0-9]+)/i) || [])[1]
  let demandTrend = null
  if (/rising|going up|trending up/i.test(text)) demandTrend = 'rising'
  else if (/falling|going down|trending down/i.test(text)) demandTrend = 'falling'
  else if (/stable/i.test(text)) demandTrend = 'stable'

  return {
    obtainability,
    demand_rank: demandRank ? Number(demandRank) : null,
    demand_trend: demandTrend,
  }
}

/**
 * Fetch every list page until one comes back with zero cards (or `maxPages`).
 * Dedupes by slug (a card repeated across a page seam is kept once). Returns
 * ALL parsed cards, including unknown-rarity ones — the caller decides what to
 * drop and must log it.
 *
 * @returns {Promise<{ pets: CatalogPet[], pages: number, stoppedBy: 'empty-page'|'max-pages' }>}
 */
export async function fetchCatalogPages({
  maxPages = DEFAULT_MAX_LIST_PAGES,
  delayMs = 1500,
  log = () => {},
  fetchPage = (n) => fetchText(listPageUrl(n)),
} = {}) {
  const bySlug = new Map()
  let pages = 0
  let stoppedBy = 'max-pages'
  for (let n = 1; n <= maxPages; n += 1) {
    if (n > 1) await sleep(delayMs)
    const html = await fetchPage(n)
    pages = n
    const cards = parseListPage(html)
    let fresh = 0
    for (const card of cards) {
      if (bySlug.has(card.slug)) continue
      bySlug.set(card.slug, card)
      fresh += 1
    }
    log(`  page ${n}: ${cards.length} cards (${fresh} new)`)
    if (cards.length === 0) {
      stoppedBy = 'empty-page'
      break
    }
  }
  return { pets: [...bySlug.values()], pages, stoppedBy }
}
