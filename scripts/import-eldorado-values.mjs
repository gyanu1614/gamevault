#!/usr/bin/env node
/**
 * Import an `eldorado-structured` feed into values_raw_listings.
 * Dry run by default (matches against the local catalogue JSON + alias seed);
 * --write matches against the database catalogue and inserts.
 *
 *   pnpm values:eldorado:import --game=murder-mystery-2
 *   pnpm values:eldorado:import --game=murder-mystery-2 --write --env=local
 *   pnpm values:eldorado:import --game=murder-mystery-2 --write --env=prod --yes   # owner only
 *
 * Options: --feed <path> (default data/values-feeds/<game>/eldorado-latest.json)
 *          --catalogue <path>  --allow-partial
 */
import { readFile } from 'node:fs/promises'
import process from 'node:process'

import { importEldoradoFeed } from './lib/values-import.mjs'

const argv = process.argv.slice(2)
const val = (name, fallback = null) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const flag = (name) => argv.includes(`--${name}`)

async function main() {
  const game = val('game')
  if (!game) throw new Error('--game=<slug> is required')
  const feedPath = val('feed', `data/values-feeds/${game}/eldorado-latest.json`)
  const feed = JSON.parse(await readFile(feedPath, 'utf8'))
  if (feed.gameSlug !== game) throw new Error(`feed is for "${feed.gameSlug}", not "${game}"`)
  await importEldoradoFeed({
    game,
    feed,
    env: val('env'),
    yes: flag('yes'),
    write: flag('write'),
    allowPartial: flag('allow-partial'),
    cataloguePath: val('catalogue') ?? undefined,
  })
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
