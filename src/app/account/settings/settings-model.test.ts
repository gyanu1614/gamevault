import { describe, expect, it } from 'vitest'
import {
  parseSettingsTab,
  settingsTabs,
  isDirty,
  shopNameCooldown,
  shopSlugPreview,
  usernameError,
} from './_settings-model'

describe('settingsTabs', () => {
  it('buyers get profile, notifications, security and privacy only', () => {
    expect(settingsTabs(false).map((t) => t.id)).toEqual(['profile', 'notifications', 'security', 'privacy'])
  })

  it('approved sellers also get seller, payouts and INFORM, in sidebar order', () => {
    expect(settingsTabs(true).map((t) => t.id)).toEqual([
      'profile', 'seller', 'payouts', 'notifications', 'security', 'privacy', 'inform',
    ])
  })
})

describe('parseSettingsTab', () => {
  it('accepts a known tab', () => {
    expect(parseSettingsTab('security', false)).toBe('security')
    expect(parseSettingsTab('payouts', true)).toBe('payouts')
  })

  it('falls back to profile for unknown or missing values', () => {
    expect(parseSettingsTab(null, true)).toBe('profile')
    expect(parseSettingsTab('billing', true)).toBe('profile')
  })

  it('does not open a seller-only tab for a buyer', () => {
    expect(parseSettingsTab('payouts', false)).toBe('profile')
    expect(parseSettingsTab('inform', false)).toBe('profile')
  })
})

describe('isDirty', () => {
  it('is false when every field matches the saved values', () => {
    expect(isDirty({ a: 'x', b: '' }, { a: 'x', b: '' })).toBe(false)
  })

  it('ignores whitespace-only differences at the ends', () => {
    expect(isDirty({ a: 'x' }, { a: '  x ' })).toBe(false)
  })

  it('is true when any field changed', () => {
    expect(isDirty({ a: 'x', b: 'y' }, { a: 'x', b: 'z' })).toBe(true)
  })
})

describe('shopNameCooldown', () => {
  const now = new Date('2026-09-29T12:00:00Z').getTime()

  it('is unlocked when the shop has no name yet', () => {
    expect(shopNameCooldown(null, '2026-09-28T12:00:00Z', now)).toEqual({ locked: false, daysRemaining: 0 })
  })

  it('is unlocked when there is no last-changed date', () => {
    expect(shopNameCooldown('BloxShop', null, now)).toEqual({ locked: false, daysRemaining: 0 })
  })

  it('locks for 30 days after a change and counts days left (rounded up)', () => {
    expect(shopNameCooldown('BloxShop', '2026-09-19T12:00:00Z', now)).toEqual({ locked: true, daysRemaining: 20 })
    expect(shopNameCooldown('BloxShop', '2026-09-19T18:00:00Z', now)).toEqual({ locked: true, daysRemaining: 21 })
  })

  it('unlocks once 30 days have passed', () => {
    expect(shopNameCooldown('BloxShop', '2026-08-30T12:00:00Z', now)).toEqual({ locked: false, daysRemaining: 0 })
  })
})

describe('usernameError', () => {
  it('accepts 3 to 30 letters, numbers, hyphens and underscores', () => {
    expect(usernameError('gyanu1615')).toBeNull()
    expect(usernameError('blox_market-2')).toBeNull()
    expect(usernameError('  abc  ')).toBeNull()
  })

  it('rejects empty, too short and too long names', () => {
    expect(usernameError('   ')).toMatch(/can’t be empty/)
    expect(usernameError('ab')).toMatch(/3 to 30/)
    expect(usernameError('a'.repeat(31))).toMatch(/3 to 30/)
  })

  it('rejects other characters, as the server does', () => {
    expect(usernameError('blox shop')).toMatch(/letters, numbers/)
    expect(usernameError('blox.shop')).toMatch(/letters, numbers/)
  })
})

describe('shopSlugPreview', () => {
  it('lower-cases and hyphenates like the shop URL', () => {
    expect(shopSlugPreview('Blox Shop!! 2')).toBe('blox-shop-2')
    expect(shopSlugPreview('  --Neon__Pets--  ')).toBe('neon-pets')
  })
})
