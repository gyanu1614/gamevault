import { describe, expect, it } from 'vitest'
import { withFilterParams } from '@/lib/navigation/filter-params'
import { gridAddressValues, readGridAddress, type GridAddress } from './grid-address'

const ALLOWED = { rarities: ['Godly', 'Ancient'], types: ['Pets', 'Eggs'], letters: ['N', 'M', 'F', 'R'], forms: ['Chroma'], bounds: [0, 100] as const }
const EMPTY: GridAddress = { q: '', sort: 'recommended', rarities: [], types: [], letters: [], forms: [], price: null }

const read = (query: string) => readGridAddress(new URLSearchParams(query), ALLOWED)

describe('the Items page address', () => {
  it('brings back everything it wrote', () => {
    const shown: GridAddress = { q: 'immortal', sort: 'cheapest', rarities: ['Godly', 'Ancient'], types: ['Pets'], letters: ['N', 'F'], forms: ['Chroma'], price: [5, 40] }
    expect(read(withFilterParams('', gridAddressValues(shown)))).toEqual(shown)
  })

  it('writes nothing when nothing is picked', () => {
    expect(withFilterParams('', gridAddressValues(EMPTY))).toBe('')
  })

  it('leaves the page number alone', () => {
    expect(withFilterParams('?page=3', gridAddressValues({ ...EMPTY, q: 'immortal' }))).toBe('?page=3&q=immortal')
  })

  it('still reads the old search link, and renames it', () => {
    expect(read('search=frost').q).toBe('frost')
    const written = withFilterParams('?search=frost', gridAddressValues(read('search=frost')))
    expect(written).toBe('?q=frost')
  })

  it('drops what the page no longer offers', () => {
    expect(read('rarity=Godly,Gone&sort=madeup&trait=N,Z&type=Toys')).toEqual({ ...EMPTY, rarities: ['Godly'], letters: ['N'] })
  })
})
