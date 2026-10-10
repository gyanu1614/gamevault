import { describe, expect, it } from 'vitest'
import { vercelBeforeSend } from './vercel'

describe('vercelBeforeSend', () => {
  it('drops private query params (magic-link tokens, emails) and the hash', () => {
    expect(
      vercelBeforeSend({
        type: 'pageview',
        url: 'https://dropmarket.gg/founding?id=abc&token=s3cret#step-2',
      }),
    ).toEqual({ type: 'pageview', url: 'https://dropmarket.gg/founding' })
    expect(
      vercelBeforeSend({ type: 'pageview', url: 'https://dropmarket.gg/login?email=a%40b.com&next=/sell' }).url,
    ).toBe('https://dropmarket.gg/login')
  })

  it('keeps campaign params so referral reports still work', () => {
    expect(
      vercelBeforeSend({ type: 'pageview', url: 'https://dropmarket.gg/?utm_source=discord&q=owl' }).url,
    ).toBe('https://dropmarket.gg/?utm_source=discord')
  })

  it('masks ids in private paths (orders, checkout)', () => {
    expect(
      vercelBeforeSend({
        type: 'event',
        url: 'https://dropmarket.gg/orders/0b7e6a52-3c1d-4f5e-9a8b-1c2d3e4f5a6b',
      }).url,
    ).toBe('https://dropmarket.gg/orders/:id')
  })
})
