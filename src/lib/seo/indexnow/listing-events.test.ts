import { describe, it, expect, vi } from 'vitest'

import {
  classifyListingChange,
  listingEventUrls,
  submitListingChanges,
  type ListingSnapshot,
} from '@/lib/seo/indexnow/listing-events'

const snap = (over: Partial<ListingSnapshot> = {}): ListingSnapshot => ({
  id: 'l1', status: 'active', title: '1000 VP', description: 'Fast', price: 10, images: ['a.png'],
  slug: 'vp-1000', gameSlug: 'valorant', categorySlug: 'buy-vp', ...over,
})

describe('classifyListingChange: a listing is submitted only when it really changed', () => {
  it('published: a new active listing, or one that goes live (approval, un-pause, resubmit)', () => {
    expect(classifyListingChange(undefined, snap())).toBe('published')
    expect(classifyListingChange(snap({ status: 'pending_approval' }), snap())).toBe('published')
    expect(classifyListingChange(snap({ status: 'paused' }), snap())).toBe('published')
  })
  it('a draft or pending listing that stays hidden is nothing', () => {
    expect(classifyListingChange(undefined, snap({ status: 'draft' }))).toBeNull()
    expect(classifyListingChange(snap({ status: 'draft' }), snap({ status: 'pending_approval' }))).toBeNull()
  })
  it('removed: deleted, sold out or paused while it was live', () => {
    expect(classifyListingChange(snap(), undefined)).toBe('removed')
    expect(classifyListingChange(snap(), snap({ status: 'sold' }))).toBe('removed')
    expect(classifyListingChange(snap(), snap({ status: 'paused' }))).toBe('removed')
  })
  it('deleting a listing that was never live is nothing', () => {
    expect(classifyListingChange(snap({ status: 'draft' }), undefined)).toBeNull()
  })

  describe('edited: only a material change to a live listing', () => {
    it.each([
      ['the title', { title: '2000 VP' }],
      ['the description', { description: 'Delivered in 5 minutes' }],
      ['the images', { images: ['a.png', 'b.png'] }],
      ['the price by 20%', { price: 12 }],
    ])('%s', (_what, change) => {
      expect(classifyListingChange(snap(), snap(change))).toBe('edited')
    })
    it.each([
      ['an unchanged listing', {}],
      ['a 2% price nudge', { price: 10.2 }],
      ['a price move under 25 cents', { price: 10.2 }],
      ['whitespace in the title', { title: ' 1000 VP ' }],
    ])('%s is nothing', (_what, change) => {
      expect(classifyListingChange(snap(), snap(change))).toBeNull()
    })
    it('a cheap listing needs the absolute threshold too: 1.00 -> 1.10 is 10% but 10 cents', () => {
      expect(classifyListingChange(snap({ price: 1 }), snap({ price: 1.1 }))).toBeNull()
    })
  })
})

describe('listingEventUrls', () => {
  it('published: its category page and the game hub (listing pages are noindex)', () => {
    expect(listingEventUrls('published', snap())).toEqual(['/valorant/buy-vp', '/valorant'])
  })
  it('removed: the listing too, so engines drop a stale copy', () => {
    expect(listingEventUrls('removed', snap())).toEqual(['/valorant/buy-vp/vp-1000', '/valorant/buy-vp', '/valorant'])
  })
  it('edited: only its category page (the hub shows no listing detail)', () => {
    expect(listingEventUrls('edited', snap())).toEqual(['/valorant/buy-vp'])
  })
  it('skips what it cannot build (no slug yet, or a missing category)', () => {
    expect(listingEventUrls('published', snap({ slug: null }))).toEqual(['/valorant/buy-vp', '/valorant'])
    expect(listingEventUrls('published', snap({ gameSlug: null }))).toEqual([])
  })

  it('never submits a currency listing URL (it has no page; the currency page is submitted)', () => {
    expect(listingEventUrls('published', snap({ categoryType: 'currency' }))).toEqual(['/valorant/buy-vp', '/valorant'])
    expect(listingEventUrls('edited', snap({ categoryType: 'currency' }))).toEqual(['/valorant/buy-vp'])
    expect(listingEventUrls('removed', snap({ categoryType: 'currency' }))).toEqual(['/valorant/buy-vp', '/valorant'])
  })
})

describe('submitListingChanges', () => {
  it('groups URLs by event, de-duplicated, with the event as the reason', async () => {
    const submit = vi.fn(async () => undefined)
    const before = new Map([
      ['a', snap({ id: 'a', slug: 'a', status: 'pending_approval' })],
      ['b', snap({ id: 'b', slug: 'b' })],
    ])
    const after = new Map([
      ['a', snap({ id: 'a', slug: 'a' })], // goes live
      // 'b' is gone: deleted
    ])
    await submitListingChanges(before, after, { submit })
    const calls = submit.mock.calls as unknown as [string[], { reason: string }][]
    expect(calls.map((c) => c[1].reason).sort()).toEqual(['listing-published', 'listing-removed'])
    expect(calls.find((c) => c[1].reason === 'listing-published')![0]).toEqual(['/valorant/buy-vp', '/valorant'])
  })

  it('submits nothing when nothing really changed', async () => {
    const submit = vi.fn(async () => undefined)
    await submitListingChanges(new Map([['a', snap()]]), new Map([['a', snap({ price: 10.1 })]]), { submit })
    expect(submit).not.toHaveBeenCalled()
  })

  it('never throws, even if the submit fails', async () => {
    const submit = vi.fn(async () => {
      throw new Error('boom')
    })
    await expect(submitListingChanges(new Map(), new Map([['a', snap()]]), { submit })).resolves.toBeUndefined()
  })
})
