/**
 * Eldorado feed → values_raw_listings, for `eldorado-structured` games.
 *
 * Every listing is kept (the raw table IS the review file): matched rows carry
 * matched_item_id + confidence, and rejected / ambiguous / unmatched rows are
 * written with that parse_status for review — never silently dropped.
 *
 * Catalogue source:
 *   write mode  values_items + values_item_aliases ('eldorado:<market key>')
 *               from the database the client points at
 *   dry run     data/values-catalogue/<game>/catalogue.json + the alias seed
 *
 * A write from an INCOMPLETE feed (crawl stopped early) refuses to run unless
 * allowPartial: it would retire listings the crawl simply did not reach.
 */
import { dedupeOffers } from './offers.mjs'
import { retireUnseenRawListings } from './values-raw.mjs'
import fs from 'node:fs'

import { normaliseStructuredListing } from '../../src/lib/values/normalisers/eldorado-structured.ts'
import { buildMarketIndex, marketNamesFor, resolveMarketKey } from '../../src/lib/values/catalogue/resolve.ts'
import { describeMarketNames, loadMarketNamesSafe, planMarketNames, saveMarketNamesSafe } from './market-names.mjs'
import { eldoradoStructuredConfig } from '../../src/lib/values/sources/eldorado-structured-games.ts'

/** values_raw_listings.quantity is an int; Eldorado stock claims run to millions. */
const MAX_STOCK = 1_000_000
const ALIAS_PREFIX = 'eldorado:'

export function aliasSeedPath(game) {
  return `scripts/values-seeds/${game}.aliases.json`
}

export function loadLocalCatalogue(game, cataloguePath = `data/values-catalogue/${game}/catalogue.json`) {
  if (!fs.existsSync(cataloguePath)) {
    throw new Error(`${cataloguePath} not found — run the catalogue import first (pnpm values:mm2:catalogue)`)
  }
  const cat = JSON.parse(fs.readFileSync(cataloguePath, 'utf8'))
  const aliasFile = aliasSeedPath(game)
  const aliases = fs.existsSync(aliasFile) ? JSON.parse(fs.readFileSync(aliasFile, 'utf8')) : {}
  return {
    items: cat.items,
    entries: cat.items.map((i) => ({ slug: i.slug, title: i.wikiTitle, displayTitle: i.displayTitle, itemType: i.itemType, isChroma: i.isChroma, releaseYear: i.releaseYear })),
    aliases: Object.entries(aliases).map(([key, slug]) => ({ key, slug })),
    idBySlug: null,
  }
}

async function loadDbCatalogue(db, gameId) {
  const { selectAllRows } = await import('./values-db.mjs')
  const rows = await selectAllRows(
    () =>
      db
        .from('values_items')
        .select('id,slug,name,wiki_title,item_type,base_item_id,release_year,kind,values_item_aliases(alias)')
        .eq('game_id', gameId)
        .eq('is_enabled', true),
    'id',
  )
  const entries = rows
    .filter((r) => r.kind === 'item')
    .map((r) => {
      const title = r.wiki_title ?? r.name
      return { slug: r.slug, title, displayTitle: r.name !== title ? r.name : null, itemType: r.item_type, isChroma: r.base_item_id != null || /^chroma\s/i.test(title), releaseYear: r.release_year }
    })
  const aliases = rows.flatMap((r) =>
    (r.values_item_aliases ?? [])
      .map((a) => a.alias)
      .filter((a) => a.startsWith(ALIAS_PREFIX))
      .map((a) => ({ key: a.slice(ALIAS_PREFIX.length), slug: r.slug })),
  )
  return { items: rows, entries, aliases, idBySlug: new Map(rows.map((r) => [r.slug, r.id])) }
}

const round2 = (n) => (n == null ? null : Math.round(Number(n) * 100) / 100)

/**
 * Pure: feed listings → raw-listing rows (with `matched_slug` for reports) +
 * counts. `idBySlug` (write mode) fills matched_item_id.
 */
export function planRawRows({ game, listings, catalogue, observedAt, gameId = null }) {
  const config = eldoradoStructuredConfig(game)
  if (!config) throw new Error(`no eldorado-structured config for "${game}"`)
  const index = buildMarketIndex(catalogue.entries, catalogue.aliases)
  const stats = { total: 0, matched: 0, unmatched: 0, rejected: 0, ambiguous: 0, byVia: { title: 0, derived: 0, year: 0, alias: 0 } }
  const unmatchedKeys = new Map()
  const rows = []
  for (const l of listings) {
    stats.total += 1
    const id = normaliseStructuredListing(l, config)
    let status = id.status === 'ok' ? 'unmatched' : id.status
    let slug = null
    let confidence = null
    if (id.status === 'ok') {
      const r = resolveMarketKey(id.marketKey, index, { rarity: id.rarity })
      if (r.slug) {
        status = 'matched'
        slug = r.slug
        confidence = r.confidence
        stats.byVia[r.via] += 1
      } else {
        const u = unmatchedKeys.get(id.marketKey) ?? { key: id.marketKey, offers: 0, reputableOffers: 0 }
        u.offers += 1
        if ((l.seller_reviews ?? 0) >= 200) u.reputableOffers += 1
        unmatchedKeys.set(id.marketKey, u)
      }
    }
    stats[status] += 1
    rows.push({
      game_id: gameId,
      source: 'eldorado',
      source_offer_id: l.source_offer_id,
      title: String(l.title ?? '').slice(0, 500) || '(untitled)',
      price_usd: round2(l.price_usd),
      quantity: Math.max(1, Math.min(MAX_STOCK, Math.floor(Number(l.quantity) || 1))),
      seller_reviews: l.seller_reviews == null ? null : Math.floor(Number(l.seller_reviews)),
      parse_status: status,
      matched_item_id: slug && catalogue.idBySlug ? catalogue.idBySlug.get(slug) ?? null : null,
      match_confidence: confidence,
      is_active: true,
      observed_at: observedAt,
      seller_ref: l.seller_ref ?? null,
      source_item_key: l.product_key ?? (id.marketKey ? `${ALIAS_PREFIX}${id.marketKey}` : null),
      source_variant: l.variant_raw ?? null,
      // Report-only fields (stripped before insert).
      matched_slug: slug,
      _raw_price: l.price_usd,
      _market_key: id.marketKey ?? null,
    })
  }
  return { rows, stats, unmatched: [...unmatchedKeys.values()].sort((a, b) => b.reputableOffers - a.reputableOffers || b.offers - a.offers) }
}

/** The names a catalogue row can be sold under, for close matching ("Chroma Fang" → "Fang"). */
function candidateNames(e) {
  const names = new Set()
  for (const t of [e.title, e.displayTitle].filter(Boolean)) {
    const { exact, derived } = marketNamesFor(t, e.itemType)
    for (const n of [...exact, ...derived]) names.add(e.isChroma ? n.replace(/^chroma\s+/i, '') : n)
  }
  return [...names]
}

/**
 * Pure: the market keys exact matching missed → the match log
 * (market-names.mjs). Candidates share the key's type + variant and were not
 * matched exactly this run. Returns the plan with those listings matched, and
 * the log rows to save.
 */
export function applyMarketNames({ game, plan, catalogue, ledger, now }) {
  const claimed = new Set(plan.rows.map((r) => r.matched_slug).filter(Boolean))
  const groups = new Map()
  for (const u of plan.unmatched) {
    const tv = u.key.split('|').slice(0, 2).join('|')
    const g = groups.get(tv) ?? new Map()
    g.set(u.key, u.offers)
    groups.set(tv, g)
  }
  const mapped = new Map()
  const log = { mapped, rows: [], autoMatched: [] }
  for (const [tv, names] of groups) {
    const [type, variant] = tv.split('|')
    const items = catalogue.entries
      .filter((e) => e.itemType === type && (variant === 'chroma') === e.isChroma)
      .map((e) => ({ slug: e.slug, names: candidateNames(e) }))
    const p = planMarketNames({ game, names, items, claimed, ledger, now, nameOf: (k) => k.split('|').slice(2).join('|') })
    for (const [k, slug] of p.mapped) {
      mapped.set(k, slug)
      claimed.add(slug)
    }
    log.rows.push(...p.rows)
    log.autoMatched.push(...p.autoMatched)
  }
  if (!mapped.size) return { plan, log }

  let moved = 0
  const rows = plan.rows.map((r) => {
    const slug = r.parse_status === 'unmatched' && r._market_key ? mapped.get(r._market_key) : null
    if (!slug) return r
    moved += 1
    return { ...r, parse_status: 'matched', matched_slug: slug, matched_item_id: catalogue.idBySlug?.get(slug) ?? null, match_confidence: 0.75 }
  })
  const stats = { ...plan.stats, matched: plan.stats.matched + moved, unmatched: plan.stats.unmatched - moved, byVia: { ...plan.stats.byVia, log: moved } }
  return { plan: { rows, stats, unmatched: plan.unmatched.filter((u) => !mapped.has(u.key)) }, log }
}

export async function importEldoradoFeed({ game, feed, env, yes = false, write = false, allowPartial = false, cataloguePath }) {
  const observedAt = new Date().toISOString()
  if (!write) {
    const catalogue = loadLocalCatalogue(game, cataloguePath)
    const plan = planRawRows({ game, listings: feed.listings, catalogue, observedAt })
    report(plan, feed)
    console.log('Dry run — nothing written. Pass --write --env=local|prod to persist.')
    return plan
  }

  if (!feed.complete && !allowPartial) {
    throw new Error('feed is incomplete (crawl did not reach the last page) — refusing to retire listings. Re-crawl, or pass --allow-partial to insert without retiring.')
  }
  const { valuesDbClient } = await import('./values-db.mjs')
  const { db, url } = valuesDbClient({ env, yes })
  const { data: game_ } = await db.from('games').select('id').eq('slug', game).maybeSingle()
  if (!game_) throw new Error(`game '${game}' not found`)
  const { data: vg } = await db.from('values_games').select('is_enabled,normaliser_key,sources').eq('game_id', game_.id).maybeSingle()
  if (!vg) throw new Error(`no values_games row for '${game}' — push the migration / run the catalogue import first`)
  const config = eldoradoStructuredConfig(game)
  const src = (vg.sources ?? []).find((s) => s.source === 'eldorado')
  if (!src?.enabled || String(src.game_ref) !== config.gameId) {
    throw new Error(`values_games.sources has no enabled eldorado source with game_ref ${config.gameId} — refusing`)
  }

  const catalogue = await loadDbCatalogue(db, game_.id)
  if (!catalogue.entries.length) throw new Error(`no values_items for '${game}' — run the catalogue import first`)
  const listings = dedupeOffers(feed.listings)
  if (listings.length < feed.listings.length) console.log(`  duplicates: ${feed.listings.length - listings.length} repeated offers dropped`)
  const exact = planRawRows({ game, listings, catalogue, observedAt, gameId: game_.id })
  // What exact matching missed → saved decisions, close matches, review list.
  const ledger = await loadMarketNamesSafe(db, game)
  const { plan, log } = ledger ? applyMarketNames({ game, plan: exact, catalogue, ledger, now: observedAt }) : { plan: exact, log: null }
  report(plan, feed)
  if (log) console.log(describeMarketNames(game, log))

  console.log(`Writing ${plan.rows.length} raw listings to ${url}`)
  const insertRows = plan.rows.map(({ matched_slug, _raw_price, _market_key, ...row }) => row)
  for (let i = 0; i < insertRows.length; i += 500) {
    const { error } = await db.from('values_raw_listings').insert(insertRows.slice(i, i + 500))
    if (error) throw new Error(`values_raw_listings insert: ${error.message}`)
  }
  if (feed.complete) {
    // Only now, with this crawl saved: listings not seen in it stop counting
    // (done first, a failed insert left the game with no active listings).
    // History is untouched.
    await retireUnseenRawListings(db, game_.id, observedAt)
    // Offer counts are only true for a complete crawl.
    if (log) await saveMarketNamesSafe(db, game, log.rows)
  }
  return plan
}

function report(plan, feed) {
  const s = plan.stats
  const pct = (n) => `${((n / Math.max(s.total, 1)) * 100).toFixed(1)}%`
  console.log(`${feed.gameSlug}: ${s.total} listings (feed complete: ${feed.complete})`)
  console.log(`  matched   ${s.matched} (${pct(s.matched)})  via title ${s.byVia.title} · derived ${s.byVia.derived} · year ${s.byVia.year} · alias ${s.byVia.alias} · match log ${s.byVia.log ?? 0}`)
  console.log(`  unmatched ${s.unmatched} (${plan.unmatched.length} names)  rejected ${s.rejected}  ambiguous ${s.ambiguous}`)
}
