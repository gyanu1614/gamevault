#!/usr/bin/env node
/**
 * Phase 1 · Step 1 — bulk game seeder.
 *
 *   pnpm seed:games --env=local --dry-run     # print the diff, write nothing
 *   pnpm seed:games --env=local               # apply
 *   pnpm seed:games --env=prod --dry-run
 *
 * Idempotent: upserts by slug, so re-running converges instead of duplicating.
 * Every row goes through the SAME validator the admin wizard uses
 * (src/lib/games/validate-game.ts) — a row the seed accepts is a row the
 * wizard would have accepted. Rejects are written to
 * data/games-seed.rejected.csv with a reason rather than failing the run.
 *
 * Categories are enabled through the existing bridge semantics
 * (game_categories → global_categories, mirrored into the legacy
 * public.categories table that listings.category_id points at), so a seeded
 * game is wired exactly like one created in the admin wizard.
 *
 * Writes use the service-role key: public.games and public.categories are
 * RLS-protected and admin-only.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { validateGameIdentity } from '../src/lib/games/validate-game.ts'
import { mergeGameRow, findAliasSlugCollisions } from '../src/lib/games/seed-merge.ts'

// ── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
const ENV = val('env', '')
const DRY = has('--dry-run')
const CSV = val('file', 'data/games-seed.csv')
const LIMIT = Number(val('limit', '0')) || 0

if (!['local', 'prod'].includes(ENV)) {
  console.error('✗ --env=local or --env=prod is required (no default, on purpose).')
  process.exit(1)
}

// ── env ────────────────────────────────────────────────────────────────────
// local  → .env.test  (local stack, dummy keys)
// prod   → .env.local (production Supabase + live keys)
const ENV_FILE = ENV === 'local' ? '.env.test' : '.env.local'
if (!existsSync(ENV_FILE)) {
  console.error(`✗ ${ENV_FILE} not found — cannot resolve credentials for --env=${ENV}.`)
  process.exit(1)
}
loadEnv({ path: ENV_FILE })

const URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
if (!URL || !KEY) {
  console.error(`✗ ${ENV_FILE} is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.`)
  process.exit(1)
}

// Guard: --env=prod must actually point at a remote project, and --env=local
// must not. Prevents a mis-set .env from seeding 200 rows into production.
const isLocalUrl = /(?:localhost|127\.0\.0\.1)/.test(URL)
if (ENV === 'local' && !isLocalUrl) {
  console.error(`✗ --env=local but ${ENV_FILE} points at ${URL}. Refusing.`)
  process.exit(1)
}
if (ENV === 'prod' && isLocalUrl) {
  console.error(`✗ --env=prod but ${ENV_FILE} points at a local URL. Refusing.`)
  process.exit(1)
}
if (ENV === 'prod' && !DRY && !has('--yes')) {
  console.error('✗ --env=prod without --dry-run needs an explicit --yes.')
  process.exit(1)
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

// ── CSV ────────────────────────────────────────────────────────────────────
/** Minimal RFC4180 reader — the seed file has quoted commas in descriptions. */
function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((f) => f !== ''))
}

if (!existsSync(CSV)) {
  console.error(`✗ ${CSV} not found.`)
  process.exit(1)
}
const table = parseCsv(readFileSync(CSV, 'utf8'))
const header = table[0].map((h) => h.trim())
let records = table.slice(1).map((r) =>
  Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])),
)
if (LIMIT) records = records.slice(0, LIMIT)

// ── validate ───────────────────────────────────────────────────────────────
const valid = []
const rejected = []
const seen = new Map()

for (const rec of records) {
  const result = validateGameIdentity({
    name: rec.name,
    slug: rec.slug,
    ecosystem: rec.ecosystem,
    content_tier: rec.content_tier,
    categories: (rec.categories ?? '').split('|').filter(Boolean),
  })
  if (!result.ok) {
    rejected.push({ ...rec, reason: result.error })
    continue
  }
  const prior = seen.get(result.value.slug)
  if (prior) {
    rejected.push({ ...rec, reason: `Duplicate slug (first seen as "${prior}")` })
    continue
  }
  seen.set(result.value.slug, rec.name)
  valid.push({ ...result.value, raw: rec })
}

// ── alias/slug collision check (Step 1d · E3) ──────────────────────────────
// An alias that equals ANOTHER row's slug means two rows describe the same
// game under two identities — the duplicate class that had to be filtered by
// hand during the Step 1 ship. Fail loudly before touching the database
// rather than inserting the second identity.
const aliasCollisions = findAliasSlugCollisions(
  valid.map((v) => ({
    slug: v.slug,
    aliases: (v.raw.aliases ?? '').split('|').map((a) => a.trim()).filter(Boolean),
  })),
)
if (aliasCollisions.length) {
  console.error(`\n✗ ${aliasCollisions.length} alias/slug collision(s) — nothing written:`)
  for (const c of aliasCollisions) {
    console.error(`   "${c.slug}" aliases "${c.alias}", which is the slug of "${c.collidesWith}"`)
  }
  console.error('')
  process.exit(1)
}

// ── diff against the database ──────────────────────────────────────────────
const { data: existingRows, error: readErr } = await supabase
  .from('games')
  .select('id, slug, name, ecosystem, content_tier, source, is_active, description, image_url')
if (readErr) {
  console.error(`✗ Could not read games: ${readErr.message}`)
  process.exit(1)
}
const existing = new Map((existingRows ?? []).map((g) => [g.slug, g]))

/**
 * The exact row the seeder would write for a CSV record. Built ONCE here so
 * the dry-run diff and the real apply compare/write the same thing — the two
 * previously disagreed (the diff ignored description, the apply UPDATEd every
 * row unconditionally), which with the updated_at trigger would have bumped
 * <lastmod> on all 233 games on every run.
 */
function rowFor(v) {
  return {
    name: v.name,
    slug: v.slug,
    ecosystem: v.ecosystem,
    content_tier: v.content_tier,
    source: v.raw.source || 'seed-2026-09',
    description: v.raw.short_description || null,
    ...(v.raw.icon_url ? { image_url: v.raw.icon_url } : {}),
  }
}

/**
 * The row to WRITE for an existing game: rowFor() passed through the
 * fill-only merge, so name/description fill a blank production value but
 * never overwrite one someone has written by hand. See seed-merge.ts.
 */
function rowForExisting(v, e) {
  return mergeGameRow(rowFor(v), e)
}

/** True when at least one seeded column differs from what the DB holds. */
function hasChanges(v, e) {
  const r = rowForExisting(v, e)
  return Object.keys(r).some((k) => (e[k] ?? null) !== (r[k] ?? null))
}

const toInsert = valid.filter((v) => !existing.has(v.slug))
const toUpdate = valid.filter((v) => {
  const e = existing.get(v.slug)
  return e ? hasChanges(v, e) : false
})
const unchanged = valid.length - toInsert.length - toUpdate.length

console.log(`\n── seed:games  env=${ENV}  ${DRY ? '(DRY RUN — nothing written)' : '(APPLYING)'}`)
console.log(`   source file : ${CSV}`)
console.log(`   rows        : ${records.length}  valid ${valid.length}  rejected ${rejected.length}`)
console.log(`   games in DB : ${existing.size}`)
console.log(`   → insert    : ${toInsert.length}`)
console.log(`   → update    : ${toUpdate.length}`)
console.log(`   → unchanged : ${unchanged}\n`)

if (toInsert.length) {
  console.log('   INSERT');
  for (const v of toInsert.slice(0, 15)) console.log(`     + ${v.slug.padEnd(38)} ${v.ecosystem ?? '-'}  [${v.categories.join('|')}]`)
  if (toInsert.length > 15) console.log(`     … and ${toInsert.length - 15} more`)
  console.log('')
}
if (toUpdate.length) {
  console.log('   UPDATE');
  for (const v of toUpdate.slice(0, 15)) {
    const e = existing.get(v.slug)
    // rowForExisting, NOT rowFor: the preview must list the columns the
    // apply would actually write. With fill-only semantics those differ —
    // a protected non-empty name shows as changed under rowFor and is not.
    const r = rowForExisting(v, e)
    const changed = Object.keys(r).filter((k) => (e[k] ?? null) !== (r[k] ?? null))
    console.log(`     ~ ${v.slug.padEnd(38)} [${changed.join(', ')}]`)
  }
  if (toUpdate.length > 15) console.log(`     … and ${toUpdate.length - 15} more`)
  console.log('')
}

// ── rejects ────────────────────────────────────────────────────────────────
const REJECT_FILE = 'data/games-seed.rejected.csv'
if (rejected.length) {
  const cols = [...header, 'reason']
  const esc = (v) => (/[",\n]/.test(v ?? '') ? `"${String(v).replace(/"/g, '""')}"` : (v ?? ''))
  writeFileSync(
    REJECT_FILE,
    [cols.join(','), ...rejected.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n',
  )
  console.log(`   ⚠ ${rejected.length} rejected → ${REJECT_FILE}`)
  for (const r of rejected.slice(0, 10)) console.log(`     - ${r.slug || r.name}: ${r.reason}`)
  console.log('')
}

if (DRY) {
  console.log('   Dry run complete — no writes issued.\n')
  process.exit(0)
}

// ── apply ──────────────────────────────────────────────────────────────────
// Global categories, resolved once: the bridge maps a global slug to the
// legacy categories.metadata.type the marketplace renders from.
const GLOBAL_SLUG_TO_LEGACY_TYPE = {
  currency: 'currency', items: 'items', accounts: 'account',
  'top-up': 'top_up', boosting: 'service',
}
const LEGACY_DEFAULTS = {
  currency: { name: 'Currency', icon: '💰', description: 'In-game currency' },
  items:    { name: 'Items',    icon: '🎒', description: 'In-game items' },
  account:  { name: 'Accounts', icon: '👤', description: 'Game accounts' },
  top_up:   { name: 'Top Up',   icon: '⚡', description: 'Official top-ups' },
  service:  { name: 'Boosting', icon: '🚀', description: 'Boosting services' },
}
const LEGACY_SLUG = {
  currency: 'buy-currency', items: 'buy-items', account: 'buy-accounts',
  top_up: 'top-up', service: 'boosting',
}

const { data: globalCats } = await supabase
  .from('global_categories')
  .select('id, slug')
  .eq('is_active', true)
const globalBySlug = new Map((globalCats ?? []).map((c) => [c.slug, c.id]))

let inserted = 0, updated = 0, skipped = 0, catsLinked = 0, failed = 0
const failures = []

for (const v of valid) {
  const prior = existing.get(v.slug)
  // Inserts write the seeded row as-is; updates go through the fill-only
  // merge so hand-edited prose on production survives a re-run.
  const payload = prior ? rowForExisting(v, prior) : rowFor(v)
  let gameId = prior?.id

  if (prior && !hasChanges(v, prior)) {
    // Nothing to write. Skipping the UPDATE matters: the set_games_updated_at
    // trigger would otherwise stamp updated_at — and therefore the sitemap's
    // <lastmod> — on every game, every run.
    skipped++
  } else if (!prior) {
    const { data, error } = await supabase
      .from('games')
      .insert({ ...payload, is_active: true })
      .select('id')
      .single()
    if (error) {
      failed++; failures.push(`${v.slug}: ${error.message}`); continue
    }
    gameId = data.id; inserted++
  } else {
    const { error } = await supabase.from('games').update(payload).eq('id', prior.id)
    if (error) {
      failed++; failures.push(`${v.slug}: ${error.message}`); continue
    }
    updated++
  }

  // Enable each category on both sides of the bridge.
  for (const globalSlug of v.categories) {
    const legacyType = GLOBAL_SLUG_TO_LEGACY_TYPE[globalSlug]
    const globalId = globalBySlug.get(globalSlug)

    if (globalId) {
      const { data: pair } = await supabase
        .from('game_categories')
        .select('id')
        .eq('game_id', gameId)
        .eq('global_category_id', globalId)
        .maybeSingle()
      if (!pair) {
        await supabase.from('game_categories').insert({
          game_id: gameId, global_category_id: globalId, is_enabled: true,
        })
      }
    }

    // Legacy row — what /[game] and the sitemap actually read.
    const { data: matches } = await supabase
      .from('categories')
      .select('id, is_active')
      .eq('game_id', gameId)
      .filter('metadata->>type', 'eq', legacyType)
    if (!matches || matches.length === 0) {
      const d = LEGACY_DEFAULTS[legacyType]
      const { error } = await supabase.from('categories').insert({
        game_id: gameId,
        name: d.name,
        slug: LEGACY_SLUG[legacyType],
        icon: d.icon,
        description: d.description,
        display_order: 0,
        is_active: true,
        metadata: { type: legacyType },
      })
      if (!error) catsLinked++
    }
  }
}

console.log(`   ✓ inserted ${inserted}, updated ${updated}, unchanged ${skipped}, categories created ${catsLinked}`)
if (failed) {
  console.log(`   ✗ ${failed} failed:`)
  for (const f of failures.slice(0, 10)) console.log(`     - ${f}`)
}
console.log('')
process.exit(failed ? 1 : 0)
