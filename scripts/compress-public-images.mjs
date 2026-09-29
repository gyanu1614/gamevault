#!/usr/bin/env node
/**
 * One-off: recompress the heavy images under public/ IN PLACE (same path,
 * same format, so no reference changes). Images are served unoptimized
 * (next.config), so these files are what visitors download.
 *
 *   node scripts/compress-public-images.mjs [--min-kb 300] [--dry]
 *
 * Width is capped at what the site displays (heroes 1920 px, everything else
 * 1600 px); JPEG → mozjpeg q78, PNG → palette-quantised q85 (keeps alpha),
 * WebP → q80. A file is only rewritten when it shrinks by 15% or more.
 */
import { readdir, stat, readFile, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import sharp from 'sharp'

const args = process.argv.slice(2)
const minKb = Number(args[args.indexOf('--min-kb') + 1]) || 300
const dry = args.includes('--dry')

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

let before = 0
let after = 0
for await (const file of walk('public')) {
  const ext = extname(file).toLowerCase()
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue
  const { size } = await stat(file)
  if (size < minKb * 1024) continue
  const input = await readFile(file)
  const maxW = file.includes('/hero') ? 1920 : 1600
  let pipe = sharp(input).rotate().resize({ width: maxW, withoutEnlargement: true })
  if (ext === '.png') pipe = pipe.png({ palette: true, quality: 85, effort: 10, compressionLevel: 9 })
  else if (ext === '.webp') pipe = pipe.webp({ quality: 80, effort: 6 })
  else pipe = pipe.jpeg({ quality: 78, mozjpeg: true })
  const out = await pipe.toBuffer()
  const keep = out.length <= size * 0.85
  before += size
  after += keep ? out.length : size
  console.log(`${keep ? 'shrunk' : 'kept  '}  ${(size / 1024).toFixed(0).padStart(5)} KB → ${(out.length / 1024).toFixed(0).padStart(5)} KB  ${file}`)
  if (keep && !dry) await writeFile(file, out)
}
console.log(`total ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB${dry ? ' (dry run)' : ''}`)
