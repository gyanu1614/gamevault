import { describe, it, expect } from 'vitest'
import { cleanListingSearch, listingOrder, LISTINGS_PAGE_SIZE } from './listings-query'

// /browse (2026-10-15): the grid loaded every live listing in one request, sorted
// "Price: Low to High" high to low, and passed the raw search into the
// PostgREST or() filter.
describe('browse listing query rules', () => {
  it('price sorts cheapest first; newest and popular sort high to low', () => {
    expect(listingOrder('price')).toEqual({ column: 'price', ascending: true })
    expect(listingOrder('created_at')).toEqual({ column: 'created_at', ascending: false })
    expect(listingOrder('sales')).toEqual({ column: 'sales', ascending: false })
    expect(listingOrder(undefined)).toEqual({ column: 'created_at', ascending: false })
  })

  it('a search cannot add or break filter clauses', () => {
    expect(cleanListingSearch('bat dragon')).toBe('bat dragon')
    expect(cleanListingSearch('a,status.eq.draft')).toBe('a status.eq.draft')
    expect(cleanListingSearch('x)(y*%\\z')).toBe('x y z')
    expect(cleanListingSearch('   ')).toBe('')
  })

  it('pages are small', () => {
    expect(LISTINGS_PAGE_SIZE).toBeLessThanOrEqual(30)
  })
})
