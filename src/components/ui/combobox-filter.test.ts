import { describe, expect, it } from 'vitest'
import { filterOptions, indexOptions, RENDER_CAP } from './combobox-filter'

const opts = Array.from({ length: 850 }, (_, i) => ({ value: `pet-${i}`, label: i === 3 ? 'Bat Dragon' : `Pet ${i}` }))

describe('combobox filter', () => {
  it('keeps the given order and caps what renders', () => {
    const r = filterOptions(indexOptions(opts), '')
    expect(r.items).toHaveLength(RENDER_CAP)
    expect(r.items[0].value).toBe('pet-0')
    expect(r.more).toBe(850 - RENDER_CAP)
  })
  it('matches label, value and keywords, case-insensitive, trimmed', () => {
    const idx = indexOptions([...opts.slice(0, 5), { value: '+44', label: 'United Kingdom', keywords: ['GB'] }])
    expect(filterOptions(idx, '  bat DRA ').items.map((o) => o.label)).toEqual(['Bat Dragon'])
    expect(filterOptions(idx, 'pet-4').items.map((o) => o.value)).toEqual(['pet-4'])
    expect(filterOptions(idx, 'gb').items.map((o) => o.value)).toEqual(['+44'])
    expect(filterOptions(idx, 'zzz')).toEqual({ items: [], more: 0 })
  })
})
