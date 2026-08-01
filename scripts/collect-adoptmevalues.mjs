/**
 * Adopt Me catalog + trade-value collector — adoptmevalues.app
 * ============================================================================
 * Mirrors the SAB collector pattern (scripts/collect-*-sab-*.mjs): fetch a
 * public source, parse it, write a normalized JSON feed to data/, and (with
 * --send) hand it to the importer. Scrape is SEPARATE from the DB write so a
 * bad parse never corrupts the catalog.
 *
 * WHAT THIS SOURCE GIVES US
 *   - The pet CATALOG: name, slug, rarity, image (all public facts)
 *   - The TRADE-VALUE axis: community consensus points
 *   - Only 3 of 8 variants are published: Default(N), Neon(NEON), Mega(MEGA).
 *     The other 5 (F,R,FR,NFR,MFR) are DERIVED downstream from the potion
 *     ladder and flagged is_estimated — this collector does NOT invent them.
 *
 * WHAT IT DOES NOT GIVE US
 *   - USD cash values. Those come from marketplace collectors (Eldorado,
 *     gameboost, u7buy) in a later pass. This feed's cash side stays null.
 *
 * POLITE BY DEFAULT: one request at a time, real delay between requests, a
 * normal browser UA. Tune with --delay-ms. Enrichment (per-pet pages) is
 * opt-in via --enrich because it's one extra request per pet.
 *
 * Usage:
 *   node scripts/collect-adoptmevalues.mjs              # list page only → JSON
 *   node scripts/collect-adoptmevalues.mjs --enrich     # + per-pet obtainability/demand
 *   node scripts/collect-adoptmevalues.mjs --enrich --send   # + seed the DB
 *   node scripts/collect-adoptmevalues.mjs --limit 10   # first 10 pets (testing)
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const BASE_URL = 'https://www.adoptmevalues.app'
const LIST_PATH = '/values'
const DEFAULT_OUTPUT = 'data/adopt-me-feeds/adoptmevalues-latest.json'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const COLLECTOR_VERSION = 1

// --- args -------------------------------------------------------------------
function parseArgs(argv) {
  const o = {
    enrich: false,
    send: false,
    delayMs: Number(process.env.ADOPTME_DELAY_MS ?? 1500),
    limit: Number(process.env.ADOPTME_LIMIT ?? 0), // 0 = all found
    outputPath: DEFAULT_OUTPUT,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--enrich') o.enrich = true
    else if (a === '--send') o.send = true
    else if (a === '--delay-ms') o.delayMs = Number(argv[++i])
    else if (a === '--limit') o.limit = Number(argv[++i])
    else if (a === '--output') o.outputPath = argv[++i]
  }
  return o
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } })
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  return res.text()
}

// --- parsing helpers --------------------------------------------------------

/** "2.1K" → 2100, "7.2K" → 7200, "1.05M" → 1050000, "905" → 905. */
function parseCompactNumber(raw) {
  if (raw == null) return null
  const s = String(raw).trim().replace(/,/g, '')
  const m = s.match(/^([0-9]*\.?[0-9]+)\s*([KMB]?)$/i)
  if (!m) return null
  const n = parseFloat(m[1])
  const mult = { '': 1, k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()]
  return Math.round(n * mult)
}

/** adoptmevalues rarity text → our canonical schema value. */
function normalizeRarity(raw) {
  const r = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const map = {
    common: 'common',
    uncommon: 'uncommon',
    rare: 'rare',
    ultra_rare: 'ultra_rare',
    legendary: 'legendary',
  }
  return map[r] ?? null // unknown rarities are dropped, not guessed
}

/**
 * Parse the values list page into pet records. The list is a flat run of
 * anchor cards: <a href="/values/{slug}">…<img alt="Name">…<p>rarity</p>…
 * <p>{base}</p>…<span>N {neon}</span><span>M {mega}</span>. We slice per anchor
 * and pull fields by local regex so one malformed card can't derail the rest.
 */
function parseListPage(html) {
  const pets = []
  // Split on the anchor that opens each card.
  const parts = html.split(/<a href="\/values\//).slice(1)
  for (const part of parts) {
    const slug = (part.match(/^([a-z0-9-]+)"/) || [])[1]
    if (!slug) continue
    const name = (part.match(/<img alt="([^"]+)"/) || [])[1]?.trim()
    // Rarity can be two words ("ultra rare"), so allow spaces in the capture —
    // a [a-zA-Z-]+ class silently truncated "ultra rare" to "ultra" and dropped
    // every Ultra-Rare pet.
    const rarityRaw = (part.match(/uppercase tracking-wider[^>]*>([a-zA-Z -]+)</) || [])[1]
    const baseRaw = (part.match(/font-extrabold[^>]*>([0-9.,KMB]+)</) || [])[1]
    const neonRaw = (part.match(/>\s*N\s*(?:<!--\s*-->)?\s*([0-9.,KMB]+)\s*</) || [])[1]
    const megaRaw = (part.match(/>\s*M\s*(?:<!--\s*-->)?\s*([0-9.,KMB]+)\s*</) || [])[1]
    const image = (part.match(/src="(https:\/\/[^"]*\/images\/pets\/[^"]+)"/) || [])[1]
    if (!name || !slug) continue

    pets.push({
      slug,
      name,
      rarity: normalizeRarity(rarityRaw),
      rarity_raw: rarityRaw ?? null,
      image_url: image ? image.replace(/ /g, '%20') : null,
      // Trade values (community points), per published variant only.
      trade_values: {
        N: parseCompactNumber(baseRaw),
        NEON: parseCompactNumber(neonRaw),
        MEGA: parseCompactNumber(megaRaw),
      },
      obtainability: null, // filled by --enrich
      demand_rank: null,
      demand_trend: null,
    })
  }
  return pets
}

/** Per-pet page → obtainability + demand. Best-effort; nulls when absent. */
function parsePetPage(html) {
  const text = html
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

// --- main -------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2))
  console.log('Adopt Me catalog collector (adoptmevalues.app)')
  console.log(`  enrich=${opts.enrich} send=${opts.send} delay=${opts.delayMs}ms limit=${opts.limit || 'all'}\n`)

  const listHtml = await fetchText(BASE_URL + LIST_PATH)
  let pets = parseListPage(listHtml)
  console.log(`Parsed ${pets.length} pets from the list page.`)

  // Drop cards we couldn't classify (unknown rarity) — never guess a rarity.
  const dropped = pets.filter((p) => !p.rarity)
  if (dropped.length) {
    console.log(`  ⚠️  ${dropped.length} dropped for unknown rarity: ${dropped.map((p) => p.rarity_raw).join(', ')}`)
    pets = pets.filter((p) => p.rarity)
  }

  if (opts.limit > 0) pets = pets.slice(0, opts.limit)

  if (opts.enrich) {
    console.log(`\nEnriching ${pets.length} pets from per-pet pages (${opts.delayMs}ms apart)…`)
    for (let i = 0; i < pets.length; i += 1) {
      const p = pets[i]
      try {
        const petHtml = await fetchText(`${BASE_URL}/values/${p.slug}`)
        Object.assign(p, parsePetPage(petHtml))
        process.stdout.write(`  [${i + 1}/${pets.length}] ${p.name} → ${p.obtainability ?? '?'}\n`)
      } catch (err) {
        console.log(`  [${i + 1}/${pets.length}] ${p.name} → enrich failed: ${err.message}`)
      }
      if (i < pets.length - 1) await sleep(opts.delayMs)
    }
  }

  const feed = {
    source: 'adoptmevalues.app',
    collector_version: COLLECTOR_VERSION,
    // No Date.now() note: this runs as a plain script, wall-clock is fine here.
    collected_at: new Date().toISOString(),
    enriched: opts.enrich,
    pet_count: pets.length,
    pets,
  }

  const outPath = resolve(process.cwd(), opts.outputPath)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(feed, null, 2))
  console.log(`\nWrote ${pets.length} pets → ${opts.outputPath}`)

  if (opts.send) {
    console.log('\n--send: handing feed to the importer…')
    await new Promise((res, rej) => {
      // --write so the importer actually PERSISTS. Without it the importer
      // dry-runs ("Would upsert…") and nothing reaches the DB — which is the
      // whole point of --send.
      const child = spawn(
        'node',
        ['scripts/import-adoptmevalues.mjs', opts.outputPath, '--write'],
        { stdio: 'inherit' },
      )
      child.on('exit', (code) => (code === 0 ? res() : rej(new Error(`importer exited ${code}`))))
    })
  }
}

main().catch((err) => {
  console.error('\n❌ Collector failed:', err.message)
  process.exit(1)
})
