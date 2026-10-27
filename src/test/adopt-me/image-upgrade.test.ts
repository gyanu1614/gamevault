import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import {
  COLOUR_CHECK,
  INNER,
  MIN_SHORT_SIDE,
  MIN_DETAIL_GAIN,
  colourGap,
  alphaBox,
  choosePicture,
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
} from '../../../scripts/lib/adoptme-image-upgrade.mjs'
import { isOurCopy } from '../../../scripts/lib/adoptme-wiki-images.mjs'
import { petImageCredit } from '@/lib/adopt-me/image-credit'

// 2026-10-27: live pet pictures are adoptmevalues' 128-150 px PNGs and blur on
// the pet buy page. The wiki's infobox file is 70 px for classic pets (Parrot
// Pet.png) and its page image is often a screenshot (Parrotonjungleegg.jpg),
// so a render is only taken when it is big enough and cut out. Owner, same
// day: "consistent so all" — every pet gets the same 512 px framing.
const cand = (file: string, width: number, height: number, via: string, mime = 'image/png') => ({
  file,
  url: `https://static.wikia.nocookie.net/adoptme/images/1/1a/${file.replace(/ /g, '_')}/revision/latest`,
  width,
  height,
  mime,
  via,
})

/** A transparent canvas with one opaque ellipse: pet-shaped (fills ~79% of its box). */
const blob = (w: number, h: number, rx: number, ry: number) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${rx}" ry="${ry}" fill="#c8641e"/></svg>`))
    .png()
    .toBuffer()

/** A transparent canvas with one opaque red block. */
async function canvas(w: number, h: number, block: { left: number; top: number; width: number; height: number }, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  const red = await sharp({ create: { width: block.width, height: block.height, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer()
  return sharp({ create: { width: w, height: h, channels: 4, background } })
    .composite([{ input: red, left: block.left, top: block.top }])
    .png()
    .toBuffer()
}

describe('Adopt Me image upgrade: picking the wiki render', () => {
  it('matches page images that are the pet, not its neon, mega, screenshots or thumbnails', () => {
    expect(fileMatchesPet('File:Shadow dragon.png', 'Shadow Dragon')).toBe(true)
    expect(fileMatchesPet('File:ShadowDragon Pet.png', 'Shadow Dragon')).toBe(true)
    expect(fileMatchesPet('File:Adopt me giraffe.png', 'Giraffe')).toBe(true)
    expect(fileMatchesPet('File:Storm Condor display.png', 'Storm Condor')).toBe(true)
    expect(fileMatchesPet('File:Giraffe_clear.png', 'Giraffe')).toBe(true)
    expect(fileMatchesPet('File:Tió De Nadal.png', 'Tió De Nadal')).toBe(true)
    expect(fileMatchesPet('File:Neon parrot.png', 'Parrot')).toBe(false)
    expect(fileMatchesPet('File:A Parrot in-game.png', 'Parrot')).toBe(false)
    expect(fileMatchesPet('File:Parrot on thumbnail.png', 'Parrot')).toBe(false)
    expect(fileMatchesPet('File:Mega Neon Storm Condor.png', 'Storm Condor')).toBe(false)
  })

  it('also takes other wiki files named after the pet, but not plushies, toys, neon forms or misspellings', () => {
    const files = ['Arctic_Reindeer-0.png', 'Blue_Dog_AM_(2).png', 'BlueDog.AdoptMe.png', 'Flamingo-300x300.png', 'Turtle_Pet-0.png', 'Kangaroo1.webp']
    const no = ['Croww.png', 'Kangaroo-NFR.png', 'Giraffe_Collector_Plush.png', 'Shadow_Dragon_Ducky.png', 'Haetaeeeeeee.webp', 'Turtle_Doves.png', 'Crow_Silhouette.png']
    const find = petFileIndex([...files, ...no])
    expect(find('Arctic Reindeer')).toEqual(['Arctic_Reindeer-0.png'])
    expect(find('Blue Dog')).toEqual(['Blue_Dog_AM_(2).png', 'BlueDog.AdoptMe.png'])
    expect([...find('Flamingo'), ...find('Turtle'), ...find('Kangaroo')]).toEqual(['Flamingo-300x300.png', 'Turtle_Pet-0.png', 'Kangaroo1.webp'])
    expect([...find('Crow'), ...find('Giraffe'), ...find('Shadow Dragon'), ...find('Haetae')]).toEqual([])
    expect(find('Ox')).toEqual([])
  })

  it('drops JPEG/GIF files and anything under 256 px on its short side, then prefers the infobox', () => {
    const { usable, dropped } = rankSources([
      cand('Parrot Pet.png', 70, 70, 'infobox'),
      cand('Parrotonjungleegg.jpg', 1200, 675, 'page', 'image/jpeg'),
      cand('Mega Neon Parrot (gif).gif', 324, 306, 'page', 'image/gif'),
      cand('Shadow dragon.png', 1013, 520, 'page'),
      cand('Crow.png', 489, 295, 'named'),
      cand('Pain au Chat.png', 450, 450, 'infobox'),
      cand('Wide.png', 2000, 600, 'page'),
      { ...cand('Robot.png', 4354, 1217, 'named'), url: 'https://static.wikia.nocookie.net/ucp-internal-test-starter-commons/images/6/61/Robot.png/revision/latest' },
    ])
    expect(usable.map((c) => c.file)).toEqual(['Pain au Chat.png', 'Crow.png', 'Wide.png', 'Shadow dragon.png'])
    expect(dropped).toEqual([
      'Parrot Pet.png is 70×70',
      'Parrotonjungleegg.jpg is image/jpeg',
      'Mega Neon Parrot (gif).gif is image/gif',
      'Robot.png is not an Adopt Me Wiki upload',
    ])
    expect(rankSources([cand('Edge.png', 300, MIN_SHORT_SIDE, 'page')]).usable).toHaveLength(1)
  })

  it('takes the better of the live picture and the wiki render, the wiki on a tie, and names what is still small', () => {
    expect(choosePicture({ quality: 120 }, { quality: INNER })).toEqual({ action: 'upgrade', from: 'wiki' })
    expect(choosePicture(null, { quality: 300 })).toEqual({ action: 'upgrade', from: 'wiki' })
    expect(choosePicture({ quality: INNER }, { quality: INNER })).toEqual({ action: 'normalise', from: 'wiki' })
    expect(choosePicture({ quality: INNER }, { quality: 400 })).toEqual({ action: 'normalise', from: 'current' })
    expect(choosePicture({ quality: INNER }, null)).toEqual({ action: 'normalise', from: 'current' })
    expect(choosePicture({ quality: 120 }, null)).toEqual({ action: 'low-res', from: 'current' })
    expect(choosePicture({ quality: 120 }, { quality: 220 })).toEqual({ action: 'low-res', from: 'wiki' })
    expect(choosePicture(null, null)).toEqual({ action: 'no-picture', from: null })
    expect(renderQuality({ trimmed: { width: 1000, height: 600 } })).toBe(INNER)
    expect(renderQuality({ trimmed: { width: 120, height: 90 } })).toBe(120)
  })

  it('downloads a PNG rendition (Fandom otherwise sends a lossy WebP that can drop the alpha)', () => {
    expect(pngRenditionUrl('https://static.wikia.nocookie.net/adoptme/images/8/8c/Bat_Dragon.png/revision/latest?cb=20191229182905')).toBe(
      'https://static.wikia.nocookie.net/adoptme/images/8/8c/Bat_Dragon.png/revision/latest/scale-to-width-down/1024?cb=20191229182905&format=original',
    )
  })

  it('stores wiki pictures under wiki/ (credited, never re-checked) and anything else outside it (never credited to the wiki)', () => {
    const at = (p: string) => `https://x.supabase.co/storage/v1/object/public/adopt-me-pets/${p}`
    expect(sourceKind('https://static.wikia.nocookie.net/adoptme/images/8/8c/Bat_Dragon.png/revision/latest')).toBe('wiki')
    expect(sourceKind(at('wiki/boohoo.webp'))).toBe('wiki-copy')
    expect(sourceKind('https://fetch-images.b-cdn.net/images/pets/Parrot.png')).toBe('adoptmevalues')
    expect(sourceKind('https://example.com/a.png')).toBe('other')
    for (const kind of ['wiki', 'wiki-copy']) {
      expect(hdImagePath('bat-dragon', kind)).toBe('wiki/hd/bat-dragon.webp')
      expect(isOurCopy(at(hdImagePath('bat-dragon', kind)))).toBe(true)
      expect(petImageCredit(at(hdImagePath('bat-dragon', kind)), 'Bat Dragon')?.href).toBe('https://adoptme.fandom.com/wiki/Bat_Dragon')
    }
    for (const kind of ['adoptmevalues', 'other']) {
      expect(hdImagePath('parrot', kind)).toBe('hd/parrot.webp')
      expect(petImageCredit(at(hdImagePath('parrot', kind)), 'Parrot')).toBeNull()
    }
  })
})

describe('Adopt Me image upgrade: normalising', () => {
  it('trims to the pet, fills a 448 px box and centres it in a 512×512 transparent WebP', async () => {
    const out = await normalisePetImage(await canvas(600, 300, { left: 50, top: 40, width: 200, height: 100 }))
    expect(out.trimmed).toEqual({ width: 200, height: 100 })
    expect(out.scale).toBeCloseTo(2.24)
    expect(out.clearEdge).toBe(1)
    const { data, info } = await sharp(out.webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    expect([info.width, info.height]).toEqual([512, 512])
    expect((await sharp(out.webp).metadata()).format).toBe('webp')
    const box = alphaBox(data, info.width, info.height, info.channels)!
    expect(Math.abs(box.left - 32)).toBeLessThanOrEqual(1)
    expect(Math.abs(512 - (box.left + box.width) - 32)).toBeLessThanOrEqual(1)
    expect(Math.abs(box.top - (512 - box.height - box.top))).toBeLessThanOrEqual(1)
    expect(Math.abs(box.height - 224)).toBeLessThanOrEqual(2)
  })

  it('rejects a screenshot (opaque edge) and a card (solid box); a tiny pet is usable but low quality', async () => {
    const shot = await normalisePetImage(await canvas(400, 300, { left: 100, top: 100, width: 50, height: 50 }, { r: 30, g: 120, b: 30, alpha: 1 }))
    expect(renderProblem(shot)).toMatch(/has a background \(0% of the edge/)
    const card = await normalisePetImage(await canvas(500, 400, { left: 20, top: 20, width: 400, height: 300 }))
    expect(renderProblem(card)).toBe('is a card or framed picture (100% of its box is solid)')
    const tiny = await normalisePetImage(await blob(600, 600, 60, 45))
    expect(renderProblem(tiny)).toBeNull()
    expect(renderQuality(tiny)).toBeLessThan(MIN_SHORT_SIDE)
    const pet = await normalisePetImage(await blob(500, 400, 200, 150))
    expect(pet.fill).toBeGreaterThan(0.7)
    expect(pet.fill).toBeLessThan(0.85)
    expect(renderProblem(pet)).toBeNull()
  })

  it('flags a new picture whose colours differ from the live one (Jekyll Hydra: blue form live, green form on the wiki)', async () => {
    const solid = (r: number, g: number, b: number) => sharp({ create: { width: 40, height: 40, channels: 4, background: { r, g, b, alpha: 1 } } }).png().toBuffer()
    const blue = await visibleColour(await solid(40, 120, 200))
    const sameBlueWithMargin = await visibleColour(await normalisePetImage(await solid(40, 120, 200)).then((n) => n.webp))
    expect(colourGap(blue, sameBlueWithMargin)).toBeLessThanOrEqual(3)
    expect(colourGap(blue, await visibleColour(await solid(90, 170, 60)))).toBeGreaterThan(COLOUR_CHECK)
    expect(await visibleColour(await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer())).toBeNull()
  })

  it('does not count a big file blown up from a small icon as sharper (the 420 px Dalmatian and Llama files)', async () => {
    // A disc of 3 px red/blue stripes: plenty of fine detail.
    const raw = Buffer.alloc(512 * 512 * 4)
    for (let y = 0; y < 512; y += 1) {
      for (let x = 0; x < 512; x += 1) {
        if ((x - 256) ** 2 + (y - 256) ** 2 > 220 ** 2) continue
        raw.set(Math.floor(x / 3) % 2 ? [42, 106, 224, 255] : [224, 74, 42, 255], (y * 512 + x) * 4)
      }
    }
    const stripes = await sharp(raw, { raw: { width: 512, height: 512, channels: 4 } }).png().toBuffer()
    const crisp = await normalisePetImage(stripes)
    const icon = await sharp(stripes).resize(70, 70).png().toBuffer()
    const blown = await normalisePetImage(await sharp(icon).resize(420, 420).png().toBuffer())
    expect(await detailScore(crisp.webp)).toBeGreaterThan((await detailScore(blown.webp)) * MIN_DETAIL_GAIN)
    expect(effectiveQuality(INNER, 120, 0.95)).toBe(120)
    expect(effectiveQuality(INNER, 120, 1.4)).toBe(INNER)
    expect(effectiveQuality(INNER, null, 0.5)).toBe(INNER)
  })

  it('writes the report as CSV with quoting', () => {
    expect(toCsv([{ slug: 'pain-au-chat', reason: 'a, "b"' }, { slug: 'owl' }], ['slug', 'reason'])).toBe('slug,reason\npain-au-chat,"a, ""b"""\nowl,\n')
  })
})
