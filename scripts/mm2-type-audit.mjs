#!/usr/bin/env node
/**
 * MM2 item types vs the wiki, re-read with the catalogue's own parser
 * (buildMm2Catalogue: title → opening sentence → infobox).
 *
 *   pnpm mm2:type-audit --env=prod --yes            # list the differences (reads only)
 *   pnpm mm2:type-audit --env=prod --yes --write    # fix them + refresh those value pages
 *
 * Why: the catalogue is insert-only, so a type the wiki got wrong when an item
 * was added stays wrong. On 2026-11-02 Sand, Tourist, Serpent, Scarytree and
 * Chroma Ornament were stored as guns (their infobox said Gun / "Godly") while
 * each page's opening sentence, and Eldorado, said knife; their Eldorado
 * listings matched nothing. The parser now trusts the opening sentence; this
 * re-checks the rows that already exist. A chroma whose type changes is
 * re-linked to its base of the new type.
 */
import process from 'node:process'
import { createWikiClient } from '../src/lib/catalogue/wiki.ts'
import { buildMm2Catalogue } from '../src/lib/values/catalogue/mm2-wiki.ts'
import { httpRevalidator } from '../src/lib/pricing/publish.ts'
import { valuesDbClient } from './lib/values-db.mjs'

const GAME = 'murder-mystery-2'
const argv = process.argv.slice(2)
const val = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
const flag = (name) => argv.includes(`--${name}`)

async function all(build) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

const lead = (text, title) => {
  const name = title.replace(/\s*\([^)]*\)\s*$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').match(new RegExp(`'''${name}'''\\s+(?:is|was)\\s+an?\\s+[^.\\n]{0,60}`, 'i'))
  return m ? m[0].replace(/'''/g, '') : '(no opening sentence)'
}

async function main() {
  const write = flag('write')
  const { db, url } = valuesDbClient({ env: val('env') ?? undefined, yes: flag('yes') })
  console.log(`${write ? 'Fixing' : 'Checking'} MM2 item types in ${url}`)
  const { data: game } = await db.from('games').select('id').eq('slug', GAME).single()
  const items = await all(() => db.from('values_items').select('id,slug,name,wiki_title,item_type,base_item_id').eq('game_id', game.id).not('wiki_title', 'is', null).order('slug'))
  const refs = await all(() => db.from('catalogue_refs').select('page_id,item_slug').eq('game_slug', GAME).eq('status', 'item').order('page_id'))
  const pageBySlug = new Map(refs.map((r) => [r.item_slug, Number(r.page_id)]))

  const wiki = createWikiClient({ host: 'murder-mystery-2.fandom.com' })
  const pages = await wiki.fetchPages([...new Set(items.map((i) => pageBySlug.get(i.slug)).filter(Boolean))])
  const textByTitle = new Map(pages.map((p) => [p.title.toLowerCase(), p.content]))
  for (const i of items) {
    if (!textByTitle.has(i.wiki_title.toLowerCase())) textByTitle.set(i.wiki_title.toLowerCase(), await wiki.wikitext(i.wiki_title).catch(() => ''))
  }

  const diffs = []
  for (const i of items) {
    const text = textByTitle.get(i.wiki_title.toLowerCase())
    if (!text) continue
    const parsed = buildMm2Catalogue([{ title: i.wiki_title, wikitext: text }]).items[0]
    if (parsed?.itemType && parsed.itemType !== i.item_type) diffs.push({ item: i, to: parsed.itemType, why: lead(text, i.wiki_title) })
  }
  console.log(`${items.length} items read (${wiki.requests()} wiki requests); ${diffs.length} stored with a type the wiki page contradicts:`)
  for (const d of diffs) console.log(`  ${d.item.name}: ${d.item.item_type} → ${d.to}   "${d.why}"`)
  if (!write || !diffs.length) return

  const bySlug = new Map(items.map((i) => [i.slug, i]))
  const typeOf = new Map(items.map((i) => [i.slug, i.item_type]))
  for (const d of diffs) typeOf.set(d.item.slug, d.to)
  const word = { knife: 'Knife', gun: 'Gun', pet: 'Pet' }
  for (const d of diffs) {
    const patch = { item_type: d.to }
    const base = d.item.name.match(/^chroma\s+(.+)$/i)?.[1]
    if (base) {
      // Same rule as the catalogue's chroma link: "<base>" or "<base> (<Type>)", of the new type.
      const slug = [base, `${base} (${word[d.to]})`].map((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).find((s) => bySlug.has(s) && typeOf.get(s) === d.to)
      patch.base_item_id = slug ? bySlug.get(slug).id : null
    }
    const { error } = await db.from('values_items').update(patch).eq('id', d.item.id)
    if (error) throw new Error(`${d.item.slug}: ${error.message}`)
    console.log(`  fixed ${d.item.name}${'base_item_id' in patch ? (patch.base_item_id ? ' (+ chroma base)' : ' (no base of that type)') : ''}`)
  }
  const secret = process.env.VALUES_REVALIDATE_SECRET
  const siteUrl = process.env.PUBLIC_API_URL || 'https://dropmarket.gg'
  if (secret && !/localhost|127\.0\.0\.1/.test(url)) {
    await httpRevalidator({ baseUrl: siteUrl, secret })({ gameSlug: GAME, changedSlugs: diffs.map((d) => d.item.slug) })
    console.log('  value pages refreshed')
  }
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
