#!/usr/bin/env node
/**
 * Loads the verified Murder Mystery 2 "How To Get" facts into
 * values_items.how_to_get (migration 20261005004438), so a re-check ships
 * without a deploy. Source: scripts/values-seeds/murder-mystery-2.how-to-get.json
 * (the README next to it has the method and the sources).
 *
 * Idempotent: every entry is validated first (one bad entry fails the run
 * before anything is written), then written by slug for the MM2 game only,
 * and rows whose stored value already matches are left alone.
 *
 *   pnpm values:mm2:how-to-get                          # dry run (validate + diff)
 *   pnpm values:mm2:how-to-get --write --env=local
 *   pnpm values:mm2:how-to-get --write --env=prod --yes # owner only
 *
 * Run it AFTER the catalogue import (pnpm values:mm2:catalogue --write): it
 * only updates existing rows, and a slug missing from values_items is
 * reported, never created. Then revalidate the hub (values-revalidate) so
 * cached item pages pick it up.
 */
import fs from 'node:fs'
import process from 'node:process'

const GAME = 'murder-mystery-2'
const FILE = `scripts/values-seeds/${GAME}.how-to-get.json`
const STATUSES = new Set(['obtainable', 'unobtainable', 'unknown', 'seasonal'])
const CONFIDENCE = new Set(['high', 'medium', 'low'])
const OPTIONAL = ['costs', 'odds', 'released', 'note']

const argv = process.argv.slice(2)
const val = (name, fallback = null) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const flag = (name) => argv.includes(`--${name}`)

const isText = (v) => typeof v === 'string' && v.trim().length > 0

/** The stored object: the entry minus its key fields, keys in a fixed order. */
function toStored(e) {
  const out = { status: e.status, method: e.method.trim() }
  for (const k of OPTIONAL) if (isText(e[k])) out[k] = e[k].trim()
  out.sources = e.sources
  out.confidence = e.confidence
  out.checked_at = e.checked_at
  return out
}

function validate(entries) {
  if (!Array.isArray(entries)) throw new Error(`${FILE}: expected an array`)
  const errors = []
  const seen = new Set()
  entries.forEach((e, n) => {
    const at = `#${n} ${e?.slug ?? '?'}`
    if (!isText(e?.slug) || !/^[a-z0-9-]+$/.test(e.slug)) errors.push(`${at}: bad slug`)
    else if (seen.has(e.slug)) errors.push(`${at}: duplicate slug`)
    else seen.add(e.slug)
    if (!STATUSES.has(e?.status)) errors.push(`${at}: status must be ${[...STATUSES].join('|')}`)
    if (!isText(e?.method)) errors.push(`${at}: method is required`)
    for (const k of OPTIONAL) if (e?.[k] != null && typeof e[k] !== 'string') errors.push(`${at}: ${k} must be a string`)
    if (!Array.isArray(e?.sources) || !e.sources.length || !e.sources.every((s) => /^https:\/\/\S+$/.test(s)))
      errors.push(`${at}: sources must be a non-empty list of https URLs`)
    if (!CONFIDENCE.has(e?.confidence)) errors.push(`${at}: confidence must be ${[...CONFIDENCE].join('|')}`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e?.checked_at ?? '')) errors.push(`${at}: checked_at must be YYYY-MM-DD`)
  })
  if (errors.length) throw new Error(`${FILE}: ${errors.length} invalid entr${errors.length === 1 ? 'y' : 'ies'}\n  ${errors.join('\n  ')}`)
}

/** Key-order-independent equality for the stored JSON. */
const canon = (v) =>
  Array.isArray(v)
    ? `[${v.map(canon).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`
      : JSON.stringify(v)

async function main() {
  const entries = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  validate(entries)
  const byStatus = {}
  for (const e of entries) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1
  console.log(`${FILE}: ${entries.length} entries valid`, byStatus)

  const write = flag('write')
  if (!write && !val('env')) {
    console.log('\nDry run — validated only. Pass --env=local|prod to diff against a DB, plus --write to persist.')
    return
  }

  const { valuesDbClient, selectAllRows } = await import('./lib/values-db.mjs')
  const { db, url } = valuesDbClient({ env: val('env'), yes: flag('yes') })
  console.log(`${write ? 'Writing to' : 'Diffing against'} ${url}`)
  const { data: game, error: gErr } = await db.from('games').select('id').eq('slug', GAME).maybeSingle()
  if (gErr) throw gErr
  if (!game) throw new Error(`game '${GAME}' not found`)

  const rows = await selectAllRows(() => db.from('values_items').select('id,slug,how_to_get').eq('game_id', game.id), 'id')
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
    const next = toStored(e)
    if (row.how_to_get && canon(row.how_to_get) === canon(next)) unchanged += 1
    else changed.push({ id: row.id, slug: e.slug, next })
  }

  if (write) {
    for (const c of changed) {
      const { error } = await db.from('values_items').update({ how_to_get: c.next }).eq('id', c.id).eq('game_id', game.id)
      if (error) throw new Error(`values_items ${c.slug}: ${error.message}`)
    }
  }
  console.log(`${write ? 'Updated' : 'Would update'} ${changed.length}, unchanged ${unchanged}, missing ${missing.length}.`)
  if (missing.length) console.log(`  not in values_items (run the catalogue import first): ${missing.join(', ')}`)
  if (!write) console.log('\nDry run — nothing written. Pass --write to persist.')
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
