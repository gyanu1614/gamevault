import { describe, it, expect, vi } from 'vitest'
import { pickWikiImage, fetchWikiImage } from './wiki'

/** The real file list on the Adopt Me wiki's Shadow Dragon page (2026-09-30). */
const SHADOW_DRAGON = [
  'File:Candy Trading Shop Pets.png',
  'File:ShadowDragon Pet.png',
  'File:Shadow dragon.png',
  'File:Neon shadow dragon.png',
  'File:Shadow Dragon Gamepass AM.png',
  'File:Mega Neon Shadow Dragon.gif',
  'File:Adopt me Halloween part 1.PNG',
  'File:Robux 2019 Logo Black.svg',
  'File:Petsonthumbnail.jpg',
  'File:House Trading Thumbnail.png',
  'File:Quality of Life Thumbnail.png',
  'File:Original Mega Neon Shadow Dragon.gif',
]

/** The real file list on the Frost Dragon page. */
const FROST_DRAGON = [
  'File:FrostDragon.jpg',
  'File:Frost Dragon Gamepass AM.png',
  'File:Frost Dragon Pet.png',
  'File:Frost dragon (flurry).png',
  'File:Mega Neon Frost Dragon.gif',
  'File:Mega Neon Frost Dragon (gif).gif',
  'File:Mega frost old.gif',
  'File:Neon Frost Dragon.png',
  'File:Robux 2019 Logo Black.svg',
]

describe('pickWikiImage — the clean pet render, not the page banner', () => {
  it('prefers the "<name> Pet.png" render, which is what marketplaces show', () => {
    expect(pickWikiImage('Shadow Dragon', SHADOW_DRAGON)).toBe('File:ShadowDragon Pet.png')
    expect(pickWikiImage('Frost Dragon', FROST_DRAGON)).toBe('File:Frost Dragon Pet.png')
  })

  it('rejects the gamepass banner the old lead-image query returned', () => {
    expect(pickWikiImage('Shadow Dragon', SHADOW_DRAGON)).not.toContain('Gamepass')
    expect(pickWikiImage('Frost Dragon', FROST_DRAGON)).not.toContain('Gamepass')
  })

  it('rejects unrelated page furniture', () => {
    const picked = pickWikiImage('Shadow Dragon', SHADOW_DRAGON)!
    for (const junk of ['Trading', 'Thumbnail', 'Robux', 'Halloween', 'Petsonthumbnail']) {
      expect(picked).not.toContain(junk)
    }
  })

  it('rejects a VARIANT of the pet — a Neon or Mega is a different thing to sell', () => {
    const picked = pickWikiImage('Shadow Dragon', SHADOW_DRAGON)!
    expect(picked.toLowerCase()).not.toContain('neon')
    expect(picked.toLowerCase()).not.toContain('mega')
  })

  it('falls back to a plain "<name>.png" when there is no Pet render', () => {
    expect(pickWikiImage('Shadow Dragon', ['File:Robux.svg', 'File:Shadow dragon.png']))
      .toBe('File:Shadow dragon.png')
  })

  it('ignores animated and vector files', () => {
    expect(pickWikiImage('Shadow Dragon', ['File:Shadow Dragon.gif', 'File:Shadow Dragon.svg'])).toBeNull()
  })

  it('returns null rather than something unrelated when the page has no image of the pet', () => {
    expect(pickWikiImage('Shadow Dragon', ['File:Robux 2019 Logo Black.svg', 'File:House Trading Thumbnail.png']))
      .toBeNull()
  })

  it('handles an empty list', () => {
    expect(pickWikiImage('Shadow Dragon', [])).toBeNull()
  })

  it('matches a name whose spacing differs from the file name', () => {
    expect(pickWikiImage('Ring-Tailed Lemur', ['File:RingTailedLemur Pet.png'])).toBe('File:RingTailedLemur Pet.png')
  })
})

describe('fetchWikiImage', () => {
  const reply = (body: unknown) =>
    vi.fn(async (_url: string) => ({ ok: true, headers: new Headers(), json: async () => body }) as unknown as Response)

  const page = (title: string, url: string) => ({ title, imageinfo: [{ url }] })

  it('asks for the page images WITH their urls in one request', async () => {
    const f = reply({ query: { pages: [page('File:Frost Dragon Pet.png', 'https://static.test/fd.png')] } })
    await fetchWikiImage('adoptme.fandom.com', 'Frost Dragon', f as any)
    const url = String((f.mock.calls as unknown as string[][])[0][0])
    expect(url).toContain('generator=images')
    expect(url).toContain('iiprop=url')
    expect(url).toContain('redirects=1')
    expect(url).toContain('titles=Frost+Dragon')
  })

  it('returns the url of the picked render', async () => {
    const f = reply({
      query: {
        pages: [
          page('File:Frost Dragon Gamepass AM.png', 'https://static.test/gamepass.png'),
          page('File:Frost Dragon Pet.png', 'https://static.test/pet.png'),
        ],
      },
    })
    expect(await fetchWikiImage('adoptme.fandom.com', 'Frost Dragon', f as any)).toBe('https://static.test/pet.png')
  })

  it('returns null when nothing on the page depicts the item', async () => {
    const f = reply({ query: { pages: [page('File:Robux Logo.svg', 'https://static.test/robux.svg')] } })
    expect(await fetchWikiImage('adoptme.fandom.com', 'Frost Dragon', f as any)).toBeNull()
  })

  it('returns null for a missing page, a bad status or a thrown request', async () => {
    expect(await fetchWikiImage('h', 'T', reply({ query: { pages: [] } }) as any)).toBeNull()
    expect(await fetchWikiImage('h', 'T', reply({}) as any)).toBeNull()
    expect(await fetchWikiImage('h', 'T', (async () => ({ ok: false })) as any)).toBeNull()
    expect(await fetchWikiImage('h', 'T', (async () => { throw new Error('x') }) as any)).toBeNull()
  })

  it('makes no request for an empty host or title', async () => {
    const f = reply({})
    expect(await fetchWikiImage('', 'T', f as any)).toBeNull()
    expect(await fetchWikiImage('h', '  ', f as any)).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('ignores a non-http url', async () => {
    const f = reply({ query: { pages: [page('File:Frost Dragon Pet.png', 'javascript:alert(1)')] } })
    expect(await fetchWikiImage('h', 'Frost Dragon', f as any)).toBeNull()
  })
})
