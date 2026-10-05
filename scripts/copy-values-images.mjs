#!/usr/bin/env node
/**
 * Copy catalogue images from the source wiki into OUR public bucket
 * (`values-items`, created by migration 20261004235134) and point
 * values_items.image_url at the copy, with the CC-BY-SA credit line in
 * values_items.image_attribution. Pages never hot-link the wiki CDN.
 *
 * Reads data/values-catalogue/<game>/catalogue.json (from the catalogue
 * import). Dry run by default: prints what it would copy.
 *
 *   pnpm values:images --game=murder-mystery-2
 *   pnpm values:images --game=murder-mystery-2 --write --env=local
 *   pnpm values:images --game=murder-mystery-2 --write --env=prod --yes   # owner only
 *
 * Options: --limit N   --refresh (re-copy rows already pointing at the bucket)
 * Idempotent: rows whose image_url is already in the bucket are skipped.
 */
import fs from 'node:fs'
import process from 'node:process'

const BUCKET = 'values-items'
const DELAY_MS = 500
const MAX_BYTES = 1_048_576 // the bucket's file_size_limit
const UA = 'DropMarket-values-catalogue/1.0 (+https://dropmarket.gg)'
const EXT = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif' }

const argv = process.argv.slice(2)
const val = (name, fallback = null) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const flag = (name) => argv.includes(`--${name}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const scaled = (u) => (/\/revision\/latest(?!\/scale)/.test(u) ? u.replace('/revision/latest', '/revision/latest/scale-to-width-down/512') : u)

async function main() {
  const game = val('game')
  if (!game) throw new Error('--game=<slug> is required')
  const path = val('catalogue', `data/values-catalogue/${game}/catalogue.json`)
  if (!fs.existsSync(path)) throw new Error(`${path} not found — run the catalogue import first`)
  const { items } = JSON.parse(fs.readFileSync(path, 'utf8'))
  const limit = Number(val('limit', String(items.length)))
  const todo = items.filter((i) => i.imageSourceUrl && EXT[i.imageMime]).slice(0, limit)
  const unsupported = items.filter((i) => i.imageSourceUrl && !EXT[i.imageMime])
  console.log(`${game}: ${todo.length} images to copy (${items.length - todo.length - unsupported.length} without an image, ${unsupported.length} unsupported type)`)
  console.log(`  -> ${BUCKET}/${game}/<slug>.<ext>`)

  if (!flag('write')) {
    for (const i of todo.slice(0, 5)) console.log(`  ${i.slug}: ${i.imageSourceUrl}`)
    console.log('Dry run — nothing copied. Pass --write --env=local|prod to copy.')
    return
  }

  const { valuesDbClient, selectAllRows } = await import('./lib/values-db.mjs')
  const { db, url } = valuesDbClient({ env: val('env'), yes: flag('yes') })
  const { data: g } = await db.from('games').select('id').eq('slug', game).maybeSingle()
  if (!g) throw new Error(`game '${game}' not found`)
  const rows = await selectAllRows(() => db.from('values_items').select('id,slug,image_url').eq('game_id', g.id), 'id')
  const bySlug = new Map(rows.map((r) => [r.slug, r]))
  const publicPrefix = `${url}/storage/v1/object/public/${BUCKET}/`

  const stats = { copied: 0, skipped: 0, missingRow: 0, failed: 0 }
  for (const item of todo) {
    const row = bySlug.get(item.slug)
    if (!row) {
      stats.missingRow += 1
      continue
    }
    if (!flag('refresh') && row.image_url?.startsWith(publicPrefix)) {
      stats.skipped += 1
      continue
    }
    try {
      await sleep(DELAY_MS)
      // A 512 px rendition (Fandom's scaler): page-weight sized, and under the
      // bucket's 1 MB limit even for the 1.9 MB originals.
      const res = await fetch(scaled(item.imageSourceUrl), { headers: { 'user-agent': UA } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const bytes = Buffer.from(await res.arrayBuffer())
      if (bytes.length > MAX_BYTES) throw new Error(`${bytes.length} bytes > bucket limit`)
      const mime = res.headers.get('content-type')?.split(';')[0] ?? item.imageMime
      const ext = EXT[mime] ?? EXT[item.imageMime]
      const objectPath = `${game}/${item.slug}.${ext}`
      const up = await db.storage.from(BUCKET).upload(objectPath, bytes, { contentType: mime, upsert: true, cacheControl: '31536000' })
      if (up.error) throw new Error(up.error.message)
      const { error } = await db
        .from('values_items')
        .update({ image_url: `${publicPrefix}${objectPath}`, image_attribution: item.imageAttribution })
        .eq('id', row.id)
      if (error) throw new Error(error.message)
      stats.copied += 1
    } catch (e) {
      stats.failed += 1
      console.error(`  ✗ ${item.slug}: ${e.message}`)
    }
  }
  console.log(`copied ${stats.copied}, already in bucket ${stats.skipped}, no DB row ${stats.missingRow}, failed ${stats.failed}`)
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
