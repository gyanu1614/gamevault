import { describe, expect, it } from 'vitest'
import { sanitizeEventProperties, sanitizeUrl } from './sanitize'

describe('sanitizeUrl', () => {
  it('keeps the path and the campaign params only', () => {
    expect(sanitizeUrl('https://dropmarket.gg/adopt-me/values?utm_source=tiktok&utm_campaign=fall&email=a%40b.com&qty=3')).toBe(
      'https://dropmarket.gg/adopt-me/values?utm_source=tiktok&utm_campaign=fall',
    )
  })

  it('keeps ref and src (creator / source codes)', () => {
    expect(sanitizeUrl('https://dropmarket.gg/signup?ref=ALEX10&redirect=%2Faccount')).toBe('https://dropmarket.gg/signup?ref=ALEX10')
    expect(sanitizeUrl('https://dropmarket.gg/founding?src=banner')).toBe('https://dropmarket.gg/founding?src=banner')
  })

  it('drops the hash (founding #src=… is read by the page, not sent)', () => {
    expect(sanitizeUrl('https://dropmarket.gg/early-seller#src=x&token=abc')).toBe('https://dropmarket.gg/early-seller')
  })

  it('replaces uuids in the path (order and account ids)', () => {
    expect(sanitizeUrl('https://dropmarket.gg/account/orders/3f2b8c1e-1d2a-4b3c-9d4e-5f6a7b8c9d0e?paid=1')).toBe(
      'https://dropmarket.gg/account/orders/:id',
    )
  })

  it('keeps a relative path relative', () => {
    expect(sanitizeUrl('/checkout/3f2b8c1e-1d2a-4b3c-9d4e-5f6a7b8c9d0e?qty=2')).toBe('/checkout/:id')
  })

  it('cuts an external referrer down to its origin (search terms stay private)', () => {
    expect(sanitizeUrl('https://www.google.com/search?q=my+name', { originOnly: true })).toBe('https://www.google.com')
  })

  it('returns non-URL strings unchanged', () => {
    expect(sanitizeUrl('$direct')).toBe('$direct')
  })
})

describe('sanitizeEventProperties', () => {
  it('cleans every URL-ish property, including $set / $set_once', () => {
    const out = sanitizeEventProperties({
      $current_url: 'https://dropmarket.gg/a?utm_source=x&token=1',
      $pathname: '/account/orders/3f2b8c1e-1d2a-4b3c-9d4e-5f6a7b8c9d0e',
      $referrer: 'https://www.google.com/search?q=secret',
      $initial_referrer: 'https://reddit.com/r/x/comments/1?u=me',
      game: 'adopt-me',
      $set_once: { $initial_current_url: 'https://dropmarket.gg/b?email=a' },
    })
    expect(out).toEqual({
      $current_url: 'https://dropmarket.gg/a?utm_source=x',
      $pathname: '/account/orders/:id',
      $referrer: 'https://www.google.com',
      $initial_referrer: 'https://reddit.com',
      game: 'adopt-me',
      $set_once: { $initial_current_url: 'https://dropmarket.gg/b' },
    })
  })

  it("keeps PostHog's own required properties (dropping token makes PostHog discard the event)", () => {
    const props = { token: 'phc_project', distinct_id: 'abc', $session_id: 's1', $lib: 'web' }
    expect(sanitizeEventProperties(props)).toEqual(props)
  })

  it('drops properties named like personal data', () => {
    expect(sanitizeEventProperties({ email: 'a@b.com', username: 'x', phone: '1', game: 'mm2' })).toEqual({ game: 'mm2' })
  })
})
