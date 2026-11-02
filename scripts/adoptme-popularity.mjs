#!/usr/bin/env node
/**
 * Daily Adopt Me popularity: rank every pet by how many different sellers list
 * it now (scripts/lib/adoptme-popularity.mjs) and store it in
 * adopt_me_pets.demand_rank. Runs in the Adopt Me job of values-pricing-daily
 * right after the raw listings import, before the reprice, so the publish
 * step's list refresh shows the new order. Dry run by default.
 *
 *   pnpm adoptme:popularity --env=local                 # dry run
 *   pnpm adoptme:popularity --env=local --write
 *   pnpm adoptme:popularity --env=prod --yes --write    # owner only
 *   pnpm adoptme:popularity --write                     # GitHub Actions
 *
 * Reads two columns of the active raw listings (paged) and the pets; writes
 * only the pets whose rank changed.
 */
import process from 'node:process'
import { planRankUpdates, rankPetsBySellers } from './lib/adoptme-popularity.mjs'
import { selectAllRows, valuesDbClient } from './lib/values-db.mjs'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const val = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
const WRITE = flag('write')
const CONCURRENCY = 4

async function main() {
  // Service role even for a dry run: the raw listings are not public.
  const { db, url } = valuesDbClient({ env: val('env'), yes: flag('yes') })
  const listings = await selectAllRows(
    () => db.from('adopt_me_market_raw_listings').select('id,pet_id,seller_id').eq('listing_status', 'active'),
    'id',
  )
  const pets = await selectAllRows(() => db.from('adopt_me_pets').select('id,name,demand_rank'), 'id')
  const ranks = rankPetsBySellers(listings)
  const updates = planRankUpdates(pets, ranks)

  const name = new Map(pets.map((p) => [p.id, p.name]))
  const top = [...ranks.entries()].sort((a, b) => a[1] - b[1]).slice(0, 15)
  console.log(`${url}: ${listings.length} active listings → ${ranks.size} of ${pets.length} pets ranked`)
  console.log(`  top: ${top.map(([id, r]) => `${r}. ${name.get(id) ?? id}`).join(' · ')}`)
  console.log(`  ${updates.length} rank(s) to change${WRITE ? '' : ' (dry run: add --write)'}`)
  if (!WRITE || updates.length === 0) return

  const queue = [...updates]
  async function worker() {
    for (let u = queue.shift(); u; u = queue.shift()) {
      const { error } = await db.from('adopt_me_pets').update({ demand_rank: u.to }).eq('id', u.id)
      if (error) throw new Error(`${u.name}: ${error.message}`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`  ✅ ${updates.length} rank(s) written`)
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
