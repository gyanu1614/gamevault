/**
 * The SAB price crawl revalidates ONLY the items whose prices moved.
 *
 * The publish step diffs the freshly materialised prices against the previous
 * snapshot (`sab_refresh_price_display_changed`, migration 20260922172054) and
 * POSTs the changed slugs here. Before that, this route called
 * `revalidateTag('values:steal-a-brainrot')` on every crawl, marking all ~500
 * item pages stale 8× a day whether or not a number changed — ~80% of the
 * monthly ISR budget (build audit 2026-09-22, §4).
 *
 * The fallback matters as much as the happy path: a body without
 * `changedSlugs` (an older edge-function deployment, or a manual curl) must
 * still refresh everything rather than silently refreshing nothing.
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

  it('revalidates only the changed items, not the whole game', async () => {
    const { body } = await callRoute(
      post({ reason: 'sab-market-import', changedSlugs: ['tim-cheese', 'la-vacca'] }),
    )

    expect(body.ok).toBe(true)
    expect(body.mode).toBe('changed-items')
    expect(body.changed_count).toBe(2)

    const tags = revalidateTag.mock.calls.map(([tag]) => tag)
    expect(tags).toContain('price:steal-a-brainrot:tim-cheese')
    expect(tags).toContain('price:steal-a-brainrot:la-vacca')
    // The lists rank every item by price, so they move when anything moves.
    expect(tags).toContain('price:steal-a-brainrot')
    // The whole-game CONTENT tag would mark all ~500 item pages stale.
    expect(tags).not.toContain('values:steal-a-brainrot')
  })

  it('revalidates no item page when nothing changed', async () => {
    const { body } = await callRoute(post({ changedSlugs: [] }))

    expect(body.ok).toBe(true)
    expect(body.changed_count).toBe(0)
    // An empty crawl is the common case once prices settle; it must not fall
    // back to the whole-game tag, or the optimisation does nothing.
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('falls back to the whole-game tag when the body omits changedSlugs', async () => {
    const { body } = await callRoute(post({ reason: 'sab-market-import' }))

    expect(body.ok).toBe(true)
    expect(body.mode).toBe('whole-game-fallback')
    expect(revalidateTag.mock.calls.map(([tag]) => tag)).toContain(
      'values:steal-a-brainrot',
    )
  })

  it('always revalidates the directory and calculator paths', async () => {
    await callRoute(post({ changedSlugs: ['tim-cheese'] }))

    const paths = revalidatePath.mock.calls.map(([path]) => path)
    expect(paths).toContain('/steal-a-brainrot/values')
    expect(paths).toContain('/steal-a-brainrot/calculator')
  })

  it('rejects a wrong secret without revalidating anything', async () => {
    const { response } = await callRoute(post({ changedSlugs: ['x'] }, 'wrong'))

    expect(response.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
