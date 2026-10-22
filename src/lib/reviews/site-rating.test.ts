import { describe, it, expect, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/supabase/anon', () => ({ createAnonClient: () => ({}) }))

import { MIN_REVIEWS, summariseRatings } from './site-rating'

describe('checkout buyer rating — real reviews only', () => {
  it('below the review floor there is no rating at all (the card hides)', () => {
    expect(summariseRatings(Array(MIN_REVIEWS - 1).fill(5))).toBeNull()
    expect(summariseRatings([])).toBeNull()
  })

  it('at the floor: the average of the real ratings, one decimal', () => {
    const r = summariseRatings([5, 5, 5, 4, 5, 5, 4, 5, 5, 5])
    expect(r).toEqual({ average: 4.8, count: 10 })
  })

  it('ignores anything that is not a 1–5 star rating', () => {
    const r = summariseRatings([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 9, Number.NaN])
    expect(r).toEqual({ average: 5, count: 10 })
  })
})
