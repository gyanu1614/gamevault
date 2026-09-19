#!/usr/bin/env node
/**
 * Seed the Steal An Egg values config + taxonomy.
 *
 * Reads the Fandom `stealanegg` wiki (143 pet pages, 94% field coverage) and
 * writes:
 *   - one values_games config row
 *   - values_items: areas, eggs, pets (catalogue-only), account brackets
 *   - values_item_aliases: the spellings the live sample proved we need
 *   - values_rejection_patterns: titles that are never an item
 *
 * Read-only by default. Pass --write to persist (needs the service role key).
 *
 *   node scripts/seed-steal-an-egg.mjs            # dry run, prints the plan
 *   node scripts/seed-steal-an-egg.mjs --write
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

/**
 * Mirror of STEAL_AN_EGG_SEED_ALIASES in
 * src/lib/values/normalisers/steal-an-egg.ts. Duplicated deliberately: this is
 * an owner-run script and importing a .ts module would tie it to a loader
 * flag. A guard test asserts the two stay in step.
 */
const STEAL_AN_EGG_SEED_ALIASES = {
  'angels-demons': [
    'angels',
    'demons',
    'demon',
    'angel',
    'demon/angel',
    'angel/demon',
    'angels or demons',
    'angel or demon',
    'evil or angel',
    'angels & demons',
  ],
  'king-monkey': ['king monkey', 'monkey area', 'king monkey area'],
  'abyss-ocean': ['ocean', 'abyss', 'abyss ocean'],
  'cherry-blossom': ['cherry blossom', 'cherry', 'blossom'],
  'titan-temple': ['titan', 'temple', 'titan temple area'],
  prehistoric: ['prehistoric area', 'dino', 'dinosaur'],
  cosmic: ['cosmic area', 'space'],
  snow: ['snow area', 'winter', 'ice'],
  rift: ['rift area', 'riftborn'],
}

const WIKI = 'https://stealanegg.fandom.com/api.php'
const GAME_SLUG = 'steal-an-egg'
const WRITE = process.argv.includes('--write')

const UA = 'DropMarket-values-seed/1.0 (+https://dropmarket.gg)'
const slugify = (s) =>
  String(s || '')
    .replace(/[\[\]]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const clean = (s) => String(s || '').replace(/[\[\]]/g, '').trim()

/** "$1.25M/s" -> 1_250_000 */
function parseMps(raw) {
  const m = clean(raw).match(/([\d.]+)\s*([KMBT])?/i)
  if (!m) return null
  const mult = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[(m[2] || '').toLowerCase()] ?? 1
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n * mult : null
}

async function wiki(params) {
  const url = new URL(WIKI)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`wiki ${res.status}`)
  return res.json()
}

async function loadTaxonomy() {
  const list = await wiki({
    action: 'query',
    list: 'categorymembers',
    cmtitle: 'Category:Pets',
    cmlimit: '500',
    format: 'json',
  })
  const titles = list.query.categorymembers.map((m) => m.title)

  // Bulk: 50 pages per request (one-at-a-time takes minutes).
  const rows = []
  for (let i = 0; i < titles.length; i += 50) {
    const data = await wiki({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      titles: titles.slice(i, i + 50).join('|'),
      format: 'json',
    })
    for (const page of Object.values(data.query.pages)) {
      const text = page?.revisions?.[0]?.slots?.main?.['*']
      if (!text) continue
      const field = (k) => (text.match(new RegExp(`\\|${k}=([^\\n|}]*)`)) || [])[1] || ''
      rows.push({
        pet: clean(field('pet_name')) || page.title,
        egg: clean(field('egg_name')),
        rarity: clean(field('rarity')),
        biome: clean(field('biome')),
        mps: clean(field('mps')),
      })
    }
  }
  return rows
}

/**
 * Account income brackets, derived from the live listing distribution
 * (95 account listings with a parseable income, 2026-09-18).
 *
 * Published as OBSERVED MEDIANS per bracket, never as a $-per-B/s rate: price
 * is concave in income (quintile medians $5.50 → $11.49 → $12.99 → $14.49 →
 * $15.68, r=0.45 on log income), so a linear rate would badly misprice both
 * ends. The methodology page states this.
 */
const ACCOUNT_BRACKETS = [
  { slug: 'accounts-1-10b', name: '1–10B/s', min: 1e9, max: 10e9, order: 1 },
  { slug: 'accounts-10-50b', name: '10–50B/s', min: 10e9, max: 50e9, order: 2 },
  { slug: 'accounts-50-100b', name: '50–100B/s', min: 50e9, max: 100e9, order: 3 },
  { slug: 'accounts-100b-plus', name: '100B/s+', min: 100e9, max: null, order: 4 },
]

/** Titles that are never an item value — keeps the review file signal clean. */
const REJECTION_PATTERNS = [
  { pattern: 'egg run', reason: 'service, not an item' },
  { pattern: 'tips jar', reason: 'not a sale' },
  { pattern: 'x2 money', reason: 'gamepass/currency' },
  { pattern: 'x2 growth', reason: 'gamepass/currency' },
  { pattern: 'x2 luck', reason: 'gamepass/currency' },
  { pattern: 'eggs service', reason: 'service, not an item' },
]

async function main() {
  console.log('Loading taxonomy from the stealanegg wiki…')
  const rows = await loadTaxonomy()
  console.log(`  ${rows.length} pet pages parsed`)

  const areas = new Map()
  const eggs = new Map()
  const pets = []

  for (const r of rows) {
    // A biome value that is really an egg name is wiki noise ("Luminous Egg"
    // appears in the biome field on one page) — never becomes an area.
    if (r.biome && !/egg/i.test(r.biome)) {
      const s = slugify(r.biome)
      if (s) areas.set(s, { slug: s, name: clean(r.biome) })
    }
    if (r.egg) {
      // "Riftborn Eggs" and "Riftborn Egg" are the same egg.
      const name = clean(r.egg).replace(/\s+Eggs$/i, ' Egg')
      const s = slugify(name)
      if (s) eggs.set(s, { slug: s, name })
    }
    if (r.pet) {
      pets.push({
        slug: slugify(r.pet),
        name: clean(r.pet),
        rarity: r.rarity || null,
        area: r.biome && !/egg/i.test(r.biome) ? clean(r.biome) : null,
        income: parseMps(r.mps),
        eggSlug: r.egg ? slugify(clean(r.egg).replace(/\s+Eggs$/i, ' Egg')) : null,
      })
    }
  }

  // "King Monkey" is an area sellers name constantly but the wiki omits it.
  if (!areas.has('king-monkey')) {
    areas.set('king-monkey', { slug: 'king-monkey', name: 'King Monkey' })
  }

  const aliasCount = Object.values(STEAL_AN_EGG_SEED_ALIASES).flat().length

  console.log('\n=== SEED PLAN ===')
  console.log(`  areas            : ${areas.size}   (PRICED)`)
  console.log(`  eggs             : ${eggs.size}  (PRICED)`)
  console.log(`  pets             : ${pets.length}  (CATALOGUE ONLY — never priced)`)
  console.log(`  account brackets : ${ACCOUNT_BRACKETS.length}   (PRICED)`)
  console.log(`  aliases          : ${aliasCount}`)
  console.log(`  rejection rules  : ${REJECTION_PATTERNS.length}`)
  console.log(`  priced pages     : ${areas.size + eggs.size + ACCOUNT_BRACKETS.length}`)
  console.log(`  catalogue pages  : ${pets.length}`)

  const withIncome = pets.filter((p) => p.income != null).length
  const withEgg = pets.filter((p) => p.eggSlug).length
  console.log(`\n  pets with income   : ${withIncome}/${pets.length}`)
  console.log(`  pets with a source egg (drives the buy module): ${withEgg}/${pets.length}`)

  if (!WRITE) {
    console.log('\nDry run — nothing written. Pass --write to persist.')
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --write')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const { data: game, error: gameErr } = await db
    .from('games')
    .select('id')
    .eq('slug', GAME_SLUG)
    .maybeSingle()
  if (gameErr) throw gameErr
  if (!game) throw new Error(`game '${GAME_SLUG}' not found — create it in admin first`)

  // 1. config
  await db.from('values_games').upsert(
    {
      game_id: game.id,
      sources: [{ source: 'eldorado', game_ref: '452', enabled: true }],
      taxonomy_source: { kind: 'fandom', wiki: 'stealanegg', categories: ['Pets'] },
      normaliser_key: 'steal-an-egg',
      refresh_minutes: 180,
      is_enabled: true,
    },
    { onConflict: 'game_id' },
  )

  // 2. items — areas + eggs priced, pets catalogue-only
  const items = [
    ...[...areas.values()].map((a, i) => ({
      game_id: game.id, kind: 'area', slug: a.slug, name: a.name,
      is_priced: true, sort_order: i,
    })),
    ...[...eggs.values()].map((e, i) => ({
      game_id: game.id, kind: 'egg', slug: e.slug, name: e.name,
      is_priced: true, sort_order: i,
    })),
    ...ACCOUNT_BRACKETS.map((b) => ({
      game_id: game.id, kind: 'account_bracket', slug: b.slug, name: b.name,
      bracket_min: b.min, bracket_max: b.max, is_priced: true, sort_order: b.order,
    })),
    ...pets.map((p, i) => ({
      game_id: game.id, kind: 'pet', slug: p.slug, name: p.name,
      rarity: p.rarity, area: p.area, income_per_sec: p.income,
      is_priced: false, sort_order: i,
    })),
  ]
  for (let i = 0; i < items.length; i += 500) {
    const { error } = await db
      .from('values_items')
      .upsert(items.slice(i, i + 500), { onConflict: 'game_id,slug' })
    if (error) throw error
  }

  // 3. pet -> source egg (second pass: eggs must exist first)
  const { data: saved } = await db
    .from('values_items')
    .select('id,slug,kind')
    .eq('game_id', game.id)
  const idBySlug = new Map((saved ?? []).map((r) => [r.slug, r.id]))
  for (const p of pets) {
    if (!p.eggSlug || !idBySlug.has(p.eggSlug) || !idBySlug.has(p.slug)) continue
    await db
      .from('values_items')
      .update({ source_item_id: idBySlug.get(p.eggSlug) })
      .eq('id', idBySlug.get(p.slug))
  }

  // 4. aliases
  const aliasRows = []
  for (const [slug, aliases] of Object.entries(STEAL_AN_EGG_SEED_ALIASES)) {
    const id = idBySlug.get(slug)
    if (!id) continue
    for (const alias of aliases) aliasRows.push({ item_id: id, alias })
  }
  if (aliasRows.length) {
    await db.from('values_item_aliases').upsert(aliasRows, { onConflict: 'item_id,alias' })
  }

  // 5. rejection patterns
  await db.from('values_rejection_patterns').upsert(
    REJECTION_PATTERNS.map((r) => ({ game_id: game.id, ...r })),
    { onConflict: 'game_id,pattern' },
  )

  console.log(`\nWrote: config, ${items.length} items, ${aliasRows.length} aliases, ${REJECTION_PATTERNS.length} rejection patterns.`)
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
