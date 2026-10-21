#!/usr/bin/env node
/**
 * Builds scripts/values-seeds/steal-a-brainrot.facts.json — every brainrot's
 * shared facts (release date, origin, How To Get) — from the Steal a Brainrot
 * wiki (stealabrainrot.fandom.com, CC BY-SA; each entry links its page). The
 * parsing is src/lib/sab/wiki-facts.ts (unit-tested); this file only fetches.
 *
 *   pnpm sab:facts:collect      # writes the seed file; review the diff, then
 *   pnpm sab:facts:import       # dry run → --env=prod --write --yes (owner)
 *
 * Reads: the brainrot list through the PUBLIC anon key in .env.local (read
 * only — the same rows the value pages show), then the wiki's API: page
 * content in batches of 50 by page id, one request a second, plus the Update
 * Log (update number → date). Nothing is written to any database.
 */
import fs from 'node:fs'
import { config as loadEnv } from 'dotenv'
import { buildSabFacts, parseUpdateLog } from '../src/lib/sab/wiki-facts.ts'

const OUT = 'scripts/values-seeds/steal-a-brainrot.facts.json'
const API = 'https://stealabrainrot.fandom.com/api.php'
const UA = 'DropMarketBot/1.0 (+https://dropmarket.gg; value pages, 1 req/s)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function wiki(params) {
  const res = await fetch(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`wiki ${res.status}: ${JSON.stringify(params).slice(0, 120)}`)
  return res.json()
}

async function brainrots() {
  loadEnv({ path: '.env.local', quiet: true })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('.env.local needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (read only)')
  const rows = []
  for (let from = 0; ; from += 1000) {
    const q = 'select=slug,source_url,source_page_id,source_payload->source_categories&order=slug'
    const res = await fetch(`${url}/rest/v1/sab_brainrots?${q}&offset=${from}&limit=1000`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    if (!res.ok) throw new Error(`sab_brainrots ${res.status}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < 1000) break
  }
  return rows.filter((r) => r.source_page_id && r.source_url)
}

async function main() {
  const rows = await brainrots()
  console.log(`${rows.length} brainrots with a wiki page`)
  const texts = new Map()
  const ids = rows.map((r) => r.source_page_id)
  for (let i = 0; i < ids.length; i += 50) {
    const d = await wiki({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', pageids: ids.slice(i, i + 50).join('|') })
    for (const p of d.query?.pages ?? []) texts.set(p.pageid, p.revisions?.[0]?.slots?.main?.content ?? '')
    await sleep(1100)
  }
  const log = await wiki({ action: 'parse', page: 'Update_Log', prop: 'wikitext' })
  const updates = parseUpdateLog(log.parse?.wikitext ?? '')
  if (updates.size < 10) throw new Error(`Update Log parsed to ${updates.size} updates — the page changed shape; not writing`)

  const checkedAt = new Date().toISOString().slice(0, 10)
  const facts = rows.map((r) =>
    buildSabFacts({ slug: r.slug, pageUrl: r.source_url, text: texts.get(r.source_page_id) ?? '', categories: r.source_categories ?? [], updates, checkedAt }),
  )
  fs.writeFileSync(OUT, `${JSON.stringify(facts, null, 2)}\n`)
  const n = (f) => facts.filter(f).length
  const byStatus = {}
  for (const f of facts) if (f.how_to_get) byStatus[f.how_to_get.status] = (byStatus[f.how_to_get.status] ?? 0) + 1
  console.log(`${OUT}: ${facts.length} brainrots · release date ${n((f) => f.released_at)} · origin ${n((f) => f.origin)} · How To Get ${n((f) => f.how_to_get)}`, byStatus)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
