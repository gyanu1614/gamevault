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
 * Categories are enabled through ensureGameCategory
 * (src/lib/categories/ensure.ts) — the same function the admin wizard calls —
 * so a seeded game is wired exactly like one created in the wizard. Only
 * game_categories is written (Step 1b); the legacy public.categories mirror
 * is a Phase-A DB trigger, not this script.
 *
 * Writes use the service-role key: public.games and public.game_categories
 * are RLS-protected and admin-only.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { validateGameIdentity } from '../src/lib/games/validate-game.ts'
import { mergeGameRow, findAliasSlugCollisions } from '../src/lib/games/seed-merge.ts'
import { ensureGameCategory } from '../src/lib/categories/ensure.ts'
import { getCanonicalCategorySlug } from '../src/lib/utils/category-canonical.ts'
import { DEFAULT_CURRENCY_CONFIG } from '../src/lib/types/category-configs.ts'

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

// ── category diff (dry-run + apply both report it) ─────────────────────────
// A pair counts as "to create" when the game is new, or exists without a
// game_categories row for that global slug. After the Step 1b migration a
// re-run against a seeded database must report 0 games / 0 categories.
const { data: existingPairs } = await supabase
  .from('game_categories')
  .select('game_id, global_category:global_categories!game_categories_global_category_id_fkey(slug)')
const pairSet = new Set((existingPairs ?? []).map((p) => `${p.game_id}|${p.global_category?.slug}`))
let pairsToCreate = 0
for (const v of valid) {
  const prior = existing.get(v.slug)
  for (const globalSlug of v.categories) {
    if (!prior || !pairSet.has(`${prior.id}|${globalSlug}`)) pairsToCreate++
  }
}
console.log(`   Categories: ${pairsToCreate} (game, category) pair(s) to create\n`)

if (DRY) {
  console.log('   Dry run complete — no writes issued.\n')
  process.exit(0)
}

// ── apply ──────────────────────────────────────────────────────────────────
const categoryDeps = { canonicalSlug: getCanonicalCategorySlug, currencyConfig: DEFAULT_CURRENCY_CONFIG }

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

  // Enable each category through the single creation path. Idempotent:
  // an existing pair is left exactly as the admin configured it.
  for (const globalSlug of v.categories) {
    try {
      const r = await ensureGameCategory(supabase, { gameId, globalSlug }, categoryDeps)
      if (r.created) catsLinked++
    } catch (e) {
      failed++
      failures.push(`${v.slug}/${globalSlug}: ${e?.message ?? e}`)
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
