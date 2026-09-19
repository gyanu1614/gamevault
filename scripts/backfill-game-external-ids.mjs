#!/usr/bin/env node
/**
 * Backfill game_external_ids (platform=roblox) for the catalogue.
 *
 *   pnpm radar:backfill --env=local              # dry run (default), writes nothing
 *   pnpm radar:backfill --env=local --yes        # apply
 *   pnpm radar:backfill --env=prod               # owner: preview
 *   pnpm radar:backfill --env=prod --yes         # owner: apply
 *   pnpm radar:backfill --env=local --only steal-a-brainrot
 *
 * Why re-resolve: growth/icons-match.csv (Step 1e) kept the MATCHED TITLE but
 * not the universe id, so ids come from omni-search again — by the exact
 * title 1e matched when it has one, else by the catalogue name. A duplicate
 * title is resolved to the busier universe (current playerCount from the
 * live sorts call, else one games-API batch) and flagged `ambiguous` in the
 * report — never left unkeyed. Games with no acceptable match are listed
 * for the admin and skipped.
 *
 * Safety: dry-run is the default and --yes is the only way to write; the
 * env guard refuses a local URL under --env=prod and vice versa; existing
 * rows are never overwritten (insert with ON CONFLICT DO NOTHING semantics
 * via a pre-read). Roblox calls are paced at 1 req/s with the same circuit
 * breaker as the routes.
 */
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import {
  ACCEPT_THRESHOLD,
  decideMatch,
  scoreCandidate,
  searchRobloxGames,
} from '../src/lib/games/icons.ts'
import { createPacer, fetchGameMetrics, fetchSorts, RobloxThrottleTripped } from '../src/lib/trend-radar/roblox.ts'
import { resolveUniverse } from '../src/lib/trend-radar/resolve.ts'

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const flagValue = (name) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}

const ENV = flagValue('env') ?? ''
const APPLY = has('--yes')
const DRY = !APPLY
const ONLY = flagValue('only')
const OUT = flagValue('out') ?? 'growth/external-ids-backfill.csv'
const MATCH_CSV = flagValue('match-csv') ?? 'growth/icons-match.csv'

if (!['local', 'prod'].includes(ENV)) {
  console.error('✗ --env=local or --env=prod is required (no default, on purpose).')
  process.exit(1)
}
if (argv.includes('--only') && !ONLY) {
  console.error('✗ --only given without a slug. Refusing (an empty filter would widen the run).')
  process.exit(1)
}

// ── env ────────────────────────────────────────────────────────────────────
const ENV_FILE = ENV === 'local' ? '.env.test' : '.env.local'
if (!existsSync(ENV_FILE)) {
  console.error(`✗ ${ENV_FILE} not found — cannot resolve credentials for --env=${ENV}.`)
  process.exit(1)
}
loadEnv({ path: ENV_FILE })
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
if (!URL || !KEY) {
  console.error(`✗ ${ENV_FILE} is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.`)
  process.exit(1)
}
const isLocalUrl = /(?:localhost|127\.0\.0\.1)/.test(URL)
if (ENV === 'local' && !isLocalUrl) { console.error(`✗ --env=local but ${ENV_FILE} points at ${URL}. Refusing.`); process.exit(1) }
if (ENV === 'prod' && isLocalUrl) { console.error(`✗ --env=prod but ${ENV_FILE} points at a local URL. Refusing.`); process.exit(1) }

const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

// ── 1e match log: slug → matched_title (for filled roblox rows) ────────────
const matchedTitle = new Map()
if (existsSync(MATCH_CSV)) {
  const lines = readFileSync(MATCH_CSV, 'utf8').split('\n').slice(1)
  for (const line of lines) {
    // slug,source,matched_title,confidence,icon_url,status,candidates — titles can contain commas; take the first two fields and the third up to the confidence field.
    const m = line.match(/^([^,]*),([^,]*),(.*),(\d\.\d{3}),/)
    if (m && m[2] === 'roblox' && m[3]) matchedTitle.set(m[1], m[3].replace(/^"|"$/g, ''))
  }
}

// ── read catalogue ─────────────────────────────────────────────────────────
const { data: games, error: ge } = await supabase
  .from('games')
  .select('id, slug, name, ecosystem')
  .eq('ecosystem', 'roblox')
  .order('slug')
if (ge) { console.error(`✗ games read failed: ${ge.message}`); process.exit(1) }
const { data: existingRows, error: xe } = await supabase
  .from('game_external_ids')
  .select('game_id, external_id')
  .eq('platform', 'roblox')
if (xe) { console.error(`✗ game_external_ids read failed: ${xe.message}`); process.exit(1) }
const existing = new Map((existingRows ?? []).map((r) => [r.game_id, r.external_id]))
const takenIds = new Set((existingRows ?? []).map((r) => r.external_id))

let targets = (games ?? []).filter((g) => !existing.has(g.id))
if (ONLY) {
  targets = targets.filter((g) => g.slug === ONLY)
  if (targets.length === 0) { console.error(`✗ --only ${ONLY}: no unkeyed roblox game with that slug. Nothing to do.`); process.exit(1) }
}

console.log(`\n── radar:backfill  env=${ENV}  ${DRY ? '(DRY RUN — nothing written)' : '(APPLY)'}`)
console.log(`   roblox games   : ${(games ?? []).length}`)
console.log(`   already keyed  : ${existing.size}`)
console.log(`   to resolve     : ${targets.length}${ONLY ? `  (--only ${ONLY})` : ''}`)
console.log(`   1e titles      : ${matchedTitle.size} from ${MATCH_CSV}\n`)

// ── live playerCounts for tie-breaks (one sorts call) ─────────────────────
const pacer = createPacer()
const matcher = { decideMatch, scoreCandidate, acceptThreshold: ACCEPT_THRESHOLD }
let playingById = new Map()
try {
  const sorts = await fetchSorts({ pacer })
  for (const g of [...sorts.topPlayingNow, ...sorts.topTrending, ...sorts.upAndComing]) playingById.set(g.universeId, g.playerCount)
  console.log(`   sorts          : ${sorts.endpoint} (${playingById.size} universes with live playerCount)\n`)
} catch (e) {
  console.warn(`   sorts          : unavailable (${e?.message ?? e}) — ties fall back to a games-API batch\n`)
}

// ── resolve ────────────────────────────────────────────────────────────────
const rows = []
let resolved = 0, ambiguous = 0, unmatched = 0, errors = 0
for (const g of targets) {
  const title = matchedTitle.get(g.slug) ?? g.name
  try {
    const choice = await resolveUniverse(title, {
      search: (q) => searchRobloxGames(q),
      playingById,
      fetchPlaying: async (ids) => new Map((await fetchGameMetrics(ids, { pacer })).map((r) => [r.universeId, r.playing])),
      matcher,
    })
    await pacer.wait() // omni-search is a Roblox call too: keep the 1 req/s cap
    if (!choice) {
      unmatched++
      rows.push({ slug: g.slug, title, universe_id: '', matched_title: '', confidence: '', status: 'unmatched', note: '' })
      console.log(`   ✗ ${g.slug.padEnd(38)} unmatched  ("${title}")`)
      continue
    }
    if (takenIds.has(String(choice.universeId))) {
      errors++
      rows.push({ slug: g.slug, title, universe_id: choice.universeId, matched_title: choice.matchedTitle, confidence: choice.confidence.toFixed(3), status: 'conflict', note: 'universe already keyed to another game' })
      console.log(`   ! ${g.slug.padEnd(38)} ${choice.universeId} already belongs to another game — skipped`)
      continue
    }
    takenIds.add(String(choice.universeId))
    if (choice.ambiguous) ambiguous++
    resolved++
    rows.push({
      slug: g.slug, title, universe_id: choice.universeId, matched_title: choice.matchedTitle, confidence: choice.confidence.toFixed(3),
      status: choice.ambiguous ? 'ambiguous' : 'resolved',
      note: choice.ambiguous ? `tie broken by playerCount (${choice.playerCountKnown ? 'known' : 'unknown → first'}): ${choice.candidates.map((c) => `${c.universeId}=${c.playing ?? '?'}`).join(' | ')}` : '',
    })
    console.log(`   ${choice.ambiguous ? '~' : '✓'} ${g.slug.padEnd(38)} ${String(choice.universeId).padEnd(12)} ${choice.matchedTitle}${choice.ambiguous ? '  [ambiguous]' : ''}`)
    if (!DRY) {
      const { error } = await supabase.from('game_external_ids').insert({ game_id: g.id, platform: 'roblox', external_id: String(choice.universeId) })
      if (error) { errors++; console.log(`     write failed: ${error.message}`) }
    }
  } catch (e) {
    if (e instanceof RobloxThrottleTripped) {
      console.error(`\n✗ Roblox throttle tripped (${e.hits}× 429). Stopping cleanly; re-run in a few minutes — it resumes from what is still unkeyed.`)
      break
    }
    errors++
    rows.push({ slug: g.slug, title, universe_id: '', matched_title: '', confidence: '', status: 'error', note: e?.message ?? String(e) })
    console.log(`   ! ${g.slug.padEnd(38)} error: ${e?.message ?? e}`)
  }
}

// ── report ─────────────────────────────────────────────────────────────────
const dir = OUT.split('/').slice(0, -1).join('/')
if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
const csv = ['slug,title,universe_id,matched_title,confidence,status,note', ...rows.map((r) =>
  [r.slug, r.title, r.universe_id, r.matched_title, r.confidence, r.status, r.note].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
writeFileSync(OUT, csv)

console.log(`\n── summary`)
console.log(`   resolved   : ${resolved} (${ambiguous} ambiguous, tie-broken)`)
console.log(`   unmatched  : ${unmatched}`)
console.log(`   errors     : ${errors}`)
console.log(`   report     : ${OUT}`)
console.log(DRY ? `\n   DRY RUN — nothing was written. Re-run with --yes to apply.\n` : `\n   Applied.\n`)
