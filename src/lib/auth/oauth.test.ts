import { describe, expect, it } from 'vitest'
import {
  OAUTH_PROVIDERS,
  discordHandleFromUser,
  isPasswordGateExempt,
  needsPassword,
  oauthCallbackUrl,
  sanitizeNext,
  setPasswordUrl,
} from './oauth'

const googleOnly = {
  app_metadata: { provider: 'google', providers: ['google'] },
  identities: [{ provider: 'google', identity_data: { email: 'a@b.c', email_verified: true } }],
}

describe('needsPassword', () => {
  it('is true for a Google-only account with no stored flag', () => {
    expect(needsPassword(googleOnly)).toBe(true)
  })

  it('is false once the stored flag says a password was set', () => {
    expect(
      needsPassword({ ...googleOnly, app_metadata: { ...googleOnly.app_metadata, password_set: true } }),
    ).toBe(false)
  })

  it('is false for an email+password account', () => {
    expect(needsPassword({ app_metadata: { provider: 'email', providers: ['email'] }, identities: [] })).toBe(false)
  })

  it('is false when a Google identity was linked onto an email account', () => {
    expect(needsPassword({ app_metadata: { provider: 'email', providers: ['email', 'google'] } })).toBe(false)
  })

  it('falls back to the identities list when providers is missing', () => {
    expect(needsPassword({ app_metadata: {}, identities: [{ provider: 'discord' }] })).toBe(true)
    expect(needsPassword({ app_metadata: {}, identities: [{ provider: 'email' }] })).toBe(false)
  })

  it('never locks out an account with no provider information at all', () => {
    expect(needsPassword({ app_metadata: {} })).toBe(false)
    expect(needsPassword(null)).toBe(false)
    expect(needsPassword(undefined)).toBe(false)
  })
})

describe('sanitizeNext', () => {
  it('keeps same-origin relative paths', () => {
    expect(sanitizeNext('/account/orders?x=1')).toBe('/account/orders?x=1')
    expect(sanitizeNext('/founding#src=banner')).toBe('/founding#src=banner')
  })

  it('rejects anything that could leave the site', () => {
    for (const bad of ['//evil.com', 'https://evil.com', 'javascript:alert(1)', '/\\evil.com', 'account', '', null, undefined]) {
      expect(sanitizeNext(bad)).toBe('/')
    }
  })

  it('never lands a user back on an auth route', () => {
    expect(sanitizeNext('/auth/set-password?next=/x')).toBe('/')
    expect(sanitizeNext('/auth/callback')).toBe('/')
    expect(sanitizeNext('/login?redirect=/account')).toBe('/')
    expect(sanitizeNext('/signup')).toBe('/')
  })
})

describe('urls', () => {
  it('builds the callback URL and omits next for the homepage', () => {
    expect(oauthCallbackUrl('http://localhost:3025', '/')).toBe('http://localhost:3025/auth/callback')
    expect(oauthCallbackUrl('https://dropmarket.gg', '/account/orders?x=1')).toBe(
      'https://dropmarket.gg/auth/callback?next=%2Faccount%2Forders%3Fx%3D1',
    )
  })

  it('sanitizes next before putting it in the callback URL', () => {
    expect(oauthCallbackUrl('https://dropmarket.gg', 'https://evil.com')).toBe('https://dropmarket.gg/auth/callback')
  })

  it('builds the set-password URL with a sanitized next', () => {
    expect(setPasswordUrl('/account/orders')).toBe('/auth/set-password?next=%2Faccount%2Forders')
    expect(setPasswordUrl('/')).toBe('/auth/set-password')
    expect(setPasswordUrl('//evil.com')).toBe('/auth/set-password')
  })
})

describe('isPasswordGateExempt', () => {
  it('exempts only the auth routes (the fallback page mounts its own modal)', () => {
    expect(isPasswordGateExempt('/auth/set-password')).toBe(true)
    expect(isPasswordGateExempt('/auth/callback')).toBe(true)
  })

  it('gates everything else, the founding flow included (the modal opens over it)', () => {
    expect(isPasswordGateExempt('/')).toBe(false)
    expect(isPasswordGateExempt('/account')).toBe(false)
    expect(isPasswordGateExempt('/founding')).toBe(false)
    expect(isPasswordGateExempt('/authors')).toBe(false)
  })
})

describe('discordHandleFromUser', () => {
  it('reads the Discord username from the discord identity', () => {
    const user = {
      identities: [
        { provider: 'google', identity_data: { full_name: 'Gy Pandey' } },
        { provider: 'discord', identity_data: { full_name: 'gyanu.dev', name: 'gyanu.dev#0', custom_claims: { global_name: 'Gyanu' } } },
      ],
    }
    expect(discordHandleFromUser(user)).toBe('gyanu.dev')
  })

  it('falls back to name without a #0 discriminator, keeps a legacy #1234 one', () => {
    expect(discordHandleFromUser({ identities: [{ provider: 'discord', identity_data: { name: 'player#0' } }] })).toBe('player')
    expect(discordHandleFromUser({ identities: [{ provider: 'discord', identity_data: { name: 'Player#1234' } }] })).toBe('Player#1234')
  })

  it('returns null without a discord identity or a usable name', () => {
    expect(discordHandleFromUser(googleOnly)).toBeNull()
    expect(discordHandleFromUser({ identities: [{ provider: 'discord', identity_data: {} }] })).toBeNull()
    expect(discordHandleFromUser({ identities: [{ provider: 'discord', identity_data: { full_name: 'x'.repeat(40) } }] })).toBeNull()
    expect(discordHandleFromUser(null)).toBeNull()
  })
})

describe('OAUTH_PROVIDERS', () => {
  it('is google and discord, in that order', () => {
    expect(OAUTH_PROVIDERS).toEqual(['google', 'discord'])
  })
})
