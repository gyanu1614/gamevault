/**
 * /admin/buy-rails switch, end to end against the local stack: the real
 * server action writes buy_rail_settings with the service role, refreshes the
 * public readers' cache tag, and the public reader then sees the switch.
 * Only admins / super admins may flip it; everyone else changes nothing.
 * The role check and next/cache are mocked (no Next runtime in vitest).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let actor: { userId: string } | null = null
let role = 'super_admin'
const revalidated: string[] = []

vi.mock('@/lib/actions/admin-permissions', () => ({
  requireRole: async (roles: string[]) => {
    if (!actor) throw new Error('redirect:/login')
    if (!roles.includes(role)) throw new Error(`Role not allowed: ${role}`)
    return { userId: actor.userId, email: 'guard@example.com', role, permissions: [] }
  },
}))
vi.mock('next/cache', () => ({
  revalidatePath: (p: string) => revalidated.push(`path:${p}`),
  revalidateTag: (t: string) => revalidated.push(`tag:${t}`),
  unstable_cache: (fn: any) => fn,
}))
vi.mock('server-only', () => ({}))
// The public reader's import graph reaches the cookie client (seller presence);
// the reads under test are all anon / service role, so it is never called.
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => { throw new Error('no cookie client in this test') } }))

async function row() {
  const { data } = await fx!.svc.from('buy_rail_settings').select('blog, value_item, value_list, calculator, updated_by').eq('id', 1).single()
  return data as { blog: boolean; value_item: boolean; value_list: boolean; calculator: boolean; updated_by: string | null }
}

describe.skipIf(!hasEnv)('admin buy rails switch (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  }, 120_000)

  afterAll(async () => {
    await fx?.svc.from('buy_rail_settings').update({ blog: true, value_item: true, value_list: true, calculator: true, updated_by: null }).eq('id', 1)
    await fx?.cleanup()
  }, 120_000)

  it('signed out: the action refuses and nothing changes', async () => {
    const { setBuyRailSurface } = await import('@/lib/actions/admin-buy-rails')
    actor = null
    await expect(setBuyRailSurface('blog', false)).rejects.toThrow(/login/)
    expect((await row()).blog).toBe(true)
  })

  it('a non-admin role: refused, nothing changes', async () => {
    const { setBuyRailSurface } = await import('@/lib/actions/admin-buy-rails')
    actor = { userId: fx!.seller.id }
    role = 'moderator'
    await expect(setBuyRailSurface('blog', false)).rejects.toThrow(/Role not allowed/)
    expect((await row()).blog).toBe(true)
  })

  it('an admin switches blog rails off: the row changes, the readers are refreshed, the public read sees it', async () => {
    const { setBuyRailSurface } = await import('@/lib/actions/admin-buy-rails')
    const { getRailSettings } = await import('@/lib/buy-rails/server')
    const { BUY_RAILS_TAG } = await import('@/lib/buy-rails/tags')
    actor = { userId: fx!.admin.id }
    role = 'admin'
    revalidated.length = 0
    await expect(setBuyRailSurface('blog', false)).resolves.toEqual({ ok: true })
    const r = await row()
    expect(r).toMatchObject({ blog: false, value_item: true, value_list: true, calculator: true, updated_by: fx!.admin.id })
    expect(revalidated).toContain(`tag:${BUY_RAILS_TAG}`)
    expect(revalidated).toContain('path:/admin/buy-rails')
    expect(await getRailSettings()).toEqual({ blog: false, value_item: true, value_list: true, calculator: true })
  })

  it('and back on', async () => {
    const { setBuyRailSurface } = await import('@/lib/actions/admin-buy-rails')
    await expect(setBuyRailSurface('blog', true)).resolves.toEqual({ ok: true })
    expect((await row()).blog).toBe(true)
  })

  it('each surface switches on its own', async () => {
    const { setBuyRailSurface, getBuyRailSettingsAdmin } = await import('@/lib/actions/admin-buy-rails')
    await setBuyRailSurface('value_item', false)
    await setBuyRailSurface('calculator', false)
    expect(await getBuyRailSettingsAdmin()).toEqual({ ok: true, data: { blog: true, value_item: false, value_list: true, calculator: false } })
  })

  it('an unknown surface is rejected', async () => {
    const { setBuyRailSurface } = await import('@/lib/actions/admin-buy-rails')
    expect(await setBuyRailSurface('homepage' as any, false)).toEqual({ ok: false, error: 'Unknown setting' })
  })
})
