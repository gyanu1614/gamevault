#!/usr/bin/env node
/**
 * Loads scripts/values-seeds/steal-a-brainrot.facts.json (built by
 * `pnpm sab:facts:collect`) into sab_brainrots.released_at / origin /
 * how_to_get (migration 20261020180531), so the value pages show the shared
 * facts and a re-check ships without a deploy.
 *
 * Idempotent: every entry is validated first (one bad entry fails the run
 * before anything is written), then written by slug, and rows whose stored
 * facts already match are left alone. A slug missing from sab_brainrots is
 * reported, never created.
 *
 *   pnpm sab:facts:import                          # dry run (validate only)
 *   pnpm sab:facts:import --env=prod --yes         # diff against prod
 *   pnpm sab:facts:import --write --env=prod --yes # owner only
 *
 * Then revalidate the hub so cached item pages pick it up:
 *   /api/internal/values-revalidate?game=steal-a-brainrot
 */
import fs from 'node:fs'
import process from 'node:process'
import { canon, howToGetErrors, isText, toStoredHowToGet } from './lib/how-to-get-seed.mjs'

const FILE = 'scripts/values-seeds/steal-a-brainrot.facts.json'

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
    if (e?.origin != null && !isText(e.origin)) errors.push(`${at}: origin must be text or null`)
    if (e?.how_to_get != null) errors.push(...howToGetErrors(e.how_to_get, `${at} how_to_get`))
  })
  if (errors.length) throw new Error(`${FILE}: ${errors.length} invalid entr${errors.length === 1 ? 'y' : 'ies'}\n  ${errors.join('\n  ')}`)
}

/** The three stored columns for one entry. */
const toRow = (e) => ({
  released_at: e.released_at ?? null,
  origin: e.origin?.trim() || null,
  how_to_get: e.how_to_get ? toStoredHowToGet(e.how_to_get) : null,
})

async function main() {
  const entries = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  validate(entries)
  const n = (f) => entries.filter(f).length
  console.log(`${FILE}: ${entries.length} entries valid · release date ${n((e) => e.released_at)} · origin ${n((e) => e.origin)} · How To Get ${n((e) => e.how_to_get)}`)

  const write = flag('write')
  if (!val('env')) {
    if (write) throw new Error('--write needs --env=local|prod')
    console.log('\nDry run — validated only. Pass --env=local|prod to diff against a DB, plus --write to persist.')
    return
  }

  const { valuesDbClient, selectAllRows } = await import('./lib/values-db.mjs')
  const { db, url } = valuesDbClient({ env: val('env'), yes: flag('yes') })
  console.log(`${write ? 'Writing to' : 'Diffing against'} ${url}`)
  const rows = await selectAllRows(() => db.from('sab_brainrots').select('id,slug,released_at,origin,how_to_get'), 'id')
  const bySlug = new Map(rows.map((r) => [r.slug, r]))

  const missing = []
  const changed = []
  let unchanged = 0
  for (const e of entries) {
    const row = bySlug.get(e.slug)
    if (!row) {
      missing.push(e.slug)
      continue
    }
    const next = toRow(e)
    const same = (row.released_at ?? null) === next.released_at && (row.origin ?? null) === next.origin && canon(row.how_to_get ?? null) === canon(next.how_to_get)
    if (same) unchanged += 1
    else changed.push({ id: row.id, slug: e.slug, next })
  }

  if (write) {
    for (const c of changed) {
      const { error } = await db.from('sab_brainrots').update(c.next).eq('id', c.id)
      if (error) throw new Error(`sab_brainrots ${c.slug}: ${error.message}`)
    }
  }
  console.log(`${write ? 'Updated' : 'Would update'} ${changed.length}, unchanged ${unchanged}, missing ${missing.length}.`)
  if (missing.length) console.log(`  not in sab_brainrots: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ' …' : ''}`)
  if (write) console.log('\nNow revalidate: /api/internal/values-revalidate?game=steal-a-brainrot')
  else console.log('\nDry run — nothing written. Pass --write to persist.')
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
