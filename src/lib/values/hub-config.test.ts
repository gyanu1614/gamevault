import { describe, expect, it } from 'vitest'
import {
  matchesValueListTab,
  parseImageAttribution,
  valueItemHasPage,
  valueListHub,
  VALUE_LIST_HUB_GAMES,
} from './hub-config'

describe('value-list hub config', () => {
  it('makes MM2 (only) a value-list hub', () => {
    expect(VALUE_LIST_HUB_GAMES).toEqual(['murder-mystery-2'])
    expect(valueListHub('steal-an-egg')).toBeNull()
    expect(valueListHub('murder-mystery-2')?.tabs.map((t) => t.label)).toEqual([
      // Owner, 2026-10-23: a New tile first (hidden when nothing is new).
      'New',
      'Godly',
      'Ancient',
      'Vintage',
      'Chroma',
      'Unique',
      'Pets',
    ])
  })

  // Owner, 2026-10-21: every item gets a page; Google indexing is the value gate's call.
  it('gives every MM2 item a page, priced or not, any tier', () => {
    for (const rarity of ['Godly', 'Ancient', 'Vintage', 'Unique', 'Chroma', 'Common', 'Uncommon', 'Rare', 'Legendary', null]) {
      expect(valueItemHasPage('murder-mystery-2', { rarity, priced: true })).toBe(true)
      expect(valueItemHasPage('murder-mystery-2', { rarity, priced: false })).toBe(true)
    }
  })

  it('keeps every Steal an Egg item a page (its unpriced pets are pages too)', () => {
    expect(valueItemHasPage('steal-an-egg', { rarity: null, priced: false })).toBe(true)
  })

  it('matches tabs on rarity or item type', () => {
    const hub = valueListHub('murder-mystery-2')!
    const godly = hub.tabs.find((t) => t.key === 'godly')!
    const pets = hub.tabs.find((t) => t.key === 'pets')!
    expect(matchesValueListTab(godly, { rarity: 'Godly', itemType: 'knife' })).toBe(true)
    expect(matchesValueListTab(godly, { rarity: 'Chroma', itemType: 'knife' })).toBe(false)
    expect(matchesValueListTab(pets, { rarity: 'Godly', itemType: 'pet' })).toBe(true)
    expect(matchesValueListTab(null, { rarity: null, itemType: null })).toBe(true)
  })

  it('splits the stored CC-BY-SA credit into text + file link', () => {
    expect(
      parseImageAttribution(
        'Image: Murder Mystery 2 Wiki (Fandom), CC BY-SA 3.0 — https://murder-mystery-2.fandom.com/wiki/File%3AHarvesterImproved.png',
      ),
    ).toEqual({
      text: 'Murder Mystery 2 Wiki (Fandom), CC BY-SA 3.0',
      href: 'https://murder-mystery-2.fandom.com/wiki/File%3AHarvesterImproved.png',
    })
    expect(parseImageAttribution('Image: Somewhere')).toEqual({ text: 'Somewhere', href: null })
    expect(parseImageAttribution(null)).toBeNull()
  })
})

describe('the New tile', () => {
  it('matches only rows flagged new, whatever their rarity', () => {
    const tab = valueListHub('murder-mystery-2')!.tabs.find((t) => t.key === 'new')!
    expect(matchesValueListTab(tab, { rarity: 'Godly', itemType: 'gun', isNew: true })).toBe(true)
    expect(matchesValueListTab(tab, { rarity: 'Godly', itemType: 'gun' })).toBe(false)
  })
})
