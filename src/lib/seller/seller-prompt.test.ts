/**
 * The seller prompt's copy and doors (2026-10-08). Pins two owner rules:
 * no "verify" anywhere in seller-facing copy, and a seller goes to the
 * wizard while everyone else goes to /founding with the source tagged.
 */
import { describe, expect, it } from 'vitest'
import {
  HERO_EYEBROW,
  SELLER_PROMPT_LISTING_CAP,
  listingsCardCopy,
  listingsEmptyCopy,
  sellerPromptHref,
} from './seller-prompt'

const allCopy = [
  ...Object.values(HERO_EYEBROW).flatMap((c) => Object.values(c)),
  ...Object.values(listingsCardCopy('visitor', 'Valorant', 'Accounts')),
  ...Object.values(listingsCardCopy('seller', 'Valorant', 'Accounts')),
  ...Object.values(listingsEmptyCopy('visitor', 'Valorant', 'Accounts')),
  ...Object.values(listingsEmptyCopy('seller', 'Valorant', 'Accounts')),
]

describe('seller prompt copy', () => {
  it('never mentions verification, KYC or a $100 line', () => {
    for (const line of allCopy) {
      expect(line).not.toMatch(/verif|kyc|identity|\$100/i)
    }
  })

  it('names the game and category on the listings surfaces', () => {
    expect(listingsCardCopy('visitor', 'Valorant', 'Accounts').lead).toBe('Got Valorant Accounts to sell?')
    expect(listingsEmptyCopy('seller', 'Adopt Me', 'Pets').title).toBe('Be the first to list Adopt Me Pets')
  })
})

describe('seller prompt doors', () => {
  it('sends a seller to the wizard and everyone else to /founding with the source', () => {
    expect(sellerPromptHref('seller', 'hero')).toBe('/sell/new')
    expect(sellerPromptHref('visitor', 'hero')).toBe('/founding#src=hero')
    expect(sellerPromptHref('visitor', 'listings-empty')).toBe('/founding#src=listings-empty')
  })

  it('stops nudging a seller at three listings', () => {
    expect(SELLER_PROMPT_LISTING_CAP).toBe(3)
  })
})
