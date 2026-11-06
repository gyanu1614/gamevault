import { describe, expect, it } from 'vitest'
import { legacyRetirement, syncMessage } from './run'
import type { SellFormConfig, SyncReport } from './types'

const base: SyncReport = {
  gameSlug: 'murder-mystery-2', status: 'ok', write: true, fieldsCreated: 0, fieldsUpdated: 0, optionsCreated: [], optionsUpdated: 0,
  optionsDeleted: 0, optionsKept: [], rulesSet: 0, listingsRepaired: 0, fieldsRetired: [], fieldsKeptInUse: [], warnings: [], message: null,
}

describe('syncMessage', () => {
  it('names the new items (not the rarity or type options) and the moved listings', () => {
    const text = syncMessage('Murder Mystery 2', {
      ...base,
      optionsCreated: [{ node: 'gun-ancient', label: 'Emberbow' }, { node: 'rarity-gun', label: 'Ancient' }, { node: 'knife-ancient', label: 'Emberscythe' }],
      listingsRepaired: 2,
      warnings: ['1 item has no rarity, so it is listed under Other: Gingerscythe'],
    })
    expect(text).toBe('🧾 **Murder Mystery 2** sell form: 2 items are now sellable: Emberbow, Emberscythe; 2 listings were re-linked to their filters.\n• 1 item has no rarity, so it is listed under Other: Gingerscythe')
  })

  it('stays quiet on a dry run or a day with nothing to do, and speaks when it stopped itself', () => {
    expect(syncMessage('MM2', { ...base, write: false, optionsCreated: [{ node: 'gun-ancient', label: 'X' }] })).toBeNull()
    expect(syncMessage('MM2', { ...base, status: 'nothing_to_do' })).toBeNull()
    expect(syncMessage('MM2', { ...base, status: 'blocked', message: 'over the cap' })).toBe('⚠️ **MM2** sell form sync stopped: over the cap. Nothing was written.')
  })
})

describe('legacyRetirement', () => {
  const config = {
    types: [{ key: 'knife' }, { key: 'gun' }],
    legacyFields: ['rarity-2', 'knife-name-5'],
  } as unknown as SellFormConfig
  const form = { fields: [{ id: 'a', slug: 'rarity-2' }, { id: 'b', slug: 'knife-name-5' }, { id: 'c', slug: 'item-properties' }] }

  it('retires an old field once no live listing answers it (after the repairs), and keeps one that is still used', () => {
    const listings = [{ id: 'l1', templateData: { 'rarity-2': 'ancient', 'knife-name-5': 'x' }, valueItemSlug: null }]
    const repairs = [{ id: 'l1', templateData: { 'knife-name-5': 'x' }, itemSlug: null }]
    expect(legacyRetirement(config, { typeValues: { knife: 'knives', gun: 'guns' } }, form, listings, repairs)).toEqual({
      retire: [{ id: 'a', slug: 'rarity-2' }],
      inUse: ['knife-name-5'],
    })
  })

  it('retires a retired field the same way: gone once no live listing answers it', () => {
    const retiring = { ...config, legacyFields: [], retiredFields: ['item-properties'] } as unknown as SellFormConfig
    const plan = { typeValues: { knife: 'knives', gun: 'guns' } }
    const used = [{ id: 'l1', templateData: { 'item-properties': 'chroma' }, valueItemSlug: null }]
    expect(legacyRetirement(retiring, plan, form, used, [])).toEqual({ retire: [], inUse: ['item-properties'] })
    expect(legacyRetirement(retiring, plan, form, used, [{ id: 'l1', templateData: {}, itemSlug: null }])).toEqual({ retire: [{ id: 'c', slug: 'item-properties' }], inUse: [] })
  })

  it('retires nothing while a configured type has no chain', () => {
    expect(legacyRetirement(config, { typeValues: { knife: 'knives' } }, form, [], []).retire).toEqual([])
  })
})
