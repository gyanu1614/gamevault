#!/usr/bin/env node
/**
 * Murder Mystery 2 catalogue import from the MM2 Fandom wiki (MediaWiki API,
 * CC-BY-SA 3.0). Parsing: src/lib/values/catalogue/mm2-wiki.ts.
 *
 * Reads (politely, 1.5 s between API calls, cached on disk):
 *   Category:Weapons + Category:Pets pages → items (type, rarity, chroma→base,
 *   image file, structured how-to-get); Category:Boxes (+ eggs) → odds/costs;
 *   gamepass + event pages → Robux costs; File: imageinfo → image URLs.
 * NEVER imports the infobox `value=` / `tier=` fields (community values).
 *
 * Writes data/values-catalogue/murder-mystery-2/catalogue.json. With
 * --feed <eldorado feed> it also writes alias-review.csv: every market name
 * the catalogue does not resolve, with offer counts and suggestions. Reviewed
 * aliases go in scripts/values-seeds/murder-mystery-2.aliases.json.
 *
 * --write upserts values_games + values_items + aliases (service role):
 *   pnpm values:mm2:catalogue                               # dry run (fetch + report)
 *   pnpm values:mm2:catalogue --feed data/values-feeds/murder-mystery-2/eldorado-latest.json
 *   pnpm values:mm2:catalogue --write --env=local
 *   pnpm values:mm2:catalogue --write --env=prod --yes      # owner only
 * Options: --refresh (ignore the page cache)
 */
import fs from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import {
  applySourceCosts,
  buildMm2Catalogue,
  parseBoxPage,
  parseEventPassCost,
  parseRobuxPrice,
} from '../src/lib/values/catalogue/mm2-wiki.ts'
import { buildMarketIndex, resolveMarketKey, suggestForReview } from '../src/lib/values/catalogue/resolve.ts'
import { normaliseStructuredListing } from '../src/lib/values/normalisers/eldorado-structured.ts'
import { eldoradoStructuredConfig } from '../src/lib/values/sources/eldorado-structured-games.ts'

const GAME = 'murder-mystery-2'
const WIKI = 'https://murder-mystery-2.fandom.com'
const API = `${WIKI}/api.php`
const UA = 'DropMarket-values-catalogue/1.0 (+https://dropmarket.gg)'
const DELAY_MS = 1500
const OUT_DIR = `data/values-catalogue/${GAME}`
const CACHE = `${OUT_DIR}/wiki-cache.json`
const ALIASES = `scripts/values-seeds/${GAME}.aliases.json`
export const LICENSE = 'CC BY-SA 3.0'

const argv = process.argv.slice(2)
const val = (name, fallback = null) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const flag = (name) => argv.includes(`--${name}`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let cache = { pages: {}, members: {}, images: {}, redirects: {} }

async function api(params) {
  await sleep(DELAY_MS)
  const u = new URL(API)
  for (const [k, v] of Object.entries({ ...params, format: 'json', formatversion: '2' })) u.searchParams.set(k, v)
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(u, { headers: { 'user-agent': UA } })
    if (res.ok) return res.json()
    await sleep(5000 * attempt)
  }
  throw new Error(`wiki API failed: ${u}`)
}

async function categoryMembers(category) {
  if (cache.members[category]) return cache.members[category]
  const titles = []
  let cont = {}
  for (;;) {
    const d = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmlimit: '500', cmtype: 'page', ...cont })
    titles.push(...(d.query?.categorymembers ?? []).map((m) => m.title))
    if (d.continue?.cmcontinue) cont = { cmcontinue: d.continue.cmcontinue }
    else break
  }
  cache.members[category] = titles
  return titles
}

async function pages(titles) {
  const missing = [...new Set(titles)].filter((t) => !(t in cache.pages))
  for (let i = 0; i < missing.length; i += 50) {
    const d = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1', titles: missing.slice(i, i + 50).join('|') })
    const redirects = new Map((d.query?.redirects ?? []).map((r) => [r.to, r.from]))
    for (const p of d.query?.pages ?? []) {
      const text = p.revisions?.[0]?.slots?.main?.content ?? null
      cache.pages[p.title] = text
      if (redirects.has(p.title)) {
        cache.pages[redirects.get(p.title)] = text
        cache.redirects[redirects.get(p.title)] = p.title
      }
    }
    for (const t of missing.slice(i, i + 50)) if (!(t in cache.pages)) cache.pages[t] = null
  }
  return titles.map((t) => ({ title: t, wikitext: cache.pages[t] })).filter((p) => p.wikitext)
}

async function imageUrls(files) {
  const missing = [...new Set(files)].filter((f) => f && !(f in cache.images))
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50)
    const d = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|mime|size', titles: batch.map((f) => `File:${f}`).join('|') })
    const norm = new Map((d.query?.normalized ?? []).map((n) => [n.to, n.from]))
    for (const p of d.query?.pages ?? []) {
      const info = p.imageinfo?.[0]
      const asked = (norm.get(p.title) ?? p.title).replace(/^File:/, '')
      cache.images[asked] = info ? { url: info.url, mime: info.mime, size: info.size, page: `${WIKI}/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}` } : null
    }
    for (const f of batch) if (!(f in cache.images)) cache.images[f] = null
  }
}

async function discoverPages(itemPages, feedPath) {
  const config = eldoradoStructuredConfig(GAME)
  const feed = JSON.parse(await readFile(feedPath, 'utf8'))
  const { items } = buildMm2Catalogue(itemPages)
  const entries = items.map((i) => ({ slug: i.slug, title: i.wikiTitle, displayTitle: i.displayTitle, itemType: i.itemType, isChroma: i.isChroma, releaseYear: i.releaseYear }))
  const index = buildMarketIndex(entries)
  const known = new Set(itemPages.map((p) => p.title))
  const word = { knife: 'Knife', gun: 'Gun', pet: 'Pet', misc: 'Misc' }
  const candidates = new Set()
  for (const l of feed.listings) {
    const id = normaliseStructuredListing(l, config)
    if (id.status !== 'ok' || resolveMarketKey(id.marketKey, index, { rarity: id.rarity }).slug) continue
    const base = id.name.replace(/\s*\([^)]*\)\s*$/, '').trim()
    const paren = id.name.match(/\(([^)]*)\)\s*$/)?.[1] ?? null
    const prefix = id.variant === 'chroma' ? 'Chroma ' : ''
    const w = word[id.itemType]
    for (const t of [base, `${base} (${w})`, `${base} ${w}`, paren ? `${base} ${w} (${paren})` : null, id.rarity ? `${base} (${id.rarity})` : null]) {
      if (t) candidates.add(`${prefix}${t}`)
    }
  }
  const lookup = [...candidates].filter((t) => !known.has(t))
  console.log(`  discovery: ${lookup.length} candidate titles for unresolved market names`)
  const found = []
  for (const p of await pages(lookup)) {
    const canonical = cache.redirects[p.title] ?? p.title
    if (known.has(canonical) || !/\{\{\s*Infobox[ _]Item/i.test(p.wikitext)) continue
    known.add(canonical)
    found.push({ title: canonical, wikitext: p.wikitext })
  }
  console.log(`  discovery: +${found.length} item pages outside the categories`)
  return found
}

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function aliasReview(items, feedPath) {
  const config = eldoradoStructuredConfig(GAME)
  const feed = JSON.parse(await readFile(feedPath, 'utf8'))
  const aliases = fs.existsSync(ALIASES) ? JSON.parse(fs.readFileSync(ALIASES, 'utf8')) : {}
  const entries = items.map((i) => ({ slug: i.slug, title: i.wikiTitle, displayTitle: i.displayTitle, itemType: i.itemType, isChroma: i.isChroma, releaseYear: i.releaseYear }))
  const index = buildMarketIndex(entries, Object.entries(aliases).map(([key, slug]) => ({ key, slug })))
  const unmatched = new Map()
  let ok = 0
  let matched = 0
  for (const l of feed.listings) {
    const id = normaliseStructuredListing(l, config)
    if (id.status === 'rejected') continue
    ok += 1
    const r = resolveMarketKey(id.marketKey, index, { rarity: id.rarity })
    if (r.slug) {
      matched += 1
      continue
    }
    const u = unmatched.get(id.marketKey) ?? { key: id.marketKey, name: id.name, type: id.itemType, variant: id.variant, rarity: id.rarity, offers: 0, reputable: 0, productKey: l.product_key, note: r.note }
    u.offers += 1
    if ((l.seller_reviews ?? 0) >= 200) u.reputable += 1
    unmatched.set(id.marketKey, u)
  }
  const rows = [...unmatched.values()].sort((a, b) => b.reputable - a.reputable || b.offers - a.offers)
  const header = 'market_key,item_type,variant,eldorado_name,rarity,offers,reputable_offers,product_key,reason,suggested_slugs,approved_slug'
  const lines = rows.map((u) =>
    [u.key, u.type, u.variant, u.name, u.rarity, u.offers, u.reputable, u.productKey, u.note, suggestForReview(u.key, entries).join(' '), ''].map(csvCell).join(','),
  )
  await writeFile(`${OUT_DIR}/alias-review.csv`, [header, ...lines].join('\n') + '\n')
  const names = new Set(feed.listings.map((l) => normaliseStructuredListing(l, config)).filter((x) => x.status !== 'rejected').map((x) => x.marketKey))
  console.log(`  feed: ${ok} structured listings, ${matched} resolve (${((matched / Math.max(ok, 1)) * 100).toFixed(1)}%)`)
  console.log(`  market names: ${names.size}, unresolved ${rows.length} -> ${OUT_DIR}/alias-review.csv`)
}

async function write(items) {
  const { valuesDbClient, selectAllRows } = await import('./lib/values-db.mjs')
  const { db, url } = valuesDbClient({ env: val('env'), yes: flag('yes') })
  console.log(`\nWriting to ${url}`)
  const { data: game, error: gErr } = await db.from('games').select('id').eq('slug', GAME).maybeSingle()
  if (gErr) throw gErr
  if (!game) throw new Error(`game '${GAME}' not found`)
  const config = eldoradoStructuredConfig(GAME)

  // values_games: the migration seeds it on prod; a fresh local stack seeds
  // games AFTER migrations, so (re)assert it here. Never flips is_enabled on.
  const { error: vgErr } = await db.from('values_games').upsert(
    {
      game_id: game.id,
      sources: [{ source: 'eldorado', game_ref: config.gameId, enabled: true, normaliser: 'eldorado-structured' }],
      taxonomy_source: { kind: 'fandom', wiki: GAME, license: 'CC-BY-SA-3.0', categories: ['Weapons', 'Pets'] },
      normaliser_key: 'eldorado-structured',
      refresh_minutes: 1440,
    },
    { onConflict: 'game_id', ignoreDuplicates: true },
  )
  if (vgErr) throw vgErr

  const rows = items.map((i, n) => ({
    game_id: game.id,
    kind: 'item',
    item_type: i.itemType,
    slug: i.slug,
    name: i.name,
    rarity: i.rarity,
    release_year: i.releaseYear,
    origin: i.origin,
    obtain: i.obtain,
    wiki_title: i.wikiTitle,
    is_priced: true,
    is_enabled: true,
    sort_order: n,
  }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('values_items').upsert(rows.slice(i, i + 500), { onConflict: 'game_id,slug' })
    if (error) throw new Error(`values_items upsert: ${error.message}`)
  }
  const saved = await selectAllRows(() => db.from('values_items').select('id,slug').eq('game_id', game.id), 'id')
  const idBySlug = new Map(saved.map((r) => [r.slug, r.id]))
  let linked = 0
  for (const i of items) {
    if (!i.baseSlug || !idBySlug.has(i.baseSlug)) continue
    const { error } = await db.from('values_items').update({ base_item_id: idBySlug.get(i.baseSlug) }).eq('id', idBySlug.get(i.slug))
    if (error) throw error
    linked += 1
  }
  const aliases = fs.existsSync(ALIASES) ? JSON.parse(fs.readFileSync(ALIASES, 'utf8')) : {}
  const aliasRows = Object.entries(aliases)
    .filter(([, slug]) => idBySlug.has(slug))
    .map(([key, slug]) => ({ item_id: idBySlug.get(slug), alias: `eldorado:${key}` }))
  if (aliasRows.length) {
    const { error } = await db.from('values_item_aliases').upsert(aliasRows, { onConflict: 'item_id,alias' })
    if (error) throw error
  }
  console.log(`Wrote ${rows.length} items, ${linked} chroma→base links, ${aliasRows.length} aliases.`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  if (!flag('refresh') && fs.existsSync(CACHE)) cache = { redirects: {}, ...JSON.parse(await readFile(CACHE, 'utf8')) }
  const save = () => writeFile(CACHE, JSON.stringify(cache))

  console.log('MM2 wiki: category members…')
  const itemTitles = [...new Set([...(await categoryMembers('Weapons')), ...(await categoryMembers('Pets'))])]
  const boxTitles = (await categoryMembers('Boxes')).filter((t) => t !== 'Boxes')
  console.log(`  ${itemTitles.length} item pages, ${boxTitles.length} box pages`)

  const itemPages = await pages(itemTitles)
  await save()

  // Discovery: market names the category walk did not cover often have a
  // page that simply is not in Category:Weapons ("Snowcannon"). Look up the
  // obvious titles for each unresolved name, once, and keep real item pages.
  const feedPath = val('feed')
  if (feedPath) {
    const extra = await discoverPages(itemPages, feedPath)
    itemPages.push(...extra)
    await save()
  }
  const firstPass = buildMm2Catalogue(itemPages)
  // Eggs/boxes the items link to that are not in Category:Boxes.
  const linkedBoxes = new Set(firstPass.items.flatMap((i) => i.obtain.filter((o) => o.kind === 'box').map((o) => o.wiki_page ?? o.name)))
  const boxPages = await pages([...new Set([...boxTitles, ...linkedBoxes])])
  const boxes = boxPages.map((p) => parseBoxPage(p.title, p.wikitext))
  const { items, skipped } = buildMm2Catalogue(itemPages, boxes)

  // Gamepass + event-pass costs from their own pages.
  const costPages = new Set(items.flatMap((i) => i.obtain.filter((o) => o.kind === 'gamepass' || o.kind === 'pass').map((o) => o.wiki_page ?? o.name)))
  const costs = new Map()
  for (const p of await pages([...costPages])) {
    const isEvent = /\bevent\b/i.test(p.title)
    const cost = isEvent ? parseEventPassCost(p.wikitext) : parseRobuxPrice(p.wikitext)
    if (cost) costs.set(p.title.toLowerCase(), cost)
  }
  applySourceCosts(items, costs)
  await save()

  await imageUrls(items.map((i) => i.imageFile))
  await save()

  const out = items.map((i) => {
    const img = i.imageFile ? cache.images[i.imageFile] : null
    return {
      ...i,
      imageSourceUrl: img?.url ?? null,
      imageMime: img?.mime ?? null,
      imageAttribution: img ? `Image: Murder Mystery 2 Wiki (Fandom), ${LICENSE} — ${img.page}` : null,
    }
  })
  await writeFile(
    `${OUT_DIR}/catalogue.json`,
    JSON.stringify({ game: GAME, source: `${WIKI} (${LICENSE})`, built_at: new Date().toISOString(), items: out, skipped }, null, 1),
  )

  const count = (pred) => out.filter(pred).length
  const byType = {}
  const byRarity = {}
  for (const i of out) {
    byType[i.itemType] = (byType[i.itemType] ?? 0) + 1
    byRarity[i.rarity ?? 'unknown'] = (byRarity[i.rarity ?? 'unknown'] ?? 0) + 1
  }
  console.log(`\nCatalogue: ${out.length} items (skipped ${skipped.length}) -> ${OUT_DIR}/catalogue.json`)
  console.log('  by type   ', byType)
  console.log('  by rarity ', byRarity)
  console.log(`  chroma ${count((i) => i.isChroma)} (linked to base ${count((i) => i.isChroma && i.baseSlug)})`)
  console.log(`  with image ${count((i) => i.imageSourceUrl)} · release year ${count((i) => i.releaseYear)} · obtain ${count((i) => i.obtain.length)} · box odds ${count((i) => i.obtain.some((o) => o.odds_pct != null))}`)

  if (feedPath) await aliasReview(out, feedPath)
  if (flag('write')) await write(out)
  else console.log('\nDry run — nothing written. Pass --write --env=local|prod to persist.')
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
