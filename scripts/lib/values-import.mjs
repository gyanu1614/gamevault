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
import fs from 'node:fs'

import { normaliseStructuredListing } from '../../src/lib/values/normalisers/eldorado-structured.ts'
import { buildMarketIndex, resolveMarketKey } from '../../src/lib/values/catalogue/resolve.ts'
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
    })
  }
  return { rows, stats, unmatched: [...unmatchedKeys.values()].sort((a, b) => b.reputableOffers - a.reputableOffers || b.offers - a.offers) }
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
  const plan = planRawRows({ game, listings: feed.listings, catalogue, observedAt, gameId: game_.id })
  report(plan, feed)

  console.log(`Writing ${plan.rows.length} raw listings to ${url}`)
  if (feed.complete) {
    // Listings not seen in this crawl stop counting; history is untouched.
    const { error } = await db.from('values_raw_listings').update({ is_active: false }).eq('game_id', game_.id).eq('is_active', true).lt('observed_at', observedAt)
    if (error) throw new Error(`retire: ${error.message}`)
  }
  const insertRows = plan.rows.map(({ matched_slug, _raw_price, ...row }) => row)
  for (let i = 0; i < insertRows.length; i += 500) {
    const { error } = await db.from('values_raw_listings').insert(insertRows.slice(i, i + 500))
    if (error) throw new Error(`values_raw_listings insert: ${error.message}`)
  }
  return plan
}

function report(plan, feed) {
  const s = plan.stats
  const pct = (n) => `${((n / Math.max(s.total, 1)) * 100).toFixed(1)}%`
  console.log(`${feed.gameSlug}: ${s.total} listings (feed complete: ${feed.complete})`)
  console.log(`  matched   ${s.matched} (${pct(s.matched)})  via title ${s.byVia.title} · derived ${s.byVia.derived} · year ${s.byVia.year} · alias ${s.byVia.alias}`)
  console.log(`  unmatched ${s.unmatched} (${plan.unmatched.length} names)  rejected ${s.rejected}  ambiguous ${s.ambiguous}`)
}
