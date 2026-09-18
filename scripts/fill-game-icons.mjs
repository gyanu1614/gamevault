#!/usr/bin/env node
/**
 * Phase 1 · Step 1e — game icon filler.
 *
 *   pnpm icons:fill --env=local              # dry run (default), writes nothing
 *   pnpm icons:fill --env=local --yes        # apply
 *   pnpm icons:fill --env=prod  --dry-run
 *   pnpm icons:fill --env=prod  --yes        # owner only
 *   pnpm icons:fill --env=local --refresh    # also re-fetch stale AUTOMATED icons
 *   pnpm icons:fill --env=local --force blox-fruits --yes   # overwrite one game
 *
 * A thin caller. All fetch/match/resize/upload logic lives in
 * src/lib/games/icons.ts (fetchGameIcon), so Phase 2's trend radar fills a
 * newly discovered game's icon through the same seam.
 *
 * Column: public.games.image_url — the logo column the admin wizard writes.
 * There is no games.icon_url; that name is only a header in
 * data/games-seed.csv, which the seeder maps onto image_url.
 *
 * Fill-only. A game that already has an icon is skipped unless --refresh
 * (automated icons past 30 days, NEVER a manual upload) or --force <slug>.
 *
 * Writes use the service-role key: public.games is RLS-protected/admin-only.
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import {
  fetchGameIcon,
  decideFill,
  REFRESH_AFTER_DAYS,
} from '../src/lib/games/icons.ts'

// ── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
/**
 * A flag that takes a value in EITHER form: `--force=slug` or `--force slug`.
 * The step spec writes `--force <slug>`; --env=x is the other convention in
 * this repo. Accepting both stops a space-form value being silently dropped
 * and the run widening to every game.
 */
const flagValue = (name) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3) || null
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}

const ENV = val('env', '')
const APPLY = has('--yes')
const DRY = !APPLY // dry-run is the DEFAULT; --yes is the only way to write
const REFRESH = has('--refresh')
const FORCE = flagValue('force')
const LIMIT = Number(val('limit', '0')) || 0
const ONLY = flagValue('only') // optional slug filter, for spot-checks
const OUT = flagValue('out') ?? 'growth/icons-match.csv'

if (!['local', 'prod'].includes(ENV)) {
  console.error('✗ --env=local or --env=prod is required (no default, on purpose).')
  process.exit(1)
}

// ── env ────────────────────────────────────────────────────────────────────
// local → .env.test (local stack), prod → .env.local (production + live keys)
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

// Guard: --env=prod must point at a remote project and --env=local must not.
const isLocalUrl = /(?:localhost|127\.0\.0\.1)/.test(URL)
if (ENV === 'local' && !isLocalUrl) {
  console.error(`✗ --env=local but ${ENV_FILE} points at ${URL}. Refusing.`)
  process.exit(1)
}
if (ENV === 'prod' && isLocalUrl) {
  console.error(`✗ --env=prod but ${ENV_FILE} points at a local URL. Refusing.`)
  process.exit(1)
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

// ── read ───────────────────────────────────────────────────────────────────
const PROVENANCE_COLS = 'id, slug, name, ecosystem, image_url, image_source, image_synced_at'
const LEGACY_COLS = 'id, slug, name, ecosystem, image_url'

let { data: games, error: readErr } = await supabase
  .from('games')
  .select(PROVENANCE_COLS)
  .order('slug')

// The provenance columns arrive in migration 20260917161845. Before it is
// applied, a DRY RUN can still preview matches from the legacy columns —
// that preview is exactly what the owner needs in order to decide to apply
// the migration. An APPLY still requires them, because it writes them.
let provenanceMissing = false
if (readErr && /image_source|image_synced_at/.test(readErr.message)) {
  if (!DRY) {
    console.error(`✗ Could not read games: ${readErr.message}`)
    console.error('   The provenance columns are missing — apply migration')
    console.error('   supabase/migrations/20260917161845_game_icon_provenance.sql first.')
    process.exit(1)
  }
  provenanceMissing = true
  ;({ data: games, error: readErr } = await supabase
    .from('games')
    .select(LEGACY_COLS)
    .order('slug'))
}
if (readErr) {
  console.error(`✗ Could not read games: ${readErr.message}`)
  process.exit(1)
}
if (provenanceMissing) {
  console.log('\n   ⚠ Provenance columns not present yet — previewing from image_url alone.')
  console.log('     Apply supabase/migrations/20260917161845_game_icon_provenance.sql before --yes.')
}

let pool = games ?? []
// An EMPTY --only (e.g. `--only ''` from a shell variable that came back
// blank) must not silently widen the run to the whole catalogue.
if (ONLY !== null && String(ONLY).trim() === '') {
  console.error("✗ --only was given an empty value. Refusing to run over the full catalogue.")
  process.exit(1)
}
if (ONLY) {
  pool = pool.filter((g) => g.slug === ONLY)
  if (pool.length === 0) {
    console.error(`✗ --only ${ONLY} matched no game. Refusing to run over the full catalogue.`)
    process.exit(1)
  }
}
if (FORCE && !(games ?? []).some((g) => g.slug === FORCE)) {
  console.error(`✗ --force ${FORCE} matched no game.`)
  process.exit(1)
}

const decisions = pool.map((g) => ({ game: g, decision: decideFill(g, { refresh: REFRESH, forceSlug: FORCE }) }))
let todo = decisions.filter((d) => d.decision.fill).map((d) => d.game)
const skipped = decisions.filter((d) => !d.decision.fill)
if (LIMIT) todo = todo.slice(0, LIMIT)

const robloxCount = todo.filter((g) => (g.ecosystem ?? '').toLowerCase() === 'roblox').length
const otherCount = todo.length - robloxCount

console.log(`\n── icons:fill  env=${ENV}  ${DRY ? '(DRY RUN — nothing written)' : '(APPLYING)'}`)
console.log(`   games in DB : ${(games ?? []).length}`)
console.log(`   already ok  : ${skipped.length}  (${skipped.filter((s) => s.decision.reason === 'manual').length} manual-protected)`)
console.log(`   → to fill   : ${todo.length}   roblox ${robloxCount}  other ${otherCount}`)
if (REFRESH) console.log(`   refresh     : automated icons older than ${REFRESH_AFTER_DAYS}d`)
if (FORCE) console.log(`   force       : ${FORCE}`)
if (otherCount > 0) {
  console.log(`   sources     : roblox | non-roblox → App Store, then Steam (both keyless)`)
}
console.log('')

// ── fill ───────────────────────────────────────────────────────────────────
const results = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/**
 * Politeness delay between games. Roblox is unmetered but not free; Apple
 * asks for roughly 20 calls/minute on the iTunes search API, and a
 * non-Roblox game can cost two search calls (App Store, then Steam).
 * 3s keeps a non-Roblox run inside Apple's guidance.
 */
const PACE_OVERRIDE = Number(val('pace', '')) || 0
/** Roblox: unmetered, one call per game. */
const PACE_ROBLOX_MS = PACE_OVERRIDE || 350
/**
 * Non-Roblox: Apple asks for roughly 20 iTunes-search calls per minute, and
 * a miss costs a Steam call too. 3s/game stays inside that.
 */
const PACE_OTHER_MS = PACE_OVERRIDE || 3000

for (const [i, game] of todo.entries()) {
  const label = `[${String(i + 1).padStart(3)}/${todo.length}] ${game.slug.padEnd(38)}`

  // Dry run still MATCHES (that is the point of the preview) but never
  // encodes or uploads: pass a storage double that refuses to be called.
  const storage = DRY
    ? {
        from: () => ({
          upload: async () => {
            throw new Error('dry-run: upload attempted')
          },
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        }),
      }
    : supabase.storage

  const res = DRY
    ? await dryMatch(game)
    : await fetchGameIcon(game, {
        storage,
        hashBytes: (b) => createHash('sha256').update(b).digest('hex'),
      })

  results.push(res)

  if (res.status === 'filled' && !DRY) {
    const { error: updErr } = await supabase
      .from('games')
      .update({
        image_url: res.iconUrl,
        image_source: res.source,
        image_synced_at: new Date().toISOString(),
      })
      .eq('id', game.id)
    if (updErr) {
      res.status = 'error'
      res.error = `db update: ${updErr.message}`
    }
  }

  const mark =
    res.status === 'filled' ? '✓' :
    res.status === 'ambiguous' ? '?' :
    res.status === 'unmatched' ? '·' : '✗'
  const detail =
    res.status === 'filled' || res.status === 'matched'
      ? `${res.source} ${(res.confidence ?? 0).toFixed(2)} "${res.matchedTitle ?? ''}"`
      : res.status === 'ambiguous'
        ? `${(res.candidates ?? []).map((c) => `"${c.title}"`).join(' | ')}`
        : (res.error ?? res.status)
  console.log(`   ${mark} ${label} ${detail}`)

  await sleep((game.ecosystem ?? '').toLowerCase() === 'roblox' ? PACE_ROBLOX_MS : PACE_OTHER_MS)
}

/**
 * Dry run: run the real match, stop before download/encode/upload. Reports
 * exactly what an apply would match, without producing bytes.
 */
async function dryMatch(game) {
  const { searchRobloxGames, searchAppStoreGames, searchSteamGames, decideMatch } = await import(
    '../src/lib/games/icons.ts'
  )
  const isRoblox = (game.ecosystem ?? '').toLowerCase() === 'roblox'
  const chain = isRoblox
    ? [['roblox', searchRobloxGames]]
    : [
        ['appstore', searchAppStoreGames],
        ['steam', searchSteamGames],
      ]

  let best = null
  for (const [source, search] of chain) {
    try {
      const d = decideMatch(game.name, await search(game.name))
      if (d.status === 'matched') {
        return {
          slug: game.slug,
          status: 'filled', // would fill
          source,
          matchedTitle: d.best.title,
          confidence: d.confidence,
          iconUrl: '(dry-run)',
        }
      }
      // Ambiguity is a refusal — stop, exactly as fetchGameIcon does.
      if (d.status === 'ambiguous') {
        return {
          slug: game.slug,
          status: 'ambiguous',
          source,
          confidence: d.confidence,
          candidates: d.candidates,
        }
      }
      if (!best || (d.confidence ?? 0) > (best.confidence ?? 0)) {
        best = { slug: game.slug, status: 'unmatched', source, confidence: d.confidence, candidates: d.candidates }
      }
    } catch (e) {
      if (!best) best = { slug: game.slug, status: 'error', source, error: e.message }
    }
  }
  return best ?? { slug: game.slug, status: 'unmatched', confidence: 0 }
}

// ── match log ──────────────────────────────────────────────────────────────
const esc = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const lines = ['slug,source,matched_title,confidence,icon_url,status,candidates']
for (const r of results) {
  lines.push(
    [
      esc(r.slug),
      esc(r.source ?? ''),
      esc(r.matchedTitle ?? ''),
      esc(r.confidence != null ? r.confidence.toFixed(3) : ''),
      esc(r.iconUrl ?? ''),
      esc(r.status === 'filled' && DRY ? 'would-fill' : r.status),
      esc((r.candidates ?? []).map((c) => c.title).join(' | ') || (r.error ?? '')),
    ].join(','),
  )
}
const outDir = OUT.includes('/') ? OUT.slice(0, OUT.lastIndexOf('/')) : ''
if (outDir) mkdirSync(outDir, { recursive: true })
writeFileSync(OUT, lines.join('\n') + '\n')

// ── summary ────────────────────────────────────────────────────────────────
const by = (s) => results.filter((r) => r.status === s).length
const filled = by('filled')
const rate = results.length ? ((filled / results.length) * 100).toFixed(1) : '0.0'

console.log(`\n── summary`)
console.log(`   ${DRY ? 'would fill' : 'filled'}  : ${filled} / ${results.length}  (${rate}%)`)
console.log(`   ambiguous  : ${by('ambiguous')}`)
console.log(`   unmatched  : ${by('unmatched')}`)
console.log(`   errors     : ${by('error')}`)
console.log(`   match log  : ${OUT}`)
if (DRY) console.log(`\n   DRY RUN — nothing was written. Re-run with --yes to apply.\n`)
else console.log('')
