/**
 * Blog v2 (2026-10-13): Admin → Games → "Guides & content" switches a game's
 * content hub (games.content_hub_enabled). Off by default; the action is
 * admin-only and flips the flag; the hub nav's game list reads it.
 *
 * Touches one seeded game's flag and restores it in afterAll; creates no rows.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ANON, SVC, URL, assertGuardTargetAllowed, hasEnv } from './throwaway'

let admin = true
vi.mock('@/lib/actions/admin-permissions', () => ({
  requireAdmin: async () => {
    if (!admin) throw new Error('redirect:/login')
    return { userId: '00000000-0000-0000-0000-000000000000', email: 'guard@example.com', role: 'super_admin', permissions: [] }
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('server-only', () => ({}))
vi.mock('react', async (load) => ({ ...(await load<typeof import('react')>()), cache: <T,>(fn: T) => fn }))

let svc: SupabaseClient
let game: { id: string; slug: string; content_hub_enabled: boolean }

describe.skipIf(!hasEnv)('game content hub switch (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(URL, process.env)
    svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    const { data } = await svc.from('games').select('id, slug, content_hub_enabled').eq('slug', 'rust').single()
    game = data as typeof game
  })

  afterAll(async () => {
    if (game) await svc.from('games').update({ content_hub_enabled: game.content_hub_enabled }).eq('id', game.id)
  })

  it('a game without content starts switched off', () => {
    expect(game.content_hub_enabled).toBe(false)
  })

  it('the admin action switches it on and off', async () => {
    const { toggleGameContentHub } = await import('@/lib/actions/admin-games')
    expect(await toggleGameContentHub(game.id, false)).toEqual({ success: true })
    expect((await svc.from('games').select('content_hub_enabled').eq('id', game.id).single()).data).toEqual({ content_hub_enabled: true })
    expect(await toggleGameContentHub(game.id, true)).toEqual({ success: true })
    expect((await svc.from('games').select('content_hub_enabled').eq('id', game.id).single()).data).toEqual({ content_hub_enabled: false })
  })

  it('only an admin can use it', async () => {
    const { toggleGameContentHub } = await import('@/lib/actions/admin-games')
    admin = false
    await expect(toggleGameContentHub(game.id, false)).rejects.toThrow(/login/)
    admin = true
  })

  it('the public (anon) game list carries the flag the hub nav filters on', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } })
    const { data } = await anon.from('games').select('slug, content_hub_enabled').eq('content_hub_enabled', true).order('slug')
    expect((data ?? []).map((g: { slug: string }) => g.slug)).toEqual(['adopt-me', 'murder-mystery-2', 'steal-a-brainrot', 'steal-an-egg'])
  })
})
