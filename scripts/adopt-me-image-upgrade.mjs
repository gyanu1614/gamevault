#!/usr/bin/env node
/**
 * One look for every Adopt Me pet picture: a 512×512 transparent WebP, trimmed
 * to the pet and centred with the same padding. DRY RUN by default: public
 * reads only, and nothing is written except files in --out.
 *
 * For each pet it compares the live picture with the Adopt Me Wiki's best
 * clean cut-out (the infobox file, File:<Name>.png, page images, then any
 * other wiki file named after the pet) and normalises the better one
 * (scripts/lib/adoptme-image-upgrade.mjs; the wiki wins ties):
 *   upgrade    the wiki render is better than the live picture
 *   normalise  as good as the live one; re-framed to match the rest
 *   low-res    the best there is is under 256 px (an upscaling candidate)
 *   no-picture nothing usable
 * It writes report.json + report.csv (with "check" where the colours differ
 * from the live picture), contact-sheet.png (16 new pictures, most popular
 * first), and every download, so --reuse <earlier --out> skips them next time.
 *
 * The pet list is the public search index (<site>/adopt-me/search.json, most
 * popular first): no database is read. Requests go one at a time, at most 2 a
 * second (the wiki API at most 1 a second), with a descriptive User-Agent.
 *
 *   pnpm adoptme:images:upgrade --all --out <dir> [--reuse <earlier dir>]
 *   pnpm adoptme:images:upgrade --limit 60 --names "Parrot,Shadow Dragon" --out <dir>
 *   pnpm adoptme:images:upgrade --apply --env=local --report <dir>/report.json
 *   pnpm adoptme:images:upgrade --apply --env=prod --yes --report <dir>/report.json   # owner only
 *
 * --apply (scripts/lib/adoptme-image-apply.mjs) uploads the report's files
 * (checked by sha256) to adopt-me-pets/wiki/hd/<slug>.webp (wiki pictures;
 * credited) or hd/<slug>.webp (any other source; only with
 * --include-third-party), and sets image_url only where it still equals what
 * the dry run saw.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

import { firstImageFile } from '../src/lib/catalogue/files.ts'
import { unpack } from '../src/lib/serialize/columnar.ts'
import { templateBody, templateParams } from '../src/lib/wiki/markup.ts'
import { applyRows, planApply, REPORT_TOOL, REPORT_VERSION, sha256 } from './lib/adoptme-image-apply.mjs'
import {
  CANDIDATE_FLOOR,
  COLOUR_CHECK,
  INNER,
  choosePicture,
  colourGap,
  contactSheet,
  detailScore,
  effectiveQuality,
  fileMatchesPet,
  hdImagePath,
  normalisePetImage,
  petFileIndex,
  pngRenditionUrl,
  rankSources,
  renderProblem,
  renderQuality,
  sourceKind,
  toCsv,
  visibleColour,
} from './lib/adoptme-image-upgrade.mjs'
import { BUCKET, finalTitles, wikiApi } from './lib/adoptme-wiki-images.mjs'

const argv = process.argv.slice(2)
const val = (name, fallback = null) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const flag = (name) => argv.includes(`--${name}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const UA = 'DropMarketBot/1.0 (+https://dropmarket.gg; Adopt Me pet image upgrade, max 2 req/s)'
const SITE = val('site', 'https://dropmarket.gg')
const OUT = path.resolve(val('out', 'data/adopt-me-image-upgrade'))
const PETS_PER_QUERY = 25 // two titles each: "Name" and "Name (Pet)"
const MAX_DOWNLOADS = 4 // wiki files tried per pet
const UPSCALE_NOTE = 1.25
const SHEET_TILES = 16
const COLUMNS = [
  'slug', 'name', 'action', 'source_kind', 'reason', 'check', 'current_url', 'current_size', 'source_via', 'source_file',
  'source_url', 'source_size', 'trimmed_size', 'scale', 'detail_gain', 'upload_path', 'out_file', 'out_sha256',
]

/** One request at a time: ≥ 500 ms apart overall, ≥ 1 s apart on the wiki API. */
let lastAny = 0
const lastLane = new Map()
async function pace(lane) {
  const wait = Math.max(lastAny + 500, (lastLane.get(lane) ?? 0) + (lane === 'api' ? 1000 : 500)) - Date.now()
  if (wait > 0) await sleep(wait)
  lastAny = Date.now()
  lastLane.set(lane, lastAny)
}

/** Paced GET; a 429 / 5xx / network error is retried twice after a pause. */
async function get(url, lane) {
  for (let attempt = 0; ; attempt += 1) {
    await pace(lane)
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) }).catch(() => ({ ok: false, status: 0 }))
    if ((res.status === 0 || res.status === 429 || res.status >= 500) && attempt < 2) await sleep(3000 * (attempt + 1))
    else return res
  }
}
const api = (params) => wikiApi({ formatversion: '2', ...params }, { fetchImpl: (url) => get(url, 'api') })
/** "File:Shadow_dragon.png" → "Shadow dragon.png" (only the first letter is case-insensitive on MediaWiki). */
const fileName = (title) => {
  const s = title.replace(/^(?:file|image):/i, '').replace(/_/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const size = (w, h) => `${w}×${h}`
const ext = (format) => (format === 'jpeg' ? 'jpg' : format)
const write = (rel, bytes) => {
  fs.writeFileSync(path.join(OUT, rel), bytes)
  return rel
}

async function livePets() {
  const res = await get(`${SITE}/adopt-me/search.json`, 'site')
  if (!res.ok) throw new Error(`${SITE}/adopt-me/search.json answered HTTP ${res.status}`)
  const { items } = await res.json()
  return unpack(items).map((i) => ({ slug: i.h.split('/').pop(), name: i.n, imageUrl: i.i ?? null }))
}

function choosePets(all) {
  const chosen = new Map((flag('all') ? all : all.slice(0, Number(val('limit', '60')))).map((p) => [p.slug, p]))
  for (const want of (val('names') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    const pet = all.find((p) => p.name.toLowerCase() === want || p.slug === want)
    if (pet) chosen.set(pet.slug, { ...pet, named: true })
    else console.warn(`  not in the live list: ${want}`)
  }
  return [...chosen.values()]
}

/** slug → { hasPage, files: [{ file, via }] }: the infobox file, File:<Name>.png (and sentence case), page images named after the pet. */
async function wikiCandidates(pets) {
  const out = new Map()
  for (let i = 0; i < pets.length; i += PETS_PER_QUERY) {
    const batch = pets.slice(i, i + PETS_PER_QUERY)
    const titles = batch.flatMap((p) => [p.name, `${p.name} (Pet)`])
    const pages = new Map()
    const aliases = { normalized: [], redirects: [] }
    let cont = {}
    for (let round = 0; round < 10; round += 1) {
      const d = await api({ prop: 'revisions|images', rvprop: 'content', rvslots: 'main', imlimit: 'max', titles: titles.join('|'), ...cont })
      aliases.normalized.push(...(d.query?.normalized ?? []))
      aliases.redirects.push(...(d.query?.redirects ?? []))
      for (const p of d.query?.pages ?? []) {
        if (p.missing || p.invalid) continue
        const prev = pages.get(p.title) ?? { text: '', images: [] }
        pages.set(p.title, { text: prev.text || (p.revisions?.[0]?.slots?.main?.content ?? ''), images: [...prev.images, ...(p.images ?? []).map((x) => x.title)] })
      }
      if (!d.continue) break
      cont = d.continue
    }
    const resolve = finalTitles(aliases)
    for (const pet of batch) {
      const found = [pet.name, `${pet.name} (Pet)`].map((t) => pages.get(resolve(t))).filter(Boolean)
      const page = found.find((p) => templateBody(p.text, 'Pets') != null) ?? found[0]
      const files = []
      const infobox = page ? firstImageFile(templateParams(templateBody(page.text, 'Pets')).image) : null
      if (infobox) files.push({ file: fileName(infobox), via: 'infobox' })
      files.push({ file: fileName(`${pet.name}.png`), via: 'named' }, { file: fileName(`${pet.name.charAt(0)}${pet.name.slice(1).toLowerCase()}.png`), via: 'named' })
      for (const img of page?.images ?? []) if (fileMatchesPet(img, pet.name)) files.push({ file: fileName(img), via: 'page' })
      out.set(pet.slug, { hasPage: Boolean(page), files })
    }
  }
  return out
}

/** Every file on the wiki (~30k; 500 a request): name → { url, width, height, mime }. */
async function wikiFiles() {
  const out = new Map()
  let cont = {}
  for (;;) {
    const d = await api({ list: 'allimages', aiprop: 'url|size|mime', ailimit: '500', ...cont })
    for (const f of d.query?.allimages ?? []) out.set(fileName(f.name), { url: f.url, width: f.width, height: f.height, mime: f.mime })
    if (!d.continue) return out
    cont = d.continue
  }
}

/** Files the listing lacks (redirected names) → imageinfo, 50 a request. */
async function fileInfo(files, known) {
  const list = [...new Set(files)].filter((f) => !known.has(f))
  for (let i = 0; i < list.length; i += 50) {
    const chunk = list.slice(i, i + 50)
    const d = await api({ prop: 'imageinfo', iiprop: 'url|size|mime', titles: chunk.map((f) => `File:${f}`).join('|') })
    const resolve = finalTitles(d.query)
    const byTitle = new Map((d.query?.pages ?? []).map((p) => [p.title, p]))
    for (const f of chunk) {
      const info = byTitle.get(resolve(`File:${f}`))?.imageinfo?.[0]
      if (info) known.set(f, { url: info.url, width: info.width, height: info.height, mime: info.mime })
    }
  }
  return known
}

/** Downloads an earlier run (--reuse) already has: live pictures by URL, wiki files by name. */
function loadReuse(dir) {
  const current = new Map()
  const files = new Map()
  if (!dir) return { current, files }
  const rep = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'))
  const sources = fs.existsSync(path.join(dir, 'source')) ? fs.readdirSync(path.join(dir, 'source')) : []
  const sourceOf = new Map(sources.map((f) => [f.replace(/\.[a-z]+$/, ''), path.join(dir, 'source', f)]))
  for (const r of Array.isArray(rep) ? rep : rep.rows) {
    if (r.current_url && r.current_file) current.set(r.current_url, path.join(dir, r.current_file))
    if (r.source_file && sourceOf.has(r.slug) && sourceKind(r.source_url) === 'wiki') files.set(r.source_file, sourceOf.get(r.slug))
  }
  const index = path.join(dir, 'wiki-files', 'index.json')
  if (fs.existsSync(index)) for (const [f, rel] of Object.entries(JSON.parse(fs.readFileSync(index, 'utf8')))) files.set(f, path.join(dir, 'wiki-files', rel))
  return { current, files }
}

const cached = (p) => (p && fs.existsSync(p) ? fs.readFileSync(p) : null)
const downloaded = {}

async function wikiBytes(c, reuse) {
  const hit = cached(reuse.files.get(c.file))
  if (hit) return hit
  const res = await get(pngRenditionUrl(c.url), 'cdn')
  if (!res.ok) return null
  const bytes = Buffer.from(await res.arrayBuffer())
  const meta = await sharp(bytes).metadata().catch(() => null)
  if (!meta) return null
  downloaded[c.file] = `${sha256(c.file).slice(0, 16)}.${ext(meta.format)}`
  write(`wiki-files/${downloaded[c.file]}`, bytes)
  return bytes
}

async function livePicture(pet, reuse) {
  if (!pet.imageUrl) return { ok: false }
  let bytes = cached(reuse.current.get(pet.imageUrl))
  if (!bytes) {
    const res = await get(pet.imageUrl, 'current')
    if (!res.ok) return { ok: false }
    bytes = Buffer.from(await res.arrayBuffer())
  }
  const meta = await sharp(bytes).metadata().catch(() => null)
  if (!meta) return { ok: false }
  return { ok: true, width: meta.width, height: meta.height, bytes, kind: sourceKind(pet.imageUrl), file: write(`current/${pet.slug}.${ext(meta.format)}`, bytes) }
}

async function processPet(pet, candidates, reuse) {
  const live = await livePicture(pet, reuse)
  const row = { slug: pet.slug, name: pet.name, named: Boolean(pet.named), current_url: pet.imageUrl, current_size: live.ok ? size(live.width, live.height) : 'broken', current_file: live.file }
  const notes = []
  let liveN = live.ok ? await normalisePetImage(live.bytes).catch((e) => ({ error: e.message })) : null
  const liveProblem = liveN && (liveN.error ?? renderProblem(liveN))
  if (liveProblem) {
    notes.push(`live picture ${liveProblem}`)
    liveN = null
  }
  const liveColour = live.ok ? await visibleColour(live.bytes) : null
  const liveQuality = liveN ? renderQuality(liveN) : null
  const liveDetail = liveN ? await detailScore(liveN.webp) : null

  const { usable, dropped } = rankSources(candidates, CANDIDATE_FLOOR)
  let best = null
  for (const c of usable.slice(0, MAX_DOWNLOADS)) {
    const bytes = await wikiBytes(c, reuse)
    const n = bytes ? await normalisePetImage(bytes).catch((e) => ({ error: e.message })) : { error: 'did not download' }
    const problem = n.error ?? renderProblem(n)
    if (problem) {
      notes.push(`${c.file} ${problem}`)
      continue
    }
    const gap = colourGap(liveColour, await visibleColour(n.webp))
    if (c.via === 'listing' && gap > COLOUR_CHECK) {
      notes.push(`${c.file} looks like another pet or form (colour gap ${gap})`)
      continue
    }
    const gain = liveDetail ? (await detailScore(n.webp)) / liveDetail : Infinity
    const quality = effectiveQuality(renderQuality(n), liveQuality, gain)
    if (!best || quality > best.quality) best = { c, n, gap, gain, quality, bytes }
    if (quality >= INNER) break
  }

  notes.push(...dropped) // downloads' verdicts first, then what was never downloaded
  const why = notes.length > 4 ? `${notes.slice(0, 4).join('; ')}; +${notes.length - 4} more` : notes.join('; ')
  const choice = choosePicture(liveN && { quality: liveQuality }, best && { quality: best.quality })
  if (choice.action === 'no-picture') return { ...row, action: 'no-picture', reason: why || (live.ok ? 'no usable picture' : 'live picture does not load; no wiki file') }
  const fromWiki = choice.from === 'wiki'
  const n = fromWiki ? best.n : liveN
  const kind = fromWiki ? 'wiki' : live.kind
  const src = fromWiki
    ? { source_via: best.c.via, source_file: best.c.file, source_url: best.c.url, source_size: size(best.c.width, best.c.height) }
    : { source_via: 'live', source_url: pet.imageUrl, source_size: row.current_size }
  if (fromWiki) write(`source/${pet.slug}.${ext((await sharp(best.bytes).metadata()).format)}`, best.bytes)
  const trimmed = size(n.trimmed.width, n.trimmed.height)
  const blownUp = fromWiki && best.quality < renderQuality(best.n) ? `; the wiki file is no sharper than the live picture (detail ×${best.gain.toFixed(2)})` : ''
  const soft = (n.scale > UPSCALE_NOTE ? `; upscaled ${n.scale.toFixed(2)}×` : '') + blownUp
  const reason = {
    upgrade: `${row.current_size} → wiki ${src.source_size}${soft}`,
    normalise: `re-framed from ${kind} ${src.source_size}${soft}`,
    'low-res': `best picture is the ${kind} ${src.source_size} (pet ${trimmed}${blownUp}); needs upscaling or a new source${why ? `; ${why}` : ''}`,
  }[choice.action]
  const gap = fromWiki ? best.gap : 0
  return {
    ...row,
    ...src,
    action: choice.action,
    source_kind: kind,
    reason,
    check: gap > COLOUR_CHECK ? `colours differ from the live picture (gap ${gap}): another form or another pet?` : '',
    trimmed_size: trimmed,
    scale: Number(n.scale.toFixed(2)),
    detail_gain: fromWiki && Number.isFinite(best.gain) ? Number(best.gain.toFixed(2)) : null,
    upload_path: hdImagePath(pet.slug, kind),
    out_file: write(`normalised/${pet.slug}.webp`, n.webp),
    out_sha256: sha256(n.webp),
  }
}

const tally = (rows, key) => rows.reduce((acc, r) => ({ ...acc, [r[key] ?? 'none']: (acc[r[key] ?? 'none'] ?? 0) + 1 }), {})

async function dryRun() {
  for (const dir of ['current', 'source', 'normalised', 'wiki-files']) fs.mkdirSync(path.join(OUT, dir), { recursive: true })
  console.log(`Dry run → ${OUT} (nothing is uploaded and no database is touched)`)
  const reuse = loadReuse(val('reuse'))
  if (val('reuse')) console.log(`reusing ${reuse.current.size} live pictures and ${reuse.files.size} wiki files from ${val('reuse')}`)
  const all = await livePets()
  const pets = choosePets(all)
  console.log(`${all.length} live pets; checking ${pets.length}`)
  const wiki = await wikiCandidates(pets)
  const listing = await wikiFiles()
  console.log(`${listing.size} files on the wiki`)
  const infos = await fileInfo([...wiki.values()].flatMap((w) => w.files.map((f) => f.file)), listing)
  const named = petFileIndex([...listing.keys()])
  const rows = []
  for (const [i, pet] of pets.entries()) {
    const w = wiki.get(pet.slug)
    const seen = new Set()
    const candidates = [...w.files, ...named(pet.name).map((file) => ({ file, via: 'listing' }))]
      .filter((f) => infos.has(f.file) && !seen.has(f.file) && seen.add(f.file))
      .map((f) => ({ ...f, ...infos.get(f.file) }))
    const row = await processPet(pet, candidates, reuse).catch((e) => ({ slug: pet.slug, name: pet.name, current_url: pet.imageUrl, action: 'no-picture', reason: `error: ${e.message}` }))
    rows.push(row)
    console.log(`  ${String(i + 1).padStart(3)} ${row.action.padEnd(10)} ${pet.slug.padEnd(30)} ${row.reason}${row.check ? `  [CHECK]` : ''}`)
  }
  fs.writeFileSync(path.join(OUT, 'wiki-files', 'index.json'), `${JSON.stringify(downloaded, null, 2)}\n`)
  const counts = tally(rows, 'action')
  const bySource = tally(rows.filter((r) => r.out_file), 'source_kind')
  const report = { tool: REPORT_TOOL, version: REPORT_VERSION, dryRun: true, generatedAt: new Date().toISOString(), site: SITE, counts, bySource, rows }
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(path.join(OUT, 'report.csv'), toCsv(rows, COLUMNS))
  console.log(`actions ${JSON.stringify(counts)} · sources ${JSON.stringify(bySource)} · ${rows.filter((r) => r.check).length} to check`)
  const withPicture = rows.filter((r) => r.out_file)
  const tiles = [...withPicture.filter((r) => r.named), ...withPicture.filter((r) => !r.named)].slice(0, SHEET_TILES).map((r) => ({
    input: path.join(OUT, r.out_file),
    title: r.name,
    caption: `${r.action} · ${r.source_kind} ${r.source_size}`,
  }))
  if (tiles.length) console.log(`contact sheet → ${await contactSheet(tiles, path.join(OUT, 'contact-sheet.png'))}`)
}

/** --apply: checks first (planApply throws before any env file is read), then the guarded writes. */
async function apply() {
  const reportPath = val('report')
  const report = reportPath && fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null
  const dir = reportPath ? path.dirname(path.resolve(reportPath)) : ''
  const args = { env: val('env'), yes: flag('yes'), reportPath, includeThirdParty: flag('include-third-party') }
  const { rows, skipped } = planApply(args, report, (f) => cached(path.join(dir, f)))
  const { valuesDbClient } = await import('./lib/values-db.mjs')
  const { db, url } = valuesDbClient({ env: args.env, yes: args.yes })
  console.log(`${url}: writing ${rows.length} pictures; skipped ${skipped.length} not from the wiki (--include-third-party to include)`)
  const { pointed, changed } = await applyRows({ db, bucket: BUCKET, publicPrefix: `${url}/storage/v1/object/public/${BUCKET}/`, rows })
  console.log(`${pointed.length} pets now on a 512 px picture; left alone (picture changed since the dry run, or no such pet): ${changed.join(', ') || 'none'}`)
  console.log('Now revalidate: /api/internal/values-revalidate?game=adopt-me')
}

;(flag('apply') ? apply() : dryRun()).catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
