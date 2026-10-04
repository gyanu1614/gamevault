import { describe, it, expect } from 'vitest'
import { closestByName } from './closest'

const o = (id: string, name: string, price = 1) => ({ id, name, pricePerUnit: price })

describe('closestByName', () => {
  it('ranks by shared words, then price, and drops non-matches', () => {
    const offers = [o('a', 'Dragon Cannelloni 250M/s', 12), o('b', 'Garama', 3), o('c', 'Rainbow Dragon Cannelloni', 20), o('d', 'Dragon Egg', 1)]
    expect(closestByName(offers, 'diamond dragon cannelloni', 6).map((x) => x.id)).toEqual(['a', 'c', 'd'])
  })
  it('ignores one-letter and stop words', () => {
    expect(closestByName([o('a', 'A Pet'), o('b', 'The Egg')], 'a the of', 6)).toEqual([])
  })
})
