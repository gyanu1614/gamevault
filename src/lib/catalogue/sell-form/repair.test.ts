import { describe, expect, it } from 'vitest'
import type { CatalogueEntry, FormSnapshot, ListingRow, SellFormConfig } from './types'
import { planSellForm } from './plan'
import { planListingRepairs } from './repair'

const CONFIG: SellFormConfig = {
  gameSlug: 'murder-mystery-2',
  typeField: 'item-type',
  typeFieldName: 'Item Type',
  types: [
    { key: 'knife', label: 'Knives', aliases: ['knife', 'knives'], listName: 'Knife Name' },
    { key: 'gun', label: 'Guns', aliases: ['gun', 'guns'], listName: 'Gun Name' },
  ],
  rarities: ['Common', 'Godly', 'Ancient'],
  legacyFields: ['rarity-2', 'knife-name-5', 'select-gun'],
}
const item = (slug: string, name: string, itemType: string, rarity: string | null): CatalogueEntry => ({ slug, name, itemType, rarity, enabled: true })
const ITEMS = [
  item('emberbow', 'Emberbow', 'gun', 'Ancient'),
  item('drool-gun', 'Drool (Gun)', 'gun', 'Common'),
  item('hallowscythe', 'Hallowscythe', 'knife', 'Ancient'),
  item('gingerscythe', 'Gingerscythe', 'knife', null),
]
const empty = (): FormSnapshot => ({ templateId: 'tpl', fields: [], options: [], rules: [] })
const listing = (id: string, templateData: Record<string, unknown>, valueItemSlug: string | null = null): ListingRow => ({ id, templateData, valueItemSlug })

function repairs(rows: ListingRow[], items = ITEMS, renamed: { node: string; from: string }[] = []) {
  const plan = { ...planSellForm(CONFIG, items, empty()), renamed }
  return planListingRepairs(CONFIG, items, plan, rows)
}

describe('planListingRepairs: a listing follows its item', () => {
  it('moves a hand-made-form listing onto the chain, found by its old name field', () => {
    const out = repairs([listing('l1', { 'item-type': 'knives', 'rarity-2': 'ancient', 'knife-name-5': 'hallowscythe', 'delivery-time': '1h' })])
    expect(out).toEqual([{ id: 'l1', itemSlug: 'hallowscythe', templateData: { 'item-type': 'knives', 'rarity-knife': 'ancient', 'knife-ancient': 'hallowscythe', 'delivery-time': '1h' } }])
  })

  it('puts a linked listing back in its list when its option was moved', () => {
    const out = repairs([listing('l2', { 'item-type': 'guns', 'rarity-gun': 'common', 'gun-common': 'emberbow' }, 'emberbow')])
    expect(out[0].templateData).toEqual({ 'item-type': 'guns', 'rarity-gun': 'ancient', 'gun-ancient': 'emberbow' })
  })

  it('re-points the key of a field that was renamed', () => {
    const out = repairs([listing('l3', { 'item-type': 'guns', 'rarity-gun': 'ancient', 'ancient-guns': 'emberbow' })], ITEMS, [{ node: 'gun-ancient', from: 'ancient-guns' }])
    expect(out[0].templateData).toEqual({ 'item-type': 'guns', 'rarity-gun': 'ancient', 'gun-ancient': 'emberbow' })
  })

  it('follows a catalogue rarity fix (Other → Ancient)', () => {
    const fixed = ITEMS.map((i) => (i.slug === 'gingerscythe' ? { ...i, rarity: 'Ancient' } : i))
    const out = repairs([listing('l4', { 'item-type': 'knives', 'rarity-knife': 'other', 'knife-other': 'gingerscythe' }, 'gingerscythe')], fixed)
    expect(out[0].templateData).toEqual({ 'item-type': 'knives', 'rarity-knife': 'ancient', 'knife-ancient': 'gingerscythe' })
  })

  it('leaves a listing alone when it is already right, or not a chain type, or uses the admin’s own option', () => {
    expect(repairs([
      listing('ok', { 'item-type': 'guns', 'rarity-gun': 'ancient', 'gun-ancient': 'emberbow' }, 'emberbow'),
      listing('fx', { 'item-type': 'effects', 'effect-name': 'sparkles' }),
      listing('manual', { 'item-type': 'guns', 'rarity-gun': 'ancient', 'gun-ancient': 'nightbow' }),
    ])).toEqual([])
  })

  it('keeps type and rarity and answers Other when the old name is not in the catalogue', () => {
    const out = repairs([listing('l5', { 'item-type': 'knives', 'rarity-2': 'ancient', 'knife-name-5': 'other' })])
    expect(out).toEqual([{ id: 'l5', itemSlug: null, templateData: { 'item-type': 'knives', 'rarity-knife': 'ancient', 'knife-ancient': 'other' } }])
  })

  it('never reads a rarity answer as an item', () => {
    const items = [...ITEMS, item('ancient', 'Ancient', 'knife', 'Godly')]
    const out = repairs([listing('l6', { 'item-type': 'knives', 'rarity-2': 'ancient', 'knife-name-5': 'hallowscythe' })], items)
    expect(out[0].itemSlug).toBe('hallowscythe')
  })
})
