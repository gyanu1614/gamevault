#!/usr/bin/env node
/**
 * Loads the researched Murder Mystery 2 events into public.values_events
 * (migration 20261005232558), so a new or corrected event ships without a
 * deploy. Source: scripts/values-seeds/murder-mystery-2.events.json (the README
 * next to it has the method, the sources and the uncertain entries).
 *
 * Idempotent: every event is validated first (one bad entry fails the run
 * before anything is written), then upserted by (game, slug); rows whose
 * stored content already matches are left alone. Events missing from the file
 * are reported, never deleted.
 *
 *   pnpm values:mm2:events                          # dry run (validate only)
 *   pnpm values:mm2:events --env=prod               # diff against prod
 *   pnpm values:mm2:events --write --env=local
 *   pnpm values:mm2:events --write --env=prod --yes # owner / release step
 *
 * Then revalidate the hub (values-revalidate?game=murder-mystery-2&full=1) so
 * cached event pages pick it up.
 */
import fs from 'node:fs'
import process from 'node:process'

const GAME = 'murder-mystery-2'
const FILE = `scripts/values-seeds/${GAME}.events.json`
const SEASONS = new Set(['halloween', 'christmas', 'easter', 'valentines', 'summer', 'anniversary', 'collab', 'other'])
const STATUSES = new Set(['ended', 'live', 'upcoming'])
const CONFIDENCE = new Set(['high', 'medium', 'low'])
const DATE = /^\d{4}-\d{2}-\d{2}$/

const argv = process.argv.slice(2)
const val = (name, fallback = null) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const flag = (name) => argv.includes(`--${name}`)
const isText = (v) => typeof v === 'string' && v.trim().length > 0
const textOrNull = (v) => (isText(v) ? v.trim() : null)

function validate(events) {
  if (!Array.isArray(events)) throw new Error(`${FILE}: expected an array`)
  const errors = []
  const seen = new Set()
  events.forEach((e, n) => {
    const at = `#${n} ${e?.slug ?? '?'}`
    if (!isText(e?.slug) || !/^[a-z0-9-]+$/.test(e.slug)) errors.push(`${at}: bad slug`)
    else if (seen.has(e.slug)) errors.push(`${at}: duplicate slug`)
    else seen.add(e.slug)
    if (!isText(e?.name)) errors.push(`${at}: name is required`)
    if (!SEASONS.has(e?.season)) errors.push(`${at}: season must be ${[...SEASONS].join('|')}`)
    if (!Number.isInteger(e?.year) || e.year < 2012 || e.year > 2100) errors.push(`${at}: bad year`)
    if (!STATUSES.has(e?.status)) errors.push(`${at}: status must be ${[...STATUSES].join('|')}`)
    for (const k of ['starts_on', 'ends_on']) if (e?.[k] != null && !DATE.test(e[k])) errors.push(`${at}: ${k} must be YYYY-MM-DD or null`)
    if (e?.starts_on && e?.ends_on && e.ends_on < e.starts_on) errors.push(`${at}: ends before it starts`)
    if (!isText(e?.summary)) errors.push(`${at}: summary is required`)
    if (!Array.isArray(e?.items)) errors.push(`${at}: items must be an array`)
    else
      e.items.forEach((it, k) => {
        if (!isText(it?.name)) errors.push(`${at}: items[${k}] needs a name`)
        if (it?.slug != null && !/^[a-z0-9-]+$/.test(it.slug)) errors.push(`${at}: items[${k}] bad slug`)
      })
    if (!Array.isArray(e?.sources) || !e.sources.every((s) => /^https:\/\/\S+$/.test(s)))
      errors.push(`${at}: sources must be a list of https URLs`)
    if (e?.status !== 'upcoming' && (!Array.isArray(e?.sources) || !e.sources.length)) errors.push(`${at}: needs a source`)
    if (!CONFIDENCE.has(e?.confidence)) errors.push(`${at}: confidence must be ${[...CONFIDENCE].join('|')}`)
    if (!DATE.test(e?.checked_at ?? '')) errors.push(`${at}: checked_at must be YYYY-MM-DD`)
  })
  if (errors.length) throw new Error(`${FILE}: ${errors.length} invalid entr${errors.length === 1 ? 'y' : 'ies'}\n  ${errors.join('\n  ')}`)
}

/** The stored row (content columns only). */
function toRow(e, gameId) {
  return {
    game_id: gameId,
    slug: e.slug,
    name: e.name.trim(),
    season: e.season,
    year: e.year,
    status: e.status,
    starts_on: e.starts_on ?? null,
    ends_on: e.ends_on ?? null,
    currency: textOrNull(e.currency),
    format: textOrNull(e.format),
    summary: e.summary.trim(),
    how_items_were_obtained: textOrNull(e.how_items_were_obtained),
    items: e.items.map((it) => ({
      name: it.name.trim(),
      slug: it.slug ?? null,
      kind: textOrNull(it.kind),
      rarity: textOrNull(it.rarity),
      how: textOrNull(it.how),
    })),
    sources: e.sources,
    confidence: e.confidence,
    checked_at: e.checked_at,
  }
}

/** Key-order-independent equality. */
const canon = (v) =>
  Array.isArray(v)
    ? `[${v.map(canon).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`
      : JSON.stringify(v)

const CONTENT = ['name', 'season', 'year', 'status', 'starts_on', 'ends_on', 'currency', 'format', 'summary', 'how_items_were_obtained', 'items', 'sources', 'confidence', 'checked_at']
const pick = (r) => Object.fromEntries(CONTENT.map((k) => [k, r[k] ?? null]))

async function main() {
  const events = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  validate(events)
  const bySeason = {}
  for (const e of events) bySeason[e.season] = (bySeason[e.season] ?? 0) + 1
  console.log(`${FILE}: ${events.length} events valid`, bySeason)

  const write = flag('write')
  if (!write && !val('env')) {
    console.log('\nDry run — validated only. Pass --env=local|prod to diff against a DB, plus --write to persist.')
    return
  }

  const { valuesDbClient } = await import('./lib/values-db.mjs')
  const { db, url } = valuesDbClient({ env: val('env'), yes: flag('yes') })
  console.log(`${write ? 'Writing to' : 'Diffing against'} ${url}`)
  const { data: game, error: gErr } = await db.from('games').select('id').eq('slug', GAME).maybeSingle()
  if (gErr) throw gErr
  if (!game) throw new Error(`game '${GAME}' not found`)

  const { data: existing, error: eErr } = await db.from('values_events').select('*').eq('game_id', game.id)
  if (eErr) throw new Error(`values_events: ${eErr.message} (is migration 20261005232558 pushed?)`)
  const bySlug = new Map((existing ?? []).map((r) => [r.slug, r]))

  const upserts = []
  let unchanged = 0
  for (const e of events) {
    const row = toRow(e, game.id)
    const cur = bySlug.get(e.slug)
    if (cur && canon(pick(cur)) === canon(pick(row))) unchanged += 1
    else upserts.push(row)
  }
  const fileSlugs = new Set(events.map((e) => e.slug))
  const notInFile = [...bySlug.keys()].filter((s) => !fileSlugs.has(s))

  if (write && upserts.length) {
    const { error } = await db.from('values_events').upsert(upserts, { onConflict: 'game_id,slug' })
    if (error) throw new Error(`values_events upsert: ${error.message}`)
  }
  console.log(`${write ? 'Upserted' : 'Would upsert'} ${upserts.length}, unchanged ${unchanged}.`)
  if (notInFile.length) console.log(`  in the DB but not in the file (left alone): ${notInFile.join(', ')}`)
  if (!write) console.log('\nDry run — nothing written. Pass --write to persist.')
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
