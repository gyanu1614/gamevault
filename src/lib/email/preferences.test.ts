import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  error: null as { message: string } | null,
  throws: false,
  table: '' as string,
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => {
    if (h.throws) throw new Error('no service credentials')
    return {
      from: (table: string) => {
        h.table = table
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: h.row, error: h.error }),
            }),
          }),
        }
      },
    }
  },
}))

import { EMAIL_PREF_DEFAULTS, emailAllowed, isEmailPrefKey, resolveEmailPref, toEmailPrefs } from './preferences'

describe('email preference defaults', () => {
  it('transactional emails default on, marketing defaults off (opt-in)', () => {
    expect(EMAIL_PREF_DEFAULTS).toEqual({
      new_order: true,
      new_message: true,
      new_review: true,
      payout_processed: true,
      marketing: false,
    })
  })

  it('resolveEmailPref uses the stored boolean, else the default', () => {
    expect(resolveEmailPref({ new_order: false }, 'new_order')).toBe(false)
    expect(resolveEmailPref({ marketing: true }, 'marketing')).toBe(true)
    expect(resolveEmailPref(null, 'new_message')).toBe(true)
    expect(resolveEmailPref({ new_message: 'no' }, 'new_message')).toBe(true)
    expect(resolveEmailPref(undefined, 'marketing')).toBe(false)
  })

  it('toEmailPrefs fills every key', () => {
    expect(toEmailPrefs({ new_review: false })).toEqual({ ...EMAIL_PREF_DEFAULTS, new_review: false })
    expect(toEmailPrefs(null)).toEqual(EMAIL_PREF_DEFAULTS)
  })

  it('isEmailPrefKey accepts only the known switches', () => {
    expect(isEmailPrefKey('payout_processed')).toBe(true)
    expect(isEmailPrefKey('user_id')).toBe(false)
    expect(isEmailPrefKey('__proto__')).toBe(false)
  })
})

describe('emailAllowed', () => {
  beforeEach(() => {
    h.row = null
    h.error = null
    h.throws = false
    h.table = ''
  })

  it('reads the recipient row from email_preferences', async () => {
    h.row = { new_order: false }
    await expect(emailAllowed('seller-1', 'new_order')).resolves.toBe(false)
    expect(h.table).toBe('email_preferences')
  })

  it('no saved row means the default', async () => {
    await expect(emailAllowed('seller-1', 'new_order')).resolves.toBe(true)
    await expect(emailAllowed('seller-1', 'marketing')).resolves.toBe(false)
  })

  it('a read error or missing client falls back to the default, never throws', async () => {
    h.error = { message: 'boom' }
    await expect(emailAllowed('u', 'payout_processed')).resolves.toBe(true)
    await expect(emailAllowed('u', 'marketing')).resolves.toBe(false)
    h.throws = true
    await expect(emailAllowed('u', 'new_message')).resolves.toBe(true)
  })

  it('no user id means the default', async () => {
    await expect(emailAllowed(null, 'new_review')).resolves.toBe(true)
  })
})
