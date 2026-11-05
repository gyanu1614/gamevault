#!/usr/bin/env node
/**
 * Add Adopt Me's eggs and potions to the market catalogue: one adopt_me_pets row
 * (is_active = false) and one finished picture each, from a report the owner has
 * checked. Insert-only: a row already there is left alone. Dry run by default.
 *
 *   pnpm adoptme:market-items --env=local --report <report.json>
 *   pnpm adoptme:market-items --env=local --report <report.json> --write
 *   pnpm adoptme:market-items --env=prod --yes --report <report.json> --write   # owner only
 *
 * Afterwards: `pnpm adoptme:popularity` ranks them with the pets, and
 * /api/internal/values-revalidate?game=adopt-me puts them on the page.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { marketImagePath, marketRow, planMarketItems } from './lib/adoptme-market-items.mjs'
import { BUCKET } from './lib/adoptme-wiki-images.mjs'
import { selectAllRows, valuesDbClient } from './lib/values-db.mjs'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const val = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : (argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null)
}

async function main() {
  const reportPath = val('report')
  if (!reportPath) throw new Error('--report <report.json> is required')
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  const { db, url } = valuesDbClient({ env: val('env'), yes: flag('yes') })

  const existing = await selectAllRows(() => db.from('adopt_me_pets').select('slug'), 'slug')
  const { rows, skipped } = planMarketItems(report, new Set(existing.map((r) => r.slug)), (file) => fs.readFileSync(path.join(path.dirname(reportPath), file)))
  console.log(`${url}: ${rows.length} to add, ${skipped.length} already there`)
  console.log(rows.map((r) => r.name).join(', '))
  if (!flag('write')) {
    console.log('Dry run. Add --write to apply.')
    return
  }

  const publicPrefix = `${url}/storage/v1/object/public/${BUCKET}/`
  let added = 0
  for (const row of rows) {
    const up = await db.storage.from(BUCKET).upload(marketImagePath(row.slug), row.bytes, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' })
    if (up.error) throw new Error(`${row.slug}: upload failed: ${up.error.message}`)
    const { data, error } = await db.from('adopt_me_pets').upsert(marketRow(row, publicPrefix), { onConflict: 'slug', ignoreDuplicates: true }).select('slug')
    if (error) throw new Error(`${row.slug}: ${error.message}`)
    added += data?.length ?? 0
  }
  console.log(`Added ${added}.`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
