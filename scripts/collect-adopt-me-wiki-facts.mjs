#!/usr/bin/env node
/**
 * Builds scripts/values-seeds/adopt-me.facts.json — every active pet's shared
 * facts (release date, origin, How To Get, availability) — from the Adopt Me
 * wiki (adoptme.fandom.com, CC BY-SA; each entry links its page). The parsing
 * is src/lib/adopt-me/wiki-facts.ts (unit-tested); this file only fetches.
 *
 *   pnpm am:facts:collect      # writes the seed file; review the diff, then
 *   pnpm am:facts:import       # dry run → --env=prod --write --yes (owner)
 *
 * Reads: the pet list through the PUBLIC anon key in .env.local (read only),
 * then the wiki's API — page content + categories for 50 titles a request
 * (redirects followed), one request a second. Nothing is written to any DB.
 */
import fs from 'node:fs'
import { config as loadEnv } from 'dotenv'
import { buildAdoptMeFacts } from '../src/lib/adopt-me/wiki-facts.ts'

const OUT = 'scripts/values-seeds/adopt-me.facts.json'
const API = 'https://adoptme.fandom.com/api.php'
const UA = 'DropMarketBot/1.0 (+https://dropmarket.gg; value pages, 1 req/s)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function pets() {
  loadEnv({ path: '.env.local', quiet: true })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('.env.local needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (read only)')
  const res = await fetch(`${url}/rest/v1/adopt_me_pets?select=slug,name,obtainability&is_active=eq.true&order=slug&limit=5000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`adopt_me_pets ${res.status}`)
  return res.json()
}

/** One batch of titles → { title → { text, cats } } plus the name → final-title map; follows category continuation. */
async function fetchBatch(titles) {
  const pages = new Map()
  const alias = new Map()
  let cont = {}
  for (let round = 0; round < 10; round++) {
    const q = new URLSearchParams({
      action: 'query', prop: 'revisions|categories', rvprop: 'content', rvslots: 'main', cllimit: 'max', redirects: '1',
      titles: titles.join('|'), format: 'json', formatversion: '2', ...cont,
    })
    const res = await fetch(`${API}?${q}`, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`wiki ${res.status}`)
    const d = await res.json()
    for (const n of [...(d.query?.normalized ?? []), ...(d.query?.redirects ?? [])]) alias.set(n.from, n.to)
    for (const p of d.query?.pages ?? []) {
      const prev = pages.get(p.title) ?? { text: null, cats: [] }
      pages.set(p.title, {
        text: prev.text ?? p.revisions?.[0]?.slots?.main?.content ?? null,
        cats: [...prev.cats, ...(p.categories ?? []).map((c) => c.title)],
      })
    }
    await sleep(1100)
    if (!d.continue) break
    // Only the category list continues; the page text came with the first round.
    cont = { ...d.continue }
  }
  return { pages, alias }
}

async function main() {
  const rows = await pets()
  console.log(`${rows.length} active pets`)
  const pages = new Map()
  const alias = new Map()
  for (let i = 0; i < rows.length; i += 50) {
    const b = await fetchBatch(rows.slice(i, i + 50).map((r) => r.name))
    for (const [k, v] of b.pages) pages.set(k, v)
    for (const [k, v] of b.alias) alias.set(k, v)
  }
  const resolve = (name) => {
    let t = name
    for (let k = 0; k < 3 && alias.has(t); k++) t = alias.get(t)
    return t
  }
  const checkedAt = new Date().toISOString().slice(0, 10)
  const facts = []
  const missing = []
  for (const r of rows) {
    const title = resolve(r.name)
    const page = pages.get(title)
    if (!page?.text) {
      missing.push(r.name)
      continue
    }
    const pageUrl = `https://adoptme.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
    facts.push(buildAdoptMeFacts({ slug: r.slug, name: r.name, pageUrl, text: page.text, categories: page.cats, dbObtainability: r.obtainability, checkedAt }))
  }
  fs.writeFileSync(OUT, `${JSON.stringify(facts, null, 2)}\n`)
  const n = (f) => facts.filter(f).length
  const byStatus = {}
  for (const f of facts) if (f.how_to_get) byStatus[f.how_to_get.status] = (byStatus[f.how_to_get.status] ?? 0) + 1
  console.log(`${OUT}: ${facts.length} pets · release date ${n((f) => f.released_at)} · origin ${n((f) => f.origin_detail)} · How To Get ${n((f) => f.how_to_get)}`, byStatus)
  if (missing.length) console.log(`  no wiki page (${missing.length}): ${missing.join(', ')}`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
