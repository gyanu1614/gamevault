/**
 * Rebuild every DropMarket logo / favicon file from ONE vector master.
 *
 *   pnpm brand:icons
 *
 * Source: public/brand/logo-mark-green.svg (the mark, traced to a vector on
 * 2026-10-23 so it stays sharp at every size; colour #39E37A, owner pick "D").
 * To change the brand colour, edit BRAND below and re-run — every file is
 * regenerated, nothing is hand-exported.
 *
 * Output (all overwritten):
 *   public/brand/logo-mark-green.{png,avif}, logo-mark-green-256.png  (colour mark)
 *   public/brand/logo-mark-white.{png,avif}                          (mono, dark UI)
 *   public/brand/logo-mark-ink.png                                   (mono, light UI)
 *   src/app/icon.png (512), src/app/apple-icon.png (180)             (dark tile + mark)
 *   public/favicon.ico (16, 32, 48, 64)
 *
 * The old logo-mark-lime.* files are left in place on purpose: emails already
 * sent link to them. Nothing in the app references them any more.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const BRAND = '#39E37A'
const WHITE = '#F3F3F6'
const INK = '#0A0A0F'
/** The app-icon tile: same ground, corner radius and mark size as the lime icons it replaces. */
const TILE = { ground: '#0A0A0F', radius: 0.22, mark: 0.5 }

const master = readFileSync('public/brand/logo-mark-green.svg', 'utf8')
const d = master.match(/ d="([^"]+)"/)[1]

const markSvg = (color, size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="${size}" height="${size}">` +
  `<path fill="${color}" fill-rule="evenodd" d="${d}"/></svg>`

const tileSvg = (size, markRatio = TILE.mark) => {
  const m = size * markRatio
  const o = (size - m) / 2
  const r = size * TILE.radius
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" rx="${r}" fill="${TILE.ground}"/>` +
    `<svg x="${o}" y="${o}" width="${m}" height="${m}" viewBox="0 0 1000 1000">` +
    `<path fill="${BRAND}" fill-rule="evenodd" d="${d}"/></svg></svg>`
  )
}

const png = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
// Shown at 22–48 px: a 256 px lossy AVIF is sharp on retina and ~5 KB (4:4:4 keeps the edges clean).
const avif = (svg) => sharp(Buffer.from(svg)).avif({ quality: 70, chromaSubsampling: '4:4:4', effort: 6 }).toBuffer()

/** ICO with embedded PNGs (the format every browser reads). */
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const dir = Buffer.alloc(16 * images.length)
  let offset = 6 + dir.length
  images.forEach(({ size, data }, i) => {
    const e = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, e)
    dir.writeUInt8(size >= 256 ? 0 : size, e + 1)
    dir.writeUInt16LE(1, e + 4) // colour planes
    dir.writeUInt16LE(32, e + 6) // bits per pixel
    dir.writeUInt32LE(data.length, e + 8)
    dir.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([header, dir, ...images.map((im) => im.data)])
}

const out = {
  'public/brand/logo-mark-green.png': await png(markSvg(BRAND, 512)),
  'public/brand/logo-mark-green.avif': await avif(markSvg(BRAND, 256)),
  'public/brand/logo-mark-green-256.png': await png(markSvg(BRAND, 256)),
  'public/brand/logo-mark-white.png': await png(markSvg(WHITE, 512)),
  'public/brand/logo-mark-white.avif': await avif(markSvg(WHITE, 256)),
  'public/brand/logo-mark-ink.png': await png(markSvg(INK, 512)),
  'src/app/icon.png': await png(tileSvg(512)),
  'src/app/apple-icon.png': await png(tileSvg(180)),
  // Tab-size icons get a bigger mark: at 16 px a half-size mark is 8 px of mush.
  'public/favicon.ico': ico(
    await Promise.all(
      [16, 32, 48, 64].map(async (size) => ({ size, data: await png(tileSvg(size, size <= 32 ? 0.66 : 0.56)) })),
    ),
  ),
}
for (const [path, data] of Object.entries(out)) {
  writeFileSync(path, data)
  console.log(`${path}  ${(data.length / 1024).toFixed(1)} KB`)
}
