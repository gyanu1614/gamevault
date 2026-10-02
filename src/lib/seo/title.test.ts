import { describe, it, expect } from 'vitest'
import { pageTitle, socialTitle } from './title'

describe('pageTitle', () => {
  it('leaves a bare title to the layout template', () => {
    expect(pageTitle('Bat Dragon Value')).toBe('Bat Dragon Value')
  })

  it('does not let the template add the brand twice', () => {
    expect(pageTitle('Adopt Me Pets | DropMarket')).toEqual({ absolute: 'Adopt Me Pets | DropMarket' })
    expect(pageTitle('Adopt Me Pets — DropMarket')).toEqual({ absolute: 'Adopt Me Pets — DropMarket' })
    expect(pageTitle('Adopt Me Pets - dropmarket ')).toEqual({ absolute: 'Adopt Me Pets - dropmarket' })
  })

  it('keeps a mid-title brand mention as a normal title', () => {
    expect(pageTitle('DropMarket Fees Explained')).toBe('DropMarket Fees Explained')
  })
})

describe('socialTitle', () => {
  it('brands a bare title once', () => {
    expect(socialTitle('Bat Dragon Value')).toBe('Bat Dragon Value | DropMarket')
    expect(socialTitle('Bat Dragon Value | DropMarket')).toBe('Bat Dragon Value | DropMarket')
  })
})
