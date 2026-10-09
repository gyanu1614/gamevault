import { describe, expect, it } from 'vitest'
import { applyOptionSets } from './option-sets'

const attrs = [
  { id: 'a-type', slug: 'item-type', options: [{ value: 'knife', metadata: {} }] },
  {
    id: 'a-knife',
    slug: 'select-knife',
    options: [
      { value: 'harvester', metadata: { sets: { rarity: 'godly' } } },
      { value: 'chroma-lightbringer', metadata: { sets: { rarity: 'chroma' } } },
      { value: 'plain', metadata: {} },
    ],
  },
  {
    id: 'a-rarity',
    slug: 'rarity',
    options: [
      { value: 'godly', metadata: {} },
      { value: 'chroma', metadata: {} },
    ],
  },
]

describe('applyOptionSets', () => {
  it("fills the fields a picked option names (MM2 item → its rarity)", () => {
    expect(applyOptionSets(attrs, 'a-knife', 'harvester', { 'a-knife': 'harvester' })).toEqual({
      'a-knife': 'harvester',
      'a-rarity': 'godly',
    })
  })

  it('replaces an earlier auto-filled value when the pick changes', () => {
    expect(
      applyOptionSets(attrs, 'a-knife', 'chroma-lightbringer', { 'a-knife': 'chroma-lightbringer', 'a-rarity': 'godly' }),
    ).toEqual({ 'a-knife': 'chroma-lightbringer', 'a-rarity': 'chroma' })
  })

  it('leaves the values alone when the option sets nothing', () => {
    const v = { 'a-knife': 'plain', 'a-rarity': 'godly' }
    expect(applyOptionSets(attrs, 'a-knife', 'plain', v)).toEqual(v)
  })

  it('ignores a target field or value the template does not have', () => {
    const bad = [
      ...attrs.slice(0, 1),
      { id: 'a-knife', slug: 'select-knife', options: [{ value: 'x', metadata: { sets: { rarity: 'mythic', nope: 'y' } } }] },
      attrs[2],
    ]
    expect(applyOptionSets(bad, 'a-knife', 'x', { 'a-knife': 'x' })).toEqual({ 'a-knife': 'x' })
  })
})
