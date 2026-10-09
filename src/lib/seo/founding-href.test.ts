import { describe, it, expect } from 'vitest'
import { foundingHref, readFoundingSrc } from './founding-href'

describe('founding-seller attribution', () => {
  it('puts the tag in the hash, never a robots-blocked query', () => {
    expect(foundingHref('footer')).toBe('/founding#src=footer')
    expect(foundingHref('roblox-sell-modal')).not.toContain('?')
  })
  it('reads the hash first, then a legacy ?src=', () => {
    expect(readFoundingSrc('#src=banner', new URLSearchParams('src=old'))).toBe('banner')
    expect(readFoundingSrc('', new URLSearchParams('src=old'))).toBe('old')
    expect(readFoundingSrc('#faq', new URLSearchParams(''))).toBeUndefined()
  })
})
