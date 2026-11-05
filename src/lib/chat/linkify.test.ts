import { describe, expect, it } from 'vitest'
import { linkifySegments } from './linkify'

describe('linkifySegments', () => {
  it('turns a bare https URL into a link', () => {
    expect(linkifySegments('https://www.roblox.com/game-pass/1531926770/VIP')).toEqual([
      {
        type: 'link',
        value: 'https://www.roblox.com/game-pass/1531926770/VIP',
        href: 'https://www.roblox.com/game-pass/1531926770/VIP',
      },
    ])
  })

  it('keeps the surrounding text and drops trailing punctuation from the link', () => {
    expect(linkifySegments('Buy this: https://roblox.com/share?code=abc&type=Server. Thanks')).toEqual([
      { type: 'text', value: 'Buy this: ' },
      {
        type: 'link',
        value: 'https://roblox.com/share?code=abc&type=Server',
        href: 'https://roblox.com/share?code=abc&type=Server',
      },
      { type: 'text', value: '. Thanks' },
    ])
  })

  it('links www. hosts over https', () => {
    expect(linkifySegments('go to www.dropmarket.gg')).toEqual([
      { type: 'text', value: 'go to ' },
      { type: 'link', value: 'www.dropmarket.gg', href: 'https://www.dropmarket.gg/' },
    ])
  })

  it('never links non-http schemes', () => {
    expect(linkifySegments('javascript:alert(1) data:text/html,x')).toEqual([
      { type: 'text', value: 'javascript:alert(1) data:text/html,x' },
    ])
  })

  it.each([
    'https://discord.gg/abc',
    'https://discord.com/invite/abc',
    'https://www.discordapp.com/invite/abc',
    'https://t.me/someone',
    'https://telegram.me/someone',
    'www.discord.gg/abc',
  ])('leaves %s as plain text', (url) => {
    expect(linkifySegments(`add me ${url} ok`)).toEqual([{ type: 'text', value: `add me ${url} ok` }])
  })

  it('still links other sites, including lookalike names', () => {
    expect(linkifySegments('https://notdiscord.gg/a')[0]?.type).toBe('link')
    expect(linkifySegments('https://www.roblox.com/share/x')[0]?.type).toBe('link')
  })

  it('handles several links and plain text', () => {
    const segs = linkifySegments('a http://x.com b https://y.com/z')
    expect(segs.map((s) => s.type)).toEqual(['text', 'link', 'text', 'link'])
    expect(linkifySegments('no links here')).toEqual([{ type: 'text', value: 'no links here' }])
  })
})
