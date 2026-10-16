import { describe, expect, it } from 'vitest'

import { categorySubject } from './category-subject'

const base = { gameName: 'Escape from Tarkov', gameSlug: 'escape-from-tarkov', categoryName: 'Currency', isCurrency: true }

describe('categorySubject', () => {
  it('names a currency page by its own unit, not "Currency" (searchers type "tarkov roubles")', () => {
    const s = categorySubject({ ...base, unitLabel: 'Roubles' })
    expect(s.subject).toBe('Escape from Tarkov Roubles')
    expect(s.alias).toBe('EFT')
  })

  it('keeps the category name when the unit label is a placeholder or the page is not currency', () => {
    expect(categorySubject({ ...base, unitLabel: 'Currency' }).subject).toBe('Escape from Tarkov Currency')
    expect(categorySubject({ ...base, unitLabel: 'units' }).subject).toBe('Escape from Tarkov Currency')
    expect(categorySubject({ ...base, isCurrency: false, categoryName: 'Items', unitLabel: 'Roubles' }).subject).toBe('Escape from Tarkov Items')
  })

  it('does not repeat the game name when the unit already carries it', () => {
    expect(categorySubject({ gameName: 'GTA V', gameSlug: 'gta-v', categoryName: 'Currency', isCurrency: true, unitLabel: 'GTA V Cash' }).subject).toBe('GTA V Cash')
  })

  it('reads the play modes a currency is sold for (Tarkov PvP / PvE)', () => {
    expect(categorySubject({ ...base, unitLabel: 'Roubles', regionOptions: ['PvE Zone', 'PvP Season'] }).modes).toBe('PvP or PvE')
    expect(categorySubject({ ...base, unitLabel: 'Roubles', regionOptions: ['EU', 'NA'] }).modes).toBeNull()
  })
})
