/**
 * The SAB crawl's import no longer revalidates value pages (T1, 2026-10-04).
 *
 * The sab-market-import edge function calls this route right after it
 * refreshes sab_price_display from the crawl's raw estimates — before the
 * runner's reprice applies the corrections. Revalidating here published
 * pre-correction prices on an exact-equality diff (every cent wobble). Every
 * scheduled import is now followed in the same job by
 * `pnpm reprice --game=sab --publish`, which goes through the one shared
 * contract (/api/internal/values-revalidate, thresholded changed items).
 *
 * So this route only acknowledges: a 2xx keeps the deployed edge function's
 * ROUTE-010 check green without a redeploy, and NOTHING is revalidated —
 * neither the items, nor the game tag (the pre-T1 fallback that rebuilt all
 * ~500 item pages), nor the list paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const revalidateTag = vi.fn()
const revalidatePath = vi.fn()

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

// The route rate-limits by IP before comparing the secret; keep it open here.
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimitByIp: async () => ({ limited: false }),
  rateLimitResponse: () => new Response('limited', { status: 429 }),
}))

const SECRET = 'test-revalidate-secret'

function post(body: unknown, secret: string = SECRET): Request {
  return new Request('https://dropmarket.gg/api/internal/sab-market-revalidate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-revalidate-secret': secret,
    },
    body: JSON.stringify(body),
  })
}

async function callRoute(request: Request) {
  const { POST } = await import('@/app/api/internal/sab-market-revalidate/route')
  const response = await POST(request)
  return { response, body: (await response.json()) as Record<string, unknown> }
}

describe('/api/internal/sab-market-revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SAB_MARKET_REVALIDATE_SECRET = SECRET
  })

  it('acknowledges the import and defers to the reprice publish step', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { response, body } = await callRoute(
      post({ reason: 'sab-market-import', changedSlugs: ['tim-cheese', 'la-vacca'] }),
    )
    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.mode).toBe('deferred-to-reprice')
    expect(body.import_reported_changed).toBe(2)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
    log.mockRestore()
  })

  it('never falls back to the whole-game tag, even without changedSlugs', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { body } = await callRoute(post({ reason: 'sab-market-import' }))
    expect(body.ok).toBe(true)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
    log.mockRestore()
  })

  it('rejects a wrong secret', async () => {
    const { response } = await callRoute(post({ changedSlugs: ['x'] }, 'wrong'))
    expect(response.status).toBe(401)
  })

  it('fails closed when the secret is not configured', async () => {
    delete process.env.SAB_MARKET_REVALIDATE_SECRET
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { response } = await callRoute(post({ changedSlugs: ['x'] }))
    expect(response.status).toBe(500)
    err.mockRestore()
  })
})
