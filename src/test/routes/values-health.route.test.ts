import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const postOpsAlert = vi.fn(async () => true)
const readGameHealth = vi.fn()
vi.mock('@/lib/ops/discord-alert', () => ({ postOpsAlert }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/values/health', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/values/health')>()), readGameHealth }))

const fresh = () => ({ lastCatalogueRun: { startedAt: new Date().toISOString(), status: 'ok' }, lastPriceAt: new Date().toISOString(), listCount: 10 })
const req = (auth?: string) => new NextRequest('https://dropmarket.test/api/cron/values-health', { headers: auth ? { authorization: auth } : {} })

describe('GET /api/cron/values-health', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-test-secret'
    postOpsAlert.mockClear()
    readGameHealth.mockReset()
  })
  afterEach(() => {
    delete process.env.CRON_SECRET
  })

  it('refuses a request without the cron secret', async () => {
    const { GET } = await import('@/app/api/cron/values-health/route')
    expect((await GET(req())).status).toBe(401)
    expect(readGameHealth).not.toHaveBeenCalled()
  })

  it('healthy: 200 and no Discord post', async () => {
    readGameHealth.mockImplementation(async () => fresh())
    const { GET } = await import('@/app/api/cron/values-health/route')
    const res = await GET(req('Bearer cron-test-secret'))
    expect(res.status).toBe(200)
    expect(postOpsAlert).not.toHaveBeenCalled()
  })

  it('a problem: 500 and one post naming it', async () => {
    readGameHealth.mockImplementation(async (_db: unknown, game: { gameSlug: string }) => (game.gameSlug === 'steal-a-brainrot' ? { ...fresh(), listCount: 0 } : fresh()))
    const { GET } = await import('@/app/api/cron/values-health/route')
    const res = await GET(req('Bearer cron-test-secret'))
    expect(res.status).toBe(500)
    expect(postOpsAlert).toHaveBeenCalledTimes(1)
    expect(postOpsAlert.mock.calls[0][0]).toMatch(/Steal a Brainrot: the value list is empty/)
  })
})
