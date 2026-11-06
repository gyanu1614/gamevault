import { describe, expect, it } from 'vitest'
import type { Attribute } from '@/lib/actions/new-schema'
import {
  buildItemRows,
  fieldsAfterPick,
  initialAutoTitle,
  initialItemEntry,
  itemChainIds,
  itemSearchGame,
  itemTitle,
  nextTitle,
  pickHasNoTrait,
  pickUsesItemPicture,
  pickedRow,
  valuesForPick,
  type ItemSearchGame,
} from './item-search'
import { requiredAttributesFilled, templateDataFor } from './offer-rules'
import { buildChildIndex } from './attribute-tree'

const attr = (id: string, slug: string, name: string, options: Array<[string, string]> = [], parent?: [string, string], extra: Partial<Attribute> = {}): Attribute =>
  ({
    id, template_id: 't', parent_attribute_id: null, slug, name, description: null, type: 'select', is_required: false, placeholder: null, help_text: null,
    min_value: null, max_value: null, max_length: null, default_value: null, sort_order: 0, seo_title: null, seo_description: null, facet_indexed: false,
    options: options.map(([value, label], i) => ({ id: `${id}:${value}`, attribute_id: id, slug: value, value, label, sort_order: i })),
    conditional_rules: parent ? [{ id: `r:${id}`, attribute_id: id, trigger_attribute_id: parent[0], operator: 'equals', trigger_values: [parent[1]] }] : [],
    ...extra,
  }) as unknown as Attribute

// The live forms, cut down (2026-11-06).
const MM2_ATTRS = [
  attr('type', 'item-type', 'Item Type', [['knives', 'Knives'], ['guns', 'Guns'], ['effects', 'Effects']], undefined, { is_required: true }),
  attr('rg', 'rarity-gun', 'Rarity', [['godly', 'Godly'], ['chroma', 'Chroma']], ['type', 'guns'], { is_required: true }),
  attr('rk', 'rarity-knife', 'Rarity', [['godly', 'Godly']], ['type', 'knives'], { is_required: true }),
  attr('gg', 'gun-godly', 'Gun Name', [['sunrise', 'Sunrise'], ['other', 'Other']], ['rg', 'godly'], { is_required: true }),
  attr('gc', 'gun-chroma', 'Gun Name', [['chroma-sunrise', 'Chroma Sunrise']], ['rg', 'chroma'], { is_required: true }),
  attr('kg', 'knife-godly', 'Knife Name', [['embersickle', 'Embersickle']], ['rk', 'godly'], { is_required: true }),
  attr('legacy', 'knife-name', 'Knife Name', [['old', 'Old']]),
  attr('props', 'item-properties', 'Item Properties', [['common', 'Common'], ['chroma', 'Chroma']]),
]
const AM_ATTRS = [
  attr('type', 'item-type-2', 'Item Type', [['pets', 'Pets'], ['eggs', 'Eggs'], ['toys', 'Toys']], undefined, { is_required: true }),
  attr('pet', 'pet-name', 'Pet Name', [['parrot', 'Parrot']], ['type', 'pets']),
  attr('egg', 'egg-name', 'Egg Name', [['royal-egg', 'Royal Egg']], ['type', 'eggs']),
  attr('toy', 'toy-name', 'Toy Name', [['rattle', 'Rattle']], ['type', 'toys']),
  attr('trait', 'trait', 'Trait', [['n', 'N'], ['fr', 'FR']]),
]
const SAB_ATTRS = [
  attr('type', 'item-type', 'Item Type', [['brainrot', 'Brainrot'], ['other', 'Other']], undefined, { is_required: true }),
  attr('rarity', 'rarity', 'Rarity', [['secret', 'Secret'], ['mythical', 'Mythical']], ['type', 'brainrot']),
  attr('s1', 'select-brainrot', 'Select Brainrot', [['la-vacca', 'La Vacca']], ['rarity', 'secret']),
  attr('s7', 'select-brainrot-7', 'Select Brainrot', [['toro', 'Toro']], ['rarity', 'mythical']),
  attr('mut', 'mutation', 'Mutation', [['gold', 'Gold'], ['none', 'None']], ['type', 'brainrot']),
]

const MM2 = itemSearchGame('murder-mystery-2', 'items') as ItemSearchGame
const AM = itemSearchGame('adopt-me', 'items') as ItemSearchGame
const SAB = itemSearchGame('steal-a-brainrot', 'items') as ItemSearchGame
const row = (game: ItemSearchGame, attrs: Attribute[], value: string) => buildItemRows(game, attrs).find((r) => r.value === value)!

describe('itemSearchGame', () => {
  it('is on for the three games with catalogues, on their items form only', () => {
    expect(itemSearchGame('murder-mystery-2', 'items')).not.toBeNull()
    expect(itemSearchGame('adopt-me', 'items')).not.toBeNull()
    expect(itemSearchGame('steal-a-brainrot', 'items')).not.toBeNull()
    expect(itemSearchGame('adopt-me', 'accounts')).toBeNull()
    expect(itemSearchGame('steal-an-egg', 'items')).toBeNull()
    expect(itemSearchGame(null, 'items')).toBeNull()
  })
})

describe('buildItemRows', () => {
  it('lists every item of every list, with its type, and no Other or old list', () => {
    expect(buildItemRows(MM2, MM2_ATTRS).map((r) => [r.label, r.type])).toEqual([
      ['Chroma Sunrise', 'Gun'],
      ['Embersickle', 'Knife'],
      ['Sunrise', 'Gun'],
    ])
  })

  it('names the type from each game’s lists', () => {
    expect(row(AM, AM_ATTRS, 'parrot').type).toBe('Pet')
    expect(row(AM, AM_ATTRS, 'royal-egg').type).toBe('Egg')
    expect(row(SAB, SAB_ATTRS, 'toro').type).toBe('Brainrot')
  })

  it('leaves out lists that are not items (toys)', () => {
    expect(buildItemRows(AM, AM_ATTRS).map((r) => r.value)).toEqual(['parrot', 'royal-egg'])
  })

  it('a value in two lists is one row', () => {
    const twice = [...SAB_ATTRS, attr('s9', 'select-brainrot-2', 'Select Brainrot', [['toro', 'Toro']], ['rarity', 'secret'])]
    expect(buildItemRows(SAB, twice).filter((r) => r.value === 'toro')).toHaveLength(1)
  })
})

describe('valuesForPick', () => {
  it('fills the list and every parent', () => {
    expect(valuesForPick(MM2, MM2_ATTRS, row(MM2, MM2_ATTRS, 'sunrise'), {})).toEqual({ type: 'guns', rg: 'godly', gg: 'sunrise' })
    expect(valuesForPick(SAB, SAB_ATTRS, row(SAB, SAB_ATTRS, 'toro'), {})).toEqual({ type: 'brainrot', rarity: 'mythical', s7: 'toro' })
    expect(valuesForPick(AM, AM_ATTRS, row(AM, AM_ATTRS, 'parrot'), {})).toEqual({ type: 'pets', pet: 'parrot' })
  })

  it('a new pick leaves nothing from the last one', () => {
    const first = valuesForPick(MM2, MM2_ATTRS, row(MM2, MM2_ATTRS, 'sunrise'), {})
    expect(valuesForPick(MM2, MM2_ATTRS, row(MM2, MM2_ATTRS, 'embersickle'), first)).toEqual({ type: 'knives', rk: 'godly', kg: 'embersickle' })
  })

  it('keeps the trait and mutation the seller chose', () => {
    expect(valuesForPick(AM, AM_ATTRS, row(AM, AM_ATTRS, 'parrot'), { trait: 'fr' })).toMatchObject({ trait: 'fr', pet: 'parrot' })
    expect(valuesForPick(SAB, SAB_ATTRS, row(SAB, SAB_ATTRS, 'toro'), { mut: 'gold' })).toMatchObject({ mut: 'gold', s7: 'toro' })
  })

  it('an egg has no trait, so a chosen trait goes', () => {
    expect(valuesForPick(AM, AM_ATTRS, row(AM, AM_ATTRS, 'royal-egg'), { trait: 'fr' })).toEqual({ type: 'eggs', egg: 'royal-egg' })
  })

  it('drops a retired answer', () => {
    expect(valuesForPick(MM2, MM2_ATTRS, row(MM2, MM2_ATTRS, 'sunrise'), { props: 'chroma' })).not.toHaveProperty('props')
  })

  it('what a pick fills is what a listing saves, and it passes the required check', () => {
    const values = valuesForPick(MM2, MM2_ATTRS, row(MM2, MM2_ATTRS, 'sunrise'), {})
    expect(templateDataFor({ attributes: MM2_ATTRS } as never, values)).toEqual({ 'item-type': 'guns', 'rarity-gun': 'godly', 'gun-godly': 'sunrise' })
    const { topLevel, childrenOf } = buildChildIndex(MM2_ATTRS)
    expect(requiredAttributesFilled({ attributes: MM2_ATTRS } as never, values, topLevel, childrenOf)).toBe(true)
    expect(requiredAttributesFilled({ attributes: MM2_ATTRS } as never, {}, topLevel, childrenOf)).toBe(false)
  })
})

describe('requiredAttributesFilled: the manual path', () => {
  it('does not ask for a list the seller can’t answer', () => {
    const { topLevel, childrenOf } = buildChildIndex(MM2_ATTRS)
    const values = { type: 'guns', rg: 'godly' }
    expect(requiredAttributesFilled({ attributes: MM2_ATTRS } as never, values, topLevel, childrenOf)).toBe(false)
    expect(requiredAttributesFilled({ attributes: MM2_ATTRS } as never, values, topLevel, childrenOf, new Set(['gg', 'gc', 'kg']))).toBe(true)
  })

  it('still asks for the type', () => {
    const { topLevel, childrenOf } = buildChildIndex(MM2_ATTRS)
    expect(requiredAttributesFilled({ attributes: MM2_ATTRS } as never, {}, topLevel, childrenOf, new Set(['gg', 'gc', 'kg']))).toBe(false)
  })
})

describe('pickedRow', () => {
  const rows = buildItemRows(MM2, MM2_ATTRS)
  it('reads the item back from the answers', () => {
    expect(pickedRow(rows, MM2_ATTRS, { type: 'guns', rg: 'godly', gg: 'sunrise' })?.value).toBe('sunrise')
  })
  it('a value on a hidden branch does not count', () => {
    expect(pickedRow(rows, MM2_ATTRS, { type: 'knives', rg: 'godly', gg: 'sunrise' })).toBeNull()
  })
  it('nothing picked', () => {
    expect(pickedRow(rows, MM2_ATTRS, {})).toBeNull()
    expect(pickedRow(rows, MM2_ATTRS, { type: 'guns', rg: 'godly', gg: 'other' })).toBeNull()
  })
})

describe('fieldsAfterPick', () => {
  const after = (game: ItemSearchGame, attrs: Attribute[], value: string) => {
    const r = row(game, attrs, value)
    return fieldsAfterPick(game, attrs, r, valuesForPick(game, attrs, r, {})).map((a) => a.slug)
  }
  it('Adopt Me: the trait, for a pet', () => expect(after(AM, AM_ATTRS, 'parrot')).toEqual(['trait']))
  it('Adopt Me: nothing, for an egg', () => expect(after(AM, AM_ATTRS, 'royal-egg')).toEqual([]))
  it('Steal a Brainrot: the mutation', () => expect(after(SAB, SAB_ATTRS, 'toro')).toEqual(['mutation']))
  it('Murder Mystery 2: nothing, Item Properties is gone', () => expect(after(MM2, MM2_ATTRS, 'sunrise')).toEqual([]))
})

describe('titles', () => {
  it('names the item and the game', () => {
    expect(itemTitle('Sunrise', 'Murder Mystery 2')).toBe('Sunrise - Murder Mystery 2')
    expect(itemTitle('  ', 'Murder Mystery 2')).toBe('')
  })
  it('fills an empty title', () => expect(nextTitle('', '', 'Sunrise - MM2')).toBe('Sunrise - MM2'))
  it('follows the item while the seller hasn’t touched it', () => expect(nextTitle('Sunrise - MM2', 'Sunrise - MM2', 'Luger - MM2')).toBe('Luger - MM2'))
  it('never replaces what the seller wrote', () => expect(nextTitle('My best Sunrise', 'Sunrise - MM2', 'Luger - MM2')).toBe('My best Sunrise'))
})

describe('initialItemEntry', () => {
  const chain = itemChainIds(MM2, MM2_ATTRS)
  it('a listing of a known item opens on it', () => {
    expect(initialItemEntry(row(MM2, MM2_ATTRS, 'sunrise'), chain, {})).toBe('search')
  })
  it('a listing of something else opens on its manual fields', () => {
    expect(initialItemEntry(null, chain, { type: 'effects' })).toBe('manual')
  })
  it('a new listing opens on the search', () => {
    expect(initialItemEntry(null, chain, {})).toBe('search')
  })
})

describe('an existing listing’s title', () => {
  const sunrise = row(MM2, MM2_ATTRS, 'sunrise')

  it('one a pick would fill follows the item', () => {
    const auto = initialAutoTitle('Sunrise - Murder Mystery 2', sunrise, 'Murder Mystery 2')
    expect(auto).toBe('Sunrise - Murder Mystery 2')
    expect(nextTitle('Sunrise - Murder Mystery 2', auto, 'Embersickle - Murder Mystery 2')).toBe('Embersickle - Murder Mystery 2')
  })

  it('one the seller wrote stays', () => {
    const auto = initialAutoTitle('Sunrise, Mint Condition', sunrise, 'Murder Mystery 2')
    expect(auto).toBe('')
    expect(nextTitle('Sunrise, Mint Condition', auto, 'Embersickle - Murder Mystery 2')).toBe('Sunrise, Mint Condition')
  })

  it('no item: nothing to follow', () => {
    expect(initialAutoTitle('Sunrise - Murder Mystery 2', null, 'Murder Mystery 2')).toBe('')
  })
})

describe('pickHasNoTrait', () => {
  it('an egg has none; a pet does', () => {
    expect(pickHasNoTrait(AM, AM_ATTRS, row(AM, AM_ATTRS, 'royal-egg'))).toBe(true)
    expect(pickHasNoTrait(AM, AM_ATTRS, row(AM, AM_ATTRS, 'parrot'))).toBe(false)
  })
  it('a game without traits never says so', () => {
    expect(pickHasNoTrait(MM2, MM2_ATTRS, row(MM2, MM2_ATTRS, 'sunrise'))).toBe(false)
  })
})

describe('pickUsesItemPicture', () => {
  const picked = { value: 'x', label: 'X', attributeId: 'a', type: 'Pet' }
  it('a picked Adopt Me or Murder Mystery 2 item uses its catalogue picture', () => {
    expect(pickUsesItemPicture(AM, picked)).toBe(true)
    expect(pickUsesItemPicture(MM2, picked)).toBe(true)
  })
  it('a Steal a Brainrot offer keeps its photos: income and mutation differ per offer', () => {
    expect(pickUsesItemPicture(SAB, picked)).toBe(false)
  })
  it('nothing picked yet, or no search on this game, still asks for photos', () => {
    expect(pickUsesItemPicture(AM, null)).toBe(false)
    expect(pickUsesItemPicture(null, picked)).toBe(false)
  })
})
