import { describe, expect, it } from 'vitest'
import { listParam, priceParam, readAllowed, readList, readOne, readPriceParam, withFilterParams } from './filter-params'

const at = (query: string) => new URLSearchParams(query)

describe('withFilterParams', () => {
  it('sets values and keeps what it was not given', () => {
    expect(withFilterParams('?page=2', { q: 'immortal' })).toBe('?page=2&q=immortal')
  })
  it('removes a value that is off', () => {
    expect(withFilterParams('?q=immortal&sort=cheapest', { q: null, sort: 'cheapest' })).toBe('?sort=cheapest')
  })
  it('an empty address has no question mark', () => {
    expect(withFilterParams('?q=immortal', { q: null })).toBe('')
    expect(withFilterParams('', { q: null, sort: null })).toBe('')
  })
  it('encodes what it writes', () => {
    expect(at(withFilterParams('', { q: 'chroma & co' })).get('q')).toBe('chroma & co')
  })
})

describe('lists', () => {
  it('go in as one value and come back', () => {
    expect(listParam(['godly', 'ancient'])).toBe('godly,ancient')
    expect(listParam([])).toBeNull()
    expect(readList(at('rarity=godly,ancient'), 'rarity')).toEqual(['godly', 'ancient'])
    expect(readList(at(''), 'rarity')).toEqual([])
  })
  it('drop what the page no longer offers', () => {
    expect(readAllowed(at('rarity=godly,gone'), 'rarity', ['godly', 'ancient'])).toEqual(['godly'])
  })
})

describe('readOne', () => {
  it('takes a value the page offers, else the default', () => {
    expect(readOne(at('sort=cheapest'), 'sort', ['recommended', 'cheapest'], 'recommended')).toBe('cheapest')
    expect(readOne(at('sort=madeup'), 'sort', ['recommended', 'cheapest'], 'recommended')).toBe('recommended')
    expect(readOne(at(''), 'sort', ['recommended', 'cheapest'], 'recommended')).toBe('recommended')
  })
})

describe('price', () => {
  it('goes in as one value and comes back', () => {
    expect(priceParam([5, 40])).toBe('5-40')
    expect(priceParam(null)).toBeNull()
    expect(readPriceParam(at('price=5-40'), 'price', [0, 100])).toEqual([5, 40])
  })
  it('stays inside the limits', () => {
    expect(readPriceParam(at('price=5-400'), 'price', [10, 100])).toEqual([10, 100])
  })
  it('ignores nonsense and a range with nothing in it', () => {
    expect(readPriceParam(at(''), 'price', [0, 100])).toBeNull()
    expect(readPriceParam(at('price=abc-def'), 'price', [0, 100])).toBeNull()
    expect(readPriceParam(at('price=-'), 'price', [0, 100])).toBeNull()
    expect(readPriceParam(at('price=200-300'), 'price', [0, 100])).toBeNull()
  })
})
