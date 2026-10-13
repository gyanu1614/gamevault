import { describe, expect, it } from 'vitest'
import { movedPostTarget, postHref } from './post-url'

describe('postHref', () => {
  it('a game post lives under its PRIMARY game, whatever it is tagged with', () => {
    expect(postHref({ slug: 'mm2-halloween-2026', primaryGameSlug: 'murder-mystery-2' })).toBe('/murder-mystery-2/blog/mm2-halloween-2026')
  })
  it('a post with no game is a site-wide /blog post', () => {
    expect(postHref({ slug: 'how-safedrop-protection-works', primaryGameSlug: null })).toBe('/blog/how-safedrop-protection-works')
  })
})

describe('movedPostTarget', () => {
  it('a slug asked for under the wrong game goes to its real home', () => {
    expect(movedPostTarget({ slug: 'mm2-halloween-2026', primaryGameSlug: 'murder-mystery-2' }, 'adopt-me')).toBe('/murder-mystery-2/blog/mm2-halloween-2026')
  })
  it('no redirect when nothing was found or it is the same game', () => {
    expect(movedPostTarget(null, 'adopt-me')).toBeNull()
    expect(movedPostTarget({ slug: 's', primaryGameSlug: 'adopt-me' }, 'adopt-me')).toBeNull()
  })
  it('a site-wide post asked for under a game goes to /blog', () => {
    expect(movedPostTarget({ slug: 's', primaryGameSlug: null }, 'adopt-me')).toBe('/blog/s')
  })
  it('a renamed post (found by its old URL) goes to its new URL, even in the same game', () => {
    expect(movedPostTarget({ slug: 'sell-pets-guide', primaryGameSlug: 'adopt-me' }, 'adopt-me', 'old-sell-guide')).toBe('/adopt-me/blog/sell-pets-guide')
  })
})

describe('nextOldSlugs', () => {
  it('a live post that changes URL keeps its old one; the new URL never counts as old', async () => {
    const { nextOldSlugs } = await import('./post-url')
    expect(nextOldSlugs({ wasLive: true, previousSlug: 'a', newSlug: 'b', known: [] })).toEqual(['a'])
    expect(nextOldSlugs({ wasLive: true, previousSlug: 'b', newSlug: 'a', known: ['a'] })).toEqual(['b'])
    expect(nextOldSlugs({ wasLive: false, previousSlug: 'draft-url', newSlug: 'b', known: [] })).toEqual([])
    expect(nextOldSlugs({ wasLive: true, previousSlug: 'b', newSlug: 'b', known: ['a', 'a'] })).toEqual(['a'])
  })
})
