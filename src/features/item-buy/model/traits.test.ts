import { describe, it, expect } from 'vitest'
import { buildValueCatalog } from '@/lib/value-listings/catalogs'
import { traitDefs } from './traits'

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
