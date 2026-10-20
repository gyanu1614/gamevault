#!/usr/bin/env node
/**
 * Loads scripts/values-seeds/adopt-me.facts.json (built by
 * `pnpm am:facts:collect`) into adopt_me_pets:
 *   how_to_get     always (migration 20261019193145) — the wiki-cited entry;
 *   released_at,
 *   origin_type,
 *   origin_detail  only where the row has none — curated values are kept;
 *   obtainability  obtainable <-> unobtainable when the wiki disagrees. The
 *                  weekly catalogue import defaults new pets to 'obtainable'
 *                  (its source publishes no availability) and never touches
 *                  an existing pet's value, so the wiki's is the better one.
 *                  'limited' rows and an 'unknown' wiki status are left alone.
 *
 * Idempotent: every entry is validated first, then written by slug; rows that
 * already match are skipped. A slug missing from adopt_me_pets is reported.
 *
 *   pnpm am:facts:import                          # dry run (validate only)
 *   pnpm am:facts:import --env=prod --yes         # diff against prod
 *   pnpm am:facts:import --write --env=prod --yes # owner only
 *
 * Then revalidate: /api/internal/values-revalidate?game=adopt-me
 */
import fs from 'node:fs'
import process from 'node:process'
import { canon, howToGetErrors, isText, toStoredHowToGet } from './lib/how-to-get-seed.mjs'

const FILE = 'scripts/values-seeds/adopt-me.facts.json'

const argv = process.argv.slice(2)
const val = (name) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}
const flag = (name) => argv.includes(`--${name}`)

function validate(entries) {
  if (!Array.isArray(entries)) throw new Error(`${FILE}: expected an array`)
  const errors = []
  const seen = new Set()
  entries.forEach((e, n) => {
    const at = `#${n} ${e?.slug ?? '?'}`
    if (!isText(e?.slug) || !/^[a-z0-9-]+$/.test(e.slug)) errors.push(`${at}: bad slug`)
    else if (seen.has(e.slug)) errors.push(`${at}: duplicate slug`)
    else seen.add(e.slug)
    if (e?.released_at != null && !/^\d{4}-\d{2}-\d{2}$/.test(e.released_at)) errors.push(`${at}: released_at must be YYYY-MM-DD or null`)
    if (e?.origin_type != null && !['egg', 'event'].includes(e.origin_type)) errors.push(`${at}: origin_type must be egg|event|null`)
    if (e?.origin_detail != null && !isText(e.origin_detail)) errors.push(`${at}: origin_detail must be text or null`)
    if (e?.how_to_get != null) errors.push(...howToGetErrors(e.how_to_get, `${at} how_to_get`))
  })
  if (errors.length) throw new Error(`${FILE}: ${errors.length} invalid entr${errors.length === 1 ? 'y' : 'ies'}\n  ${errors.join('\n  ')}`)
}

/** The update for one row: only what changes, never overwriting a curated fact. */
function patchFor(row, e) {
  const patch = {}
  const how = e.how_to_get ? toStoredHowToGet(e.how_to_get) : null
  if (how && canon(row.how_to_get ?? null) !== canon(how)) patch.how_to_get = how
  if (!row.released_at && e.released_at) patch.released_at = e.released_at
  if (!row.origin_detail && e.origin_detail) {
    patch.origin_detail = e.origin_detail.trim()
    if (!row.origin_type && e.origin_type) patch.origin_type = e.origin_type
  }
  const wiki = e.how_to_get?.status
  if ((wiki === 'obtainable' || wiki === 'unobtainable') && (row.obtainability === 'obtainable' || row.obtainability === 'unobtainable') && row.obtainability !== wiki) {
    patch.obtainability = wiki
  }
  return patch
}

async function main() {
  const entries = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  validate(entries)
  const n = (f) => entries.filter(f).length
  console.log(`${FILE}: ${entries.length} entries valid · release date ${n((e) => e.released_at)} · origin ${n((e) => e.origin_detail)} · How To Get ${n((e) => e.how_to_get)}`)

  const write = flag('write')
  if (!val('env')) {
    if (write) throw new Error('--write needs --env=local|prod')
    console.log('\nDry run — validated only. Pass --env=local|prod to diff against a DB, plus --write to persist.')
    return
  }

  const { valuesDbClient, selectAllRows } = await import('./lib/values-db.mjs')
  const { db, url } = valuesDbClient({ env: val('env'), yes: flag('yes') })
  console.log(`${write ? 'Writing to' : 'Diffing against'} ${url}`)
  const rows = await selectAllRows(() => db.from('adopt_me_pets').select('id,slug,released_at,origin_type,origin_detail,obtainability,how_to_get'), 'id')
  const bySlug = new Map(rows.map((r) => [r.slug, r]))

  const missing = []
  const changes = []
  const tally = { how_to_get: 0, released_at: 0, origin_detail: 0, obtainability: 0 }
  for (const e of entries) {
    const row = bySlug.get(e.slug)
    if (!row) {
      missing.push(e.slug)
      continue
    }
    const patch = patchFor(row, e)
    if (Object.keys(patch).length === 0) continue
    for (const k of Object.keys(tally)) if (k in patch) tally[k] += 1
    changes.push({ id: row.id, slug: e.slug, patch })
  }

  if (write) {
    for (const c of changes) {
      const { error } = await db.from('adopt_me_pets').update(c.patch).eq('id', c.id)
      if (error) throw new Error(`adopt_me_pets ${c.slug}: ${error.message}`)
    }
  }
  console.log(`${write ? 'Updated' : 'Would update'} ${changes.length} pets`, tally, `· missing ${missing.length}`)
  const flips = changes.filter((c) => c.patch.obtainability).map((c) => `${c.slug}→${c.patch.obtainability}`)
  if (flips.length) console.log(`  availability changes (${flips.length}): ${flips.slice(0, 30).join(', ')}${flips.length > 30 ? ' …' : ''}`)
  if (missing.length) console.log(`  not in adopt_me_pets: ${missing.slice(0, 20).join(', ')}`)
  if (write) console.log('\nNow revalidate: /api/internal/values-revalidate?game=adopt-me')
  else console.log('\nDry run — nothing written. Pass --write to persist.')
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
