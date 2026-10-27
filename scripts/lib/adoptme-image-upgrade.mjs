/**
 * Adopt Me pet pictures at 512 px: the pure half of
 * scripts/adopt-me-image-upgrade.mjs. Live pictures are mostly adoptmevalues'
 * 128-150 px PNGs (fetch-images.b-cdn.net) and blur on the pet buy page. This
 * ranks the Adopt Me Wiki's files for a pet, picks the best clean cut-out (a
 * wiki file or the live picture), and turns it into a 512×512 transparent
 * WebP: trimmed to the pet, centred, the same padding on every side, so the
 * whole catalogue looks alike.
 * Plain JS: loaded by the script (tsx) and by vitest.
 */
import sharp from 'sharp'
import { WIKI_IMAGE_PREFIX, scaledWikiUrl } from './adoptme-wiki-images.mjs'

/** A good picture: the pet at least this big once trimmed (and a wiki file this big on its short side). */
export const MIN_SHORT_SIDE = 256
/** Smaller wiki files are not worth a download (the 70 px "<Name> Pet.png" icons). */
export const CANDIDATE_FLOOR = 160
export const OUT_SIZE = 512
export const PAD = 32
/** The box the trimmed pet is scaled into: a source this big needs no upscaling. */
export const INNER = OUT_SIZE - 2 * PAD
/** Share of the edge that must be transparent: below it the file is a screenshot, not a cut-out render. */
export const MIN_CLEAR_EDGE = 0.85
/** Above this share of its trimmed box filled, the "pet" is a card or a framed picture (Metal Ox: 1.0; real pets ≤ 0.83). */
export const MAX_FILL = 0.95
/** Only the wiki's own uploads: File:Robot.png resolves to a Fandom-wide commons logo. */
const WIKI_UPLOADS = '/adoptme/images/'
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 }
const ALPHA_ON = 8
const CUTOUT_MIMES = new Set(['image/png', 'image/webp'])
const VIA_ORDER = { infobox: 0, named: 1, page: 2, listing: 3 }
const ADOPTMEVALUES_HOST = 'fetch-images.b-cdn.net'

/**
 * Where a picture comes from: 'wiki' (an Adopt Me Wiki file), 'wiki-copy' (our
 * bucket copy of one, adopt-me-pets/wiki/), 'adoptmevalues' (their CDN, the
 * catalogue import's URLs) or 'other'.
 */
export function sourceKind(url) {
  if (!url) return null
  if (url.includes(WIKI_UPLOADS)) return 'wiki'
  if (url.includes(WIKI_IMAGE_PREFIX)) return 'wiki-copy'
  try {
    return new URL(url).host === ADOPTMEVALUES_HOST ? 'adoptmevalues' : 'other'
  } catch {
    return 'other'
  }
}

/** Credited as an Adopt Me Wiki image (src/lib/adopt-me/image-credit.ts): only these may live under wiki/. */
export const isWikiSource = (kind) => kind === 'wiki' || kind === 'wiki-copy'

/**
 * Storage path of a 512 px picture. A wiki-sourced one goes under wiki/hd/ so
 * the wiki credit line and isOurCopy (the weekly job never touches it) still
 * apply; any other source goes to hd/, outside wiki/, so it is never credited
 * to the wiki. A new path either way: no year-long cache keeps the old file.
 */
export const hdImagePath = (slug, kind = 'wiki') => (isWikiSource(kind) ? `wiki/hd/${slug}.webp` : `hd/${slug}.webp`)

/**
 * The file as a PNG at most `width` wide. Without format=original Fandom's CDN
 * answers with a lossy WebP (Bat_Dragon.png: a 24 KB VP8 without its alpha).
 */
export function pngRenditionUrl(url, width = 1024) {
  const u = new URL(scaledWikiUrl(url, width))
  u.searchParams.set('format', 'original')
  return u.toString()
}

const key = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(?:file|image):/, '')
    .replace(/\.(png|webp|jpe?g|gif)$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** What may follow the pet's name in a file name that is still just the pet: "Pet", "AM", "-0", "(2)", "clear", "300x300"… */
const HARMLESS_TAIL = /^(?:\d+|\d+x\d+|pet|am|hd|render|model|3d|display|clear|transparent|updated|official|adoptme)*$/

/**
 * Is this file the pet itself? "Shadow dragon.png", "ShadowDragon Pet.png",
 * "Adopt me giraffe.png", "Giraffe clear.png", "Arctic Reindeer-0.png" are;
 * "Neon parrot.png", "A Parrot in-game.png", "Parrot on thumbnail.png",
 * "Croww.png", "Kangaroo-NFR.png", "Giraffe Collector Plush.png" are not.
 */
const fileKey = (file) => key(file).replace(/^adopt ?me /, '').replace(/ /g, '')
const petKey = (name) => key(name).replace(/ /g, '')
const tailIsHarmless = (fk, pk) => fk.startsWith(pk) && HARMLESS_TAIL.test(fk.slice(pk.length))

export function fileMatchesPet(file, petName) {
  return tailIsHarmless(fileKey(file), petKey(petName))
}

/** Every wiki file name → a lookup of the files named after a pet (fileMatchesPet over ~30k names, indexed). */
export function petFileIndex(files) {
  const byHead = new Map()
  for (const file of files) {
    const fk = fileKey(file)
    const head = fk.slice(0, 2)
    if (!byHead.has(head)) byHead.set(head, [])
    byHead.get(head).push([fk, file])
  }
  return (petName) => {
    const pk = petKey(petName)
    return (byHead.get(pk.slice(0, 2)) ?? []).filter(([fk]) => tailIsHarmless(fk, pk)).map(([, file]) => file)
  }
}

/**
 * Candidate files ({ file, url, width, height, mime, via }) → the usable ones,
 * best first (infobox, then File:<Name>.png, then a matching page image, then
 * any other wiki file named after the pet; larger first within each), and why
 * the others were dropped (another wiki's file, JPEG/GIF, or too small).
 */
export function rankSources(candidates, minShort = MIN_SHORT_SIDE) {
  const usable = []
  const dropped = []
  for (const c of candidates) {
    if (!c.url?.includes(WIKI_UPLOADS)) dropped.push(`${c.file} is not an Adopt Me Wiki upload`)
    else if (!CUTOUT_MIMES.has(c.mime)) dropped.push(`${c.file} is ${c.mime ?? 'not an image'}`)
    else if (Math.min(c.width, c.height) < minShort) dropped.push(`${c.file} is ${c.width}×${c.height}`)
    else usable.push(c)
  }
  usable.sort((a, b) => VIA_ORDER[a.via] - VIA_ORDER[b.via] || b.width * b.height - a.width * a.height)
  return { usable, dropped }
}

/** How good a normalised picture can look: the trimmed pet's long side, capped at the 448 px box. */
export const renderQuality = (n) => Math.min(Math.max(n.trimmed.width, n.trimmed.height), INNER)

/**
 * Fine detail of a normalised picture: scaled to 256 px, down 3× and back up,
 * the mean error. A file blown up from a small icon loses almost nothing.
 */
export async function detailScore(input) {
  const base = await sharp(input).flatten({ background: '#808080' }).resize(256, 256, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
  const small = await sharp(base.data, { raw: base.info }).resize(85, 85, { fit: 'fill' }).toBuffer()
  const back = await sharp(small, { raw: { width: 85, height: 85, channels: base.info.channels } }).resize(256, 256, { fit: 'fill' }).raw().toBuffer()
  let err = 0
  for (let i = 0; i < base.data.length; i += 1) err += Math.abs(base.data[i] - back[i])
  return err / base.data.length
}

/**
 * A wiki file must be sharper than the live picture by this much to count as
 * better. Many 360-420 px wiki files (Dalmatian, Llama, Owl, "Kangaroo Pet")
 * are the same small icon blown up: on 2026-10-27 real upgrades scored a
 * median 1.37 (10th percentile 1.10, Giant Panda 1.10), those 0.84-0.98.
 * A heuristic: a new model whose live picture has pixel jaggies (Werewolf,
 * Tarsier) also scores low, and is then labelled low-res though it is sharp.
 */
export const MIN_DETAIL_GAIN = 1.05

/** A wiki render no sharper than the live picture is only as good as it, whatever its size. */
export const effectiveQuality = (wikiQuality, liveQuality, gain) => (liveQuality != null && gain < MIN_DETAIL_GAIN ? Math.min(wikiQuality, liveQuality) : wikiQuality)

/**
 * The live picture vs the best wiki render, each { quality } or null (missing
 * or unusable). The wiki wins ties: same look, and it is credited.
 *  upgrade    the wiki render is better than the live picture (and good)
 *  normalise  as good as the live one: re-framed to match the rest
 *  low-res    the best there is is under 256 px (an upscaling candidate)
 *  no-picture nothing usable at all
 */
export function choosePicture(current, wiki) {
  const qc = current?.quality ?? 0
  const from = wiki && wiki.quality >= qc ? 'wiki' : current ? 'current' : null
  if (!from) return { action: 'no-picture', from }
  const q = from === 'wiki' ? wiki.quality : qc
  if (q < MIN_SHORT_SIDE) return { action: 'low-res', from }
  return { action: from === 'wiki' && q > qc ? 'upgrade' : 'normalise', from }
}

/** Share (0-1) of the outermost pixels that are transparent. */
export function clearEdgeShare(raw, width, height, channels) {
  let clear = 0
  let total = 0
  const at = (x, y) => {
    total += 1
    if (raw[(y * width + x) * channels + channels - 1] < ALPHA_ON) clear += 1
  }
  for (let x = 0; x < width; x += 1) {
    at(x, 0)
    if (height > 1) at(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    at(0, y)
    if (width > 1) at(width - 1, y)
  }
  return total ? clear / total : 0
}

/** Bounding box of the visible (alpha ≥ 8) pixels and the share of it they fill, or null when there are none. */
export function alphaBox(raw, width, height, channels) {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  let visible = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (raw[(y * width + x) * channels + channels - 1] < ALPHA_ON) continue
      visible += 1
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < 0) return null
  const box = { left, top, width: right - left + 1, height: bottom - top + 1 }
  return { ...box, fill: visible / (box.width * box.height) }
}

/** Why a picture is not a clean cut-out (a screenshot or a card), or null. Size is choosePicture's call. */
export function renderProblem({ clearEdge, fill }) {
  if (clearEdge < MIN_CLEAR_EDGE) return `has a background (${Math.round(clearEdge * 100)}% of the edge is transparent)`
  if (fill > MAX_FILL) return `is a card or framed picture (${Math.round(fill * 100)}% of its box is solid)`
  return null
}

/**
 * Any image → 512×512 transparent WebP: trimmed to the pet, scaled so its long
 * side fills the 448 px box, centred with 32 px padding.
 * Returns the WebP plus what renderProblem needs and the scale applied.
 */
export async function normalisePetImage(input) {
  const { data: raw, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const rawOpts = { raw: { width: info.width, height: info.height, channels: info.channels } }
  const clearEdge = clearEdgeShare(raw, info.width, info.height, info.channels)
  const found = alphaBox(raw, info.width, info.height, info.channels)
  if (!found) throw new Error('image is fully transparent')
  const { fill, ...box } = found
  const webp = await sharp(raw, rawOpts)
    .extract(box)
    .resize({ width: INNER, height: INNER, fit: 'contain', background: CLEAR })
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: CLEAR })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer()
  return { webp, clearEdge, fill, trimmed: { width: box.width, height: box.height }, scale: INNER / Math.max(box.width, box.height) }
}

/**
 * Above this gap between mean colours the new picture may be another form or
 * another pet: flagged for a look, and a wiki file not linked from the pet's
 * page ('listing') is not taken at all.
 */
export const COLOUR_CHECK = 30

/** Mean [r, g, b] of the visible pixels (alpha ≥ 128), sampled at 64 px; null when nothing is visible. */
export async function visibleColour(input) {
  const { data, info } = await sharp(input).ensureAlpha().resize(64, 64, { fit: 'contain', background: CLEAR }).raw().toBuffer({ resolveWithObject: true })
  const sum = [0, 0, 0]
  let n = 0
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + info.channels - 1] < 128) continue
    for (let c = 0; c < 3; c += 1) sum[c] += data[i + c]
    n += 1
  }
  return n ? sum.map((v) => v / n) : null
}

export const colourGap = (a, b) => (a && b ? Math.round(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])) : 0)

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * A grid of pictures, each `size` px on a dark tile with a two-line label
 * ({ input, title, caption }), written as a PNG.
 */
export async function contactSheet(tiles, file, { size = 240, cols = 4 } = {}) {
  const M = 24
  const LABEL = 48
  const W = cols * size + (cols + 1) * M
  const H = Math.ceil(tiles.length / cols) * (size + LABEL + M) + M
  const panel = await sharp({ create: { width: size, height: size, channels: 4, background: '#24252B' } }).png().toBuffer()
  const layers = []
  let text = ''
  for (const [i, t] of tiles.entries()) {
    const x = M + (i % cols) * (size + M)
    const y = M + Math.floor(i / cols) * (size + LABEL + M)
    const pic = await sharp(t.input).resize(size, size, { fit: 'contain', background: CLEAR }).png().toBuffer()
    layers.push({ input: panel, left: x, top: y + LABEL }, { input: pic, left: x, top: y + LABEL })
    text += `<text x="${x}" y="${y + 18}" class="n">${esc(t.title)}</text><text x="${x}" y="${y + 38}" class="s">${esc(t.caption)}</text>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>.n{font:600 18px Helvetica,Arial,sans-serif;fill:#f2f2f3}.s{font:13px Helvetica,Arial,sans-serif;fill:#a0a2a8}</style>${text}</svg>`
  await sharp({ create: { width: W, height: H, channels: 4, background: '#16171B' } })
    .composite([...layers, { input: Buffer.from(svg), left: 0, top: 0 }])
    .png()
    .toFile(file)
  return file
}

/** Rows → CSV (RFC 4180 quoting) with the given column order. */
export function toCsv(rows, columns) {
  const cell = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n'
}
