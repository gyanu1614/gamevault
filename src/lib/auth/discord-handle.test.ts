import { describe, it, expect, vi } from 'vitest'

const users: Record<string, unknown> = {
  'u-discord': { id: 'u-discord', identities: [{ provider: 'discord', identity_data: { full_name: 'gyanu.dev', name: 'gyanu.dev#0' } }] },
  'u-google': { id: 'u-google', identities: [{ provider: 'google', identity_data: { full_name: 'Gy Pandey' } }] },
}
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: users[id] ?? null }, error: users[id] ? null : { message: 'nope' } }) } },
  }),
}))

import { lookupDiscordHandle } from './discord-handle'

describe('lookupDiscordHandle', () => {
  it('returns the Discord username stored on the auth identity', async () => {
    expect(await lookupDiscordHandle('u-discord')).toBe('gyanu.dev')
  })
  it('is null for an account without a Discord identity or an unknown id', async () => {
    expect(await lookupDiscordHandle('u-google')).toBeNull()
    expect(await lookupDiscordHandle('nobody')).toBeNull()
  })
})
