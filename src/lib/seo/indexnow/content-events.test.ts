import { describe, it, expect, vi } from 'vitest'

import {
  gameLiveUrls,
  gameRemovedUrls,
  postEventUrls,
  submitGameLive,
  submitPostEvent,
} from '@/lib/seo/indexnow/content-events'

describe('postEventUrls', () => {
  it('a game post: the post and that game\'s blog index', () => {
    expect(postEventUrls({ gameSlug: 'valorant', slug: 'vp-guide' })).toEqual(['/valorant/blog/vp-guide', '/valorant/blog'])
  })
  it('a general post: the post and the global blog index', () => {
    expect(postEventUrls({ gameSlug: null, slug: 'how-we-work' })).toEqual(['/blog/how-we-work', '/blog'])
  })
})

describe('gameLiveUrls: a game hub is submitted only if the page will say index', () => {
  const base = { slug: 'palworld', contentTier: 'listed' as string | null, seoIndexable: null as boolean | null, enabledCategoryCount: 0, activeListingCount: 0 }
  it('a zero-inventory listed game: nothing yet (the hub is noindex, and there is no category to sell in)', () => {
    expect(gameLiveUrls(base)).toEqual([])
  })
  it('the sell page once the game has an enabled category', () => {
    expect(gameLiveUrls({ ...base, enabledCategoryCount: 2 })).toEqual(['/palworld/sell'])
  })
  it('a data-tier game: the hub too', () => {
    expect(gameLiveUrls({ ...base, contentTier: 'data', enabledCategoryCount: 1 })).toEqual(['/palworld', '/palworld/sell'])
  })
  it('an admin noindex override keeps both out', () => {
    expect(gameLiveUrls({ ...base, contentTier: 'data', enabledCategoryCount: 1, seoIndexable: false })).toEqual([])
  })
})

describe('gameRemovedUrls', () => {
  it('both pages, so engines see them 404', () => {
    expect(gameRemovedUrls('palworld')).toEqual(['/palworld', '/palworld/sell'])
  })
})

describe('the submit wrappers never throw', () => {
  it('submitPostEvent', async () => {
    const submit = vi.fn(async () => {
      throw new Error('x')
    })
    await expect(submitPostEvent('published', { gameSlug: 'valorant', slug: 'a' }, { submit })).resolves.toBeUndefined()
    expect(submit).toHaveBeenCalledWith(['/valorant/blog/a', '/valorant/blog'], { reason: 'post-published' })
  })
  it('submitGameLive submits only what the rule allows', async () => {
    const submit = vi.fn(async () => undefined)
    await submitGameLive({ slug: 'palworld', contentTier: 'listed', seoIndexable: null, enabledCategoryCount: 0, activeListingCount: 0 }, { submit })
    expect(submit).not.toHaveBeenCalled()
  })
})
