import { describe, it, expect } from 'vitest'
import { parseValueEvent } from './events'

describe('parseValueEvent', () => {
  it('accepts a CTA click with its state', () => {
    expect(
      parseValueEvent({ event: 'cta_click', surface: 'value_item', game: 'adopt-me', item: 'bat-dragon', variant: 'neon', state: 'other_variants' }),
    ).toEqual({ event: 'cta_click', surface: 'value_item', game_slug: 'adopt-me', item_slug: 'bat-dragon', variant: 'neon', state: 'other_variants', listing_id: null })
  })

  it('accepts a listing opened from a value surface', () => {
    const e = parseValueEvent({ event: 'listing_opened', surface: 'item_buy', game: 'steal-a-brainrot', item: 'dragon-cannelloni', listing: '29ce2a66-23dc-4c23-8f78-99f2d71dc99e' })
    expect(e?.listing_id).toBe('29ce2a66-23dc-4c23-8f78-99f2d71dc99e')
  })

  it('rejects unknown events, surfaces and states', () => {
    expect(parseValueEvent({ event: 'purchase', surface: 'value_item', game: 'adopt-me' })).toBeNull()
    expect(parseValueEvent({ event: 'value_view', surface: 'homepage', game: 'adopt-me' })).toBeNull()
    expect(parseValueEvent({ event: 'cta_click', surface: 'value_item', game: 'adopt-me', state: 'maybe' })).toBeNull()
  })

  it('rejects anything that is not a slug (no free text, so no personal data)', () => {
    expect(parseValueEvent({ event: 'value_view', surface: 'value_item', game: 'adopt-me', item: 'john@example.com' })).toBeNull()
    expect(parseValueEvent({ event: 'value_view', surface: 'value_item', game: 'Adopt Me' })).toBeNull()
    expect(parseValueEvent({ event: 'listing_opened', surface: 'item_buy', game: 'adopt-me', listing: 'not-a-uuid' })).toBeNull()
  })

  it('drops unknown fields', () => {
    const e = parseValueEvent({ event: 'value_view', surface: 'calculator', game: 'adopt-me', email: 'x@y.z' } as never)
    expect(e && 'email' in e).toBe(false)
  })
})
