import { describe, expect, it } from 'vitest'
import { classifyHref } from './links'

describe('classifyHref', () => {
  it('our own absolute links are internal paths (no nofollow, same tab)', () => {
    expect(classifyHref('https://dropmarket.gg/murder-mystery-2/values?x=1#a')).toEqual({ internal: '/murder-mystery-2/values?x=1#a' })
    expect(classifyHref('https://www.dropmarket.gg/blog')).toEqual({ internal: '/blog' })
    expect(classifyHref('/adopt-me/values')).toEqual({ internal: '/adopt-me/values' })
    expect(classifyHref('#how-to-sell')).toEqual({ internal: '#how-to-sell' })
  })
  it('other sites are external', () => {
    expect(classifyHref('https://www.roblox.com/games/1')).toEqual({ external: 'https://www.roblox.com/games/1' })
  })
  it('unsafe schemes are dropped', () => {
    expect(classifyHref('javascript:alert(1)')).toEqual({ unsafe: true })
    expect(classifyHref('data:text/html,x')).toEqual({ unsafe: true })
  })
})
