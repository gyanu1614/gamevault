import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The admin gate: every hero action calls requireAdmin() BEFORE anything else
 * and outside its try/catch, so a non-admin is redirected and no storage /
 * service-role work happens.
 */
const requireAdmin = vi.fn()
const createServiceRoleClient = vi.fn(() => {
  throw new Error('service role must not be reached')
})
vi.mock('@/lib/actions/admin-permissions', () => ({ requireAdmin: () => requireAdmin() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => createServiceRoleClient() }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('server-only', () => ({}))

import { createGameHeroUpload, processGameHero, removeGameHero, saveGameHeroPosition } from './game-hero'

const GAME = '11111111-2222-3333-4444-555555555555'

beforeEach(() => {
  requireAdmin.mockReset()
  createServiceRoleClient.mockClear()
})

describe('game hero actions — admin only', () => {
  it.each([
    ['createGameHeroUpload', () => createGameHeroUpload(GAME, { type: 'image/jpeg', size: 10 })],
    ['processGameHero', () => processGameHero(GAME, `${GAME}/_source/x.jpg`)],
    ['saveGameHeroPosition', () => saveGameHeroPosition(GAME, 50)],
    ['removeGameHero', () => removeGameHero(GAME)],
  ])('%s: a non-admin is stopped by requireAdmin (redirect) before any work', async (_n, call) => {
    requireAdmin.mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(call()).rejects.toThrow('NEXT_REDIRECT')
    expect(createServiceRoleClient).not.toHaveBeenCalled()
  })

  it('an admin with an invalid file gets a plain error, no storage call', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin' })
    createServiceRoleClient.mockImplementation(() => ({ storage: { from: vi.fn() } }) as never)
    const res = await createGameHeroUpload(GAME, { type: 'image/gif', size: 10 })
    expect(res).toEqual({ ok: false, error: 'Use a JPG, PNG, WebP or AVIF image.' })
  })

  it('an admin with an out-of-range position gets a plain error', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin' })
    createServiceRoleClient.mockImplementation(() => ({}) as never)
    expect(await saveGameHeroPosition(GAME, 400)).toEqual({ ok: false, error: 'Hero position must be between 0 and 100.' })
  })
})
