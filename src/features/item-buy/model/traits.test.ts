import { describe, it, expect } from 'vitest'
import { buildValueCatalog } from '@/lib/value-listings/catalogs'
import { traitDefs, traitPicker, traitTone } from './traits'

describe('traitTone', () => {
  it('Neon green, Mega rainbow, the plain forms uncoloured', () => {
    expect(['normal', 'fly-ride', 'neon', 'neon-fly-ride', 'mega-neon', 'mega-fly-ride'].map(traitTone)).toEqual([
      null,
      null,
      'neon',
      'neon',
      'mega',
      'mega',
    ])
  })

  it('Steal a Brainrot: Gold, Diamond and Rainbow mutations', () => {
    expect(['default', 'gold', 'diamond', 'rainbow'].map(traitTone)).toEqual([null, 'gold', 'diamond', 'mega'])
  })
})

describe('traitDefs', () => {
  it('Adopt Me: the eight forms in order, with their shorthand', () => {
    const defs = traitDefs('adopt-me', buildValueCatalog('adopt-me', { items: [{ slug: 'parrot', name: 'Parrot' }] })!)
    expect(defs.map((d) => [d.label, d.short])).toEqual([
      ['Normal', null],
      ['Fly', 'F'],
      ['Ride', 'R'],
      ['Fly Ride', 'FR'],
      ['Neon', 'N'],
      ['Neon Fly Ride', 'NFR'],
      ['Mega Neon', 'M'],
      ['Mega Fly Ride', 'MFR'],
    ])
  })

  it('Steal a Brainrot: Default first, then the mutations', () => {
    const loaded = buildValueCatalog('steal-a-brainrot', {
      items: [{ slug: 'garama', name: 'Garama' }],
      mutations: [
        { slug: 'default', name: 'Default' },
        { slug: 'gold', name: 'Gold' },
      ],
    })!
    expect(traitDefs('steal-a-brainrot', loaded).map((d) => [d.key, d.label])).toEqual([
      ['default', 'Default'],
      ['gold', 'Gold'],
    ])
  })

  it('a game without variants has no traits', () => {
    const loaded = buildValueCatalog('murder-mystery-2', { items: [{ slug: 'icebreaker', name: 'Icebreaker' }] })!
    expect(traitDefs('murder-mystery-2', loaded)).toEqual([])
  })
})

describe('traitPicker', () => {
  const opt = (variant: string) => ({ variant })

  it('Adopt Me: on/off filters', () => {
    const defs = traitDefs('adopt-me', buildValueCatalog('adopt-me', { items: [{ slug: 'parrot', name: 'Parrot' }] })!)
    expect(traitPicker(defs.map((d) => opt(d.key)))).toBe('toggles')
  })

  it('mutations keep the dropdown', () => {
    expect(traitPicker([opt('default'), opt('gold'), opt('diamond')])).toBe('dropdown')
  })

  it('no options, no picker', () => {
    expect(traitPicker([])).toBe('none')
  })
})
