import { describe, expect, it } from 'vitest'
import { becomeSellerRedirect, hasSupabaseSessionCookie, isBecomeSellerRoute } from './become-seller-redirect'

describe('become-a-seller entry points', () => {
  it('matches the three entry routes exactly (and their sub-paths)', () => {
    expect(isBecomeSellerRoute('/account/become-seller')).toBe(true)
    expect(isBecomeSellerRoute('/signup-become-seller')).toBe(true)
    expect(isBecomeSellerRoute('/early-seller')).toBe(true)
    expect(isBecomeSellerRoute('/early-seller/thanks')).toBe(true)
    expect(isBecomeSellerRoute('/account/seller-status')).toBe(false)
    expect(isBecomeSellerRoute('/early-sellers-faq')).toBe(false)
    expect(isBecomeSellerRoute('/adopt-me/sell')).toBe(false)
  })

  it('sends sellers to the wizard and blocked sellers to restrictions; everyone else stays', () => {
    expect(becomeSellerRedirect('seller')).toBe('/sell/new')
    expect(becomeSellerRedirect('seller_blocked')).toBe('/account/restrictions')
    for (const kind of ['applicant', 'admin', 'none', '', null, undefined]) {
      expect(becomeSellerRedirect(kind)).toBeNull()
    }
  })

  it('detects a Supabase session cookie (incl. chunked) and ignores others', () => {
    expect(hasSupabaseSessionCookie(['sb-cserfvellsliylifjkos-auth-token'])).toBe(true)
    expect(hasSupabaseSessionCookie(['sb-cserfvellsliylifjkos-auth-token.0'])).toBe(true)
    expect(hasSupabaseSessionCookie(['theme', 'consent'])).toBe(false)
    expect(hasSupabaseSessionCookie([])).toBe(false)
  })
})
