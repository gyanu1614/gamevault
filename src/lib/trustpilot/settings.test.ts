import { describe, it, expect, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

import { readReviewCount, trustboxVisible } from './settings'

const db = (result: { data?: unknown; error?: unknown } | Error) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => {
          if (result instanceof Error) throw result
          return { data: result.data ?? null, error: result.error ?? null }
        },
      }),
    }),
  }),
})

describe('trustpilot review-count switch', () => {
  it('reads the count an admin saved', async () => {
    expect(await readReviewCount(db({ data: { review_count: 14 } }))).toBe(14)
  })

  it('fails closed to 0 on an error, a missing row or a throw', async () => {
    expect(await readReviewCount(db({ error: { message: 'down' } }))).toBe(0)
    expect(await readReviewCount(db({ data: null }))).toBe(0)
    expect(await readReviewCount(db(new Error('network')))).toBe(0)
  })

  it('the TrustBox stays hidden below 10 reviews — no "0 reviews" anywhere', () => {
    expect(trustboxVisible(0)).toBe(false)
    expect(trustboxVisible(9)).toBe(false)
    expect(trustboxVisible(10)).toBe(true)
  })
})
