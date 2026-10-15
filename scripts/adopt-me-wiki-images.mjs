#!/usr/bin/env node
/**
 * Give every Adopt Me pet with a broken image a copy from the Adopt Me Wiki.
 *
 * The catalog import stores adoptmevalues' CDN URL (/images/pets/<Name>.png),
 * which 404s for many new pets — 39 on 2026-10-14, mostly the newest. This
 * finds active pets whose image does not load, takes the wiki's picture for
 * the pet (scripts/lib/adoptme-wiki-images.mjs), saves a 512 px WebP to our
 * adopt-me-pets bucket at wiki/<slug>.webp and points image_url at it. Pages
 * credit the wiki under a copied image (src/lib/adopt-me/image-credit.ts).
 * Copies are never re-checked; a pet whose image loads is never touched.
 *
 *   pnpm adoptme:images --env=prod                 # dry run (public reads only)
 *   pnpm adoptme:images --write --env=prod --yes   # owner
 *   pnpm adoptme:images --write                    # weekly job (GitHub Actions)
 * Options: --slugs a,b   --limit N
 */
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import sharp from 'sharp'

import { valuesDbClient, selectAllRows } from './lib/values-db.mjs'
import { BUCKET, WIKI_UA, isOurCopy, resolveWikiImages, scaledWikiUrl, wikiImagePath } from './lib/adoptme-wiki-images.mjs'
import { catalogueGapSummary } from './lib/catalogue-new-only.mjs'

const argv = process.argv.slice(2)
const val = (name, fallback = null) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const flag = (name) => argv.includes(`--${name}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Does the image load? HEAD first; a server that refuses HEAD gets a GET. */
async function loads(url) {
  if (!url) return false
  try {
    let res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': 'Mozilla/5.0' } })
    if (res.status === 405) res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')
  } catch {
    return false
  }
}

async function brokenPets(pets) {
  const broken = []
  let next = 0
  async function worker() {
    while (next < pets.length) {
      const pet = pets[next++]
      if (!(await loads(pet.image_url))) broken.push(pet)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return broken.sort((a, b) => a.slug.localeCompare(b.slug))
}

async function summary(md) {
  console.log(md)
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, md + '\n', { flag: 'a' })
}

async function main() {
  const write = flag('write')
  const { db, url } = valuesDbClient({ env: val('env'), yes: flag('yes'), readOnly: !write })
  console.log(`${write ? 'Writing to' : 'Dry run against'} ${url}`)

  const only = val('slugs')?.split(',').map((s) => s.trim())
  let pets = await selectAllRows(() => db.from('adopt_me_pets').select('id,slug,name,image_url').eq('is_active', true), 'id')
  if (only) pets = pets.filter((p) => only.includes(p.slug))
  const candidates = pets.filter((p) => !isOurCopy(p.image_url))
  console.log(`${pets.length} active pets, ${pets.length - candidates.length} already on a wiki copy; checking ${candidates.length} images…`)

  const limit = Number(val('limit', '0'))
  let broken = await brokenPets(candidates)
  if (limit > 0) broken = broken.slice(0, limit)
  console.log(`${broken.length} with a broken image`)
  if (!broken.length) return summary(catalogueGapSummary('Adopt Me pets without an image', []))

  const { found, missing } = await resolveWikiImages(broken.map((p) => p.name))
  console.log(`wiki has ${found.size}; missing: ${missing.join(', ') || 'none'}`)

  if (!write) {
    for (const p of broken) console.log(`  ${p.slug.padEnd(24)} ${found.get(p.name) ? 'wiki ✓' : 'NOT ON WIKI'}`)
    console.log('Dry run — nothing copied. Pass --write (and --env=prod --yes off GitHub) to copy.')
    return
  }

  const publicPrefix = `${url}/storage/v1/object/public/${BUCKET}/`
  const failed = []
  let copied = 0
  for (const pet of broken) {
    const source = found.get(pet.name)
    if (!source) continue
    try {
      await sleep(500)
      const res = await fetch(scaledWikiUrl(source), { headers: { 'user-agent': WIKI_UA } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const webp = await sharp(Buffer.from(await res.arrayBuffer()))
        .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer()
      const path = wikiImagePath(pet.slug)
      const up = await db.storage.from(BUCKET).upload(path, webp, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' })
      if (up.error) throw new Error(up.error.message)
      const { error } = await db.from('adopt_me_pets').update({ image_url: `${publicPrefix}${path}` }).eq('id', pet.id)
      if (error) throw new Error(error.message)
      copied += 1
      console.log(`  ✓ ${pet.slug}`)
    } catch (e) {
      failed.push(pet.name)
      console.error(`  ✗ ${pet.slug}: ${e.message}`)
    }
  }
  console.log(`copied ${copied}, not on the wiki ${missing.length}, failed ${failed.length}`)
  await summary(catalogueGapSummary('Adopt Me pets without an image', [...missing, ...failed].sort()))
  if (failed.length) process.exitCode = 1
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
