import { describe, it, expect } from 'vitest'
import { pack, unpack } from './columnar'

describe('columnar pack/unpack', () => {
  const rows = [
    { slug: 'bat-dragon', name: 'Bat Dragon', price: 12.5, href: null, variants: [{ v: 'FR', usd: 1 }, { v: 'NFR', usd: 2 }] },
    { slug: 'frost', name: 'Frost Dragon', price: null, href: '/x', variants: [{ v: 'FR', usd: 3 }] },
  ]

  it('round-trips nested rows exactly', () => {
    expect(unpack(pack(rows))).toEqual(rows)
    expect(unpack(pack({ rows, total: 2 }))).toEqual({ rows, total: 2 })
  })

  it('writes each key once', () => {
    const json = JSON.stringify(pack(Array.from({ length: 50 }, (_, i) => ({ tradeValue: i, cashUsd: i }))))
    expect(json.match(/tradeValue/g)).toHaveLength(1)
  })

  it('keeps a missing key missing (not undefined)', () => {
    const out = unpack<Array<Record<string, unknown>>>(pack([{ a: 1 }, { b: 2 }]))
    expect(out).toEqual([{ a: 1 }, { b: 2 }])
    expect('b' in out[0]).toBe(false)
  })

  it('packs a record of same-shaped objects (Adopt Me variants keyed by name)', () => {
    const pets = Array.from({ length: 30 }, (_, i) => ({
      slug: `p${i}`,
      values: { FR: { variant: 'FR', tradeValue: i, cashUsd: null }, NFR: { variant: 'NFR', tradeValue: i * 2, cashUsd: 1.5 } },
    }))
    const packed = pack(pets)
    expect(unpack(packed)).toEqual(pets)
    expect(JSON.stringify(packed).match(/tradeValue/g)!.length).toBeLessThan(5)
  })

  it('stores a shared URL prefix and repeated strings once', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      img: i === 3 ? null : `https://cdn.example.com/values-items/mm2/item-${i}.webp`,
      rarity: i % 3 === 0 ? 'Godly' : i % 3 === 1 ? 'Ancient' : null,
      ...(i === 5 ? {} : { tag: 'x' }),
    }))
    const packed = pack(rows)
    expect(unpack(packed)).toEqual(rows)
    const json = JSON.stringify(packed)
    expect(json.match(/cdn\.example\.com/g)).toHaveLength(1)
    expect(json.match(/Godly/g)).toHaveLength(1)
  })

  it('leaves primitives and one-row arrays alone', () => {
    expect(pack([1, 2])).toEqual([1, 2])
    expect(pack([{ a: 1 }])).toEqual([{ a: 1 }])
    expect(unpack(pack('x'))).toBe('x')
  })
})
