import { describe, it, expect } from 'vitest'
import siteinfo from './__fixtures__/fandom-siteinfo.json'
import allcategories from './__fixtures__/fandom-allcategories.json'
import petMembers from './__fixtures__/fandom-categorymembers-pets.json'
import revisions from './__fixtures__/fandom-revisions-batch.json'
import {
  wikiSlugCandidates,
  parseSiteInfo,
  siteNameMatches,
  parseAllCategories,
  parseCategoryMembers,
  extractRarities,
  findWiki,
  draftTaxonomy,
  type FetchLike,
} from './fandom'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('wikiSlugCandidates', () => {
  it('tries the concatenated form first (that is the one that exists for Steal An Egg), then hyphenated', () => {
    expect(wikiSlugCandidates('Steal An Egg')).toEqual(['stealanegg', 'steal-an-egg', 'stealanegg-roblox'])
  })
  it('strips Roblox title decoration before building slugs', () => {
    expect(wikiSlugCandidates('[🧲] Blox Fruits')[0]).toBe('bloxfruits')
  })
})

describe('parseSiteInfo / siteNameMatches', () => {
  it('reads sitename, article count and server', () => {
    expect(parseSiteInfo(siteinfo)).toEqual({
      sitename: 'Steal An Egg Wiki',
      articles: 188,
      server: 'https://stealanegg.fandom.com',
      lang: 'en',
    })
  })
  it('accepts a sitename that is the title plus "Wiki", refuses another game', () => {
    expect(siteNameMatches('Steal An Egg', 'Steal An Egg Wiki')).toBe(true)
    expect(siteNameMatches('Steal an Egg', 'Steal An Egg Wiki')).toBe(true)
    expect(siteNameMatches('Steal An Egg', 'Steal a Brainrot Wiki')).toBe(false)
  })
  it('returns null for a non-wiki body', () => {
    expect(parseSiteInfo({})).toBeNull()
  })
})

describe('parseAllCategories', () => {
  it('returns content categories by size, dropping wiki-maintenance ones', () => {
    const cats = parseAllCategories(allcategories)
    expect(cats.slice(0, 3)).toEqual([
      { name: 'Pets', size: 144 },
      { name: 'Eggs', size: 143 },
      { name: 'Area', size: 135 },
    ])
    const names = cats.map((c) => c.name)
    expect(names).not.toContain('Template documentation')
    expect(names).not.toContain('Infobox templates')
    expect(names).not.toContain('Steal An Egg Wiki')
  })
})

describe('parseCategoryMembers', () => {
  it('returns page titles', () => {
    const m = parseCategoryMembers(petMembers)
    expect(m).toHaveLength(50)
    expect(m[0]).toBe('Abyss Overlord')
  })
})

describe('extractRarities', () => {
  it('pulls the infobox rarity per page and the distinct tiers', () => {
    const r = extractRarities(revisions)
    expect(r.byTitle.get('Abyss Overlord')).toBe('Secret')
    expect(r.byTitle.get('Bird')).toBe('Uncommon')
    expect(r.tiers).toEqual(expect.arrayContaining(['Uncommon', 'Epic', 'Legendary', 'Mythic', 'Secret', 'Divine']))
  })
})

describe('findWiki', () => {
  it('returns the first slug variant whose sitename matches the title', async () => {
    const urls: string[] = []
    const fetchImpl: FetchLike = async (url) => {
      urls.push(String(url))
      if (String(url).startsWith('https://stealanegg.fandom.com')) return json(siteinfo)
      return json({}, 410)
    }
    const w = await findWiki('Steal An Egg', { fetchImpl })
    expect(w).toEqual({ slug: 'stealanegg', url: 'https://stealanegg.fandom.com', sitename: 'Steal An Egg Wiki', articles: 188 })
    expect(urls).toHaveLength(1)
  })

  it('rejects a wiki whose sitename is a different game, and returns null when none match', async () => {
    const other = { query: { general: { sitename: 'Egg Simulator Wiki', server: 'https://x.fandom.com', lang: 'en' }, statistics: { articles: 5 } } }
    const fetchImpl: FetchLike = async () => json(other)
    expect(await findWiki('Steal An Egg', { fetchImpl })).toBeNull()
  })
})

describe('draftTaxonomy', () => {
  const fetchImpl: FetchLike = async (url) => {
    const u = String(url)
    if (!u.startsWith('https://stealanegg.fandom.com')) return json({}, 410)
    if (u.includes('meta=siteinfo')) return json(siteinfo)
    if (u.includes('list=allcategories')) return json(allcategories)
    if (u.includes('list=categorymembers')) return json(petMembers)
    if (u.includes('prop=revisions')) return json(revisions)
    return json({}, 404)
  }

  it('produces a draft with the top categories, sample members and rarity tiers', async () => {
    const d = await draftTaxonomy('Steal An Egg', { fetchImpl, maxCategories: 2, membersPerCategory: 50, sleep: async () => {} })
    expect(d.found).toBe(true)
    expect(d.wiki).toMatchObject({ url: 'https://stealanegg.fandom.com', articles: 188 })
    expect(d.categories.map((c) => c.name)).toEqual(['Pets', 'Eggs'])
    expect(d.categories[0].members[0]).toBe('Abyss Overlord')
    expect(d.rarities).toContain('Secret')
    expect(d.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('says so when there is no wiki', async () => {
    const d = await draftTaxonomy('No Such Game', { fetchImpl: async () => json({}, 410), sleep: async () => {} })
    expect(d).toMatchObject({ found: false, categories: [], rarities: [] })
    expect(d.note).toMatch(/no fandom wiki/i)
  })
})
