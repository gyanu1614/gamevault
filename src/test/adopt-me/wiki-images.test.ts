import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  WIKI_IMAGE_PREFIX,
  isOurCopy,
  resolveWikiImages,
  scaledWikiUrl,
  wikiImagePath,
} from '../../../scripts/lib/adoptme-wiki-images.mjs'
import { petImageCredit } from '@/lib/adopt-me/image-credit'

// Owner, 2026-10-14: 39 pets (most of the new ones: the geists, Jester Dragon,
// Oakee Knight…) showed a placeholder. Their source image (adoptmevalues'
// CDN, /images/pets/<Name>.png) is a 404 — adoptmevalues itself shows them
// broken. 13 older pets had been fixed by hand with an Adopt Me Wiki copy in
// our adopt-me-pets bucket; nothing did it for new pets.
const file = (title: string, url: string | null) =>
  url ? { title, imageinfo: [{ url, mime: 'image/png' }] } : { title, missing: '' }
const page = (title: string, source: string | null) => (source ? { title, original: { source } } : { title, missing: '' })

describe('Adopt Me wiki images', () => {
  it('looks up File:<Name>.png first, then the pet page image, and reports the rest', async () => {
    const asked: string[][] = []
    const api = async (params: Record<string, string>) => {
      const titles = params.titles.split('|')
      asked.push(titles)
      if (params.prop === 'imageinfo') {
        return { query: { pages: { a: file('File:Caramelgeist.png', 'https://static.wikia.nocookie.net/adoptme/images/1/1a/Caramelgeist.png/revision/latest?cb=1'), b: file('File:Clumpty.png', null), c: file('File:Nope.png', null) } } }
      }
      return { query: { pages: { a: page('Clumpty', 'https://static.wikia.nocookie.net/adoptme/images/2/2b/Clumpty_Pet.png/revision/latest?cb=2'), b: page('Clumpty (Pet)', null), c: page('Nope', null), d: page('Nope (Pet)', null) } } }
    }
    const { found, missing } = await resolveWikiImages(['Caramelgeist', 'Clumpty', 'Nope'], { api, delayMs: 0 })
    expect(found.get('Caramelgeist')).toMatch(/Caramelgeist\.png/)
    expect(found.get('Clumpty')).toMatch(/Clumpty_Pet\.png/)
    expect(missing).toEqual(['Nope'])
    expect(asked[0]).toEqual(['File:Caramelgeist.png', 'File:Clumpty.png', 'File:Nope.png'])
    expect(asked[1]).toEqual(['Clumpty', 'Clumpty (Pet)', 'Nope', 'Nope (Pet)'])
  })

  it('downloads a 512 px rendition, not the 1080 px original', () => {
    expect(scaledWikiUrl('https://static.wikia.nocookie.net/adoptme/images/f/f6/Bison.png/revision/latest?cb=20260529142217')).toBe(
      'https://static.wikia.nocookie.net/adoptme/images/f/f6/Bison.png/revision/latest/scale-to-width-down/512?cb=20260529142217',
    )
  })

  it('stores the copy where the 13 hand-fixed pets already live', () => {
    expect(wikiImagePath('jester-dragon')).toBe('wiki/jester-dragon.webp')
    const ours = `https://x.supabase.co/storage/v1/object/public/adopt-me-pets/${wikiImagePath('aestus')}`
    expect(isOurCopy(ours)).toBe(true)
    expect(isOurCopy('https://fetch-images.b-cdn.net/images/pets/Bison.png')).toBe(false)
    expect(WIKI_IMAGE_PREFIX).toBe('/adopt-me-pets/wiki/')
  })

  it('credits the wiki (CC BY-SA) under a copied image only', () => {
    const ours = 'https://x.supabase.co/storage/v1/object/public/adopt-me-pets/wiki/pain-au-chat.webp'
    expect(petImageCredit(ours, 'Pain au Chat')).toEqual({
      text: 'Image: Adopt Me Wiki (Fandom), CC BY-SA 3.0',
      href: 'https://adoptme.fandom.com/wiki/Pain_au_Chat',
    })
    expect(petImageCredit('https://fetch-images.b-cdn.net/images/pets/Bison.png', 'Bison')).toBeNull()
    expect(petImageCredit(null, 'Bison')).toBeNull()
  })
})

describe('wiki copies are credited and kept up to date', () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

  it('the pet hero shows the credit under a copied image', () => {
    const hero = read('src/app/(marketplace)/[gameSlug]/values/[itemSlug]/_AdoptMePetHero.tsx')
    expect(hero).toMatch(/petImageCredit\(imageUrl, name\)/)
    expect(hero).toMatch(/caption:/)
  })

  it('the weekly catalog job fixes new pets\' images right after the import', () => {
    const wf = read('.github/workflows/adopt-me-weekly-catalog.yml')
    const imp = wf.indexOf('pnpm adoptme:catalog --qualifying')
    const img = wf.indexOf('pnpm adoptme:images --write')
    expect(img).toBeGreaterThan(imp)
    expect(img).toBeLessThan(wf.indexOf('  mm2-catalog:'))
  })
})
