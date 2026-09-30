import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  userId: 'user-1' as string | null,
  upserts: [] as { row: Record<string, unknown>; opts: unknown }[],
  upsertError: null as { message: string } | null,
  readRow: null as Record<string, unknown> | null,
  readUserId: '' as string,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.userId ? { id: h.userId } : null } }) },
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      upsert: async (row: Record<string, unknown>, opts: unknown) => {
        h.upserts.push({ row, opts })
        return { error: h.upsertError }
      },
      select: () => ({
        eq: (_col: string, id: string) => {
          h.readUserId = id
          return { maybeSingle: async () => ({ data: h.readRow, error: null }) }
        },
      }),
    }),
  }),
}))

import { getMyEmailPreferences, setMyEmailPreference } from './email-preferences'

describe('setMyEmailPreference', () => {
  beforeEach(() => {
    h.userId = 'user-1'
    h.upserts = []
    h.upsertError = null
  })

  it('writes one switch for the signed-in user only', async () => {
    const result = await setMyEmailPreference('new_message', false)
    expect(result).toEqual({ success: true })
    expect(h.upserts).toHaveLength(1)
    expect(h.upserts[0].row).toMatchObject({ user_id: 'user-1', new_message: false })
    expect(Object.keys(h.upserts[0].row).sort()).toEqual(['new_message', 'updated_at', 'user_id'])
    expect(h.upserts[0].opts).toEqual({ onConflict: 'user_id' })
  })

  it('refuses unknown keys (no writing other columns like user_id)', async () => {
    const result = await setMyEmailPreference('user_id' as never, true)
    expect(result.success).toBe(false)
    expect(h.upserts).toHaveLength(0)
  })

  it('refuses non-boolean values', async () => {
    const result = await setMyEmailPreference('marketing', 'yes' as never)
    expect(result.success).toBe(false)
    expect(h.upserts).toHaveLength(0)
  })

  it('requires a signed-in user', async () => {
    h.userId = null
    const result = await setMyEmailPreference('marketing', true)
    expect(result.success).toBe(false)
    expect(h.upserts).toHaveLength(0)
  })

  it('reports a failed write', async () => {
    h.upsertError = { message: 'db down' }
    const result = await setMyEmailPreference('marketing', true)
    expect(result.success).toBe(false)
  })
})

describe('getMyEmailPreferences', () => {
  beforeEach(() => {
    h.userId = 'user-1'
    h.readRow = null
    h.readUserId = ''
  })

  it('returns the defaults when nothing is saved', async () => {
    const result = await getMyEmailPreferences()
    expect(result).toEqual({
      success: true,
      prefs: { new_order: true, new_message: true, new_review: true, payout_processed: true, marketing: false },
    })
    expect(h.readUserId).toBe('user-1')
  })

  it('returns the saved switches', async () => {
    h.readRow = { new_order: false, marketing: true }
    const result = await getMyEmailPreferences()
    expect(result.success && result.prefs.new_order).toBe(false)
    expect(result.success && result.prefs.marketing).toBe(true)
  })

  it('requires a signed-in user', async () => {
    h.userId = null
    const result = await getMyEmailPreferences()
    expect(result.success).toBe(false)
  })
})
