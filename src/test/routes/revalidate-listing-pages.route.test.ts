/**
 * Step 7b — nightly safety net behind event-driven revalidation.
 *
 * The category pages are prerendered with a 24 h TTL and refreshed by listing
 * mutations. Anything that changes what they show without going through a
 * mutation path (a DB-side status change, an admin toggling a game or
 * category, a missed revalidateTag) is caught here: once a night, every
 * category page and the shared reads are marked stale. Lazy — a page only
 * re-renders on its next visit — so the cost is bounded by traffic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const revalidatePath = vi.fn()
const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
}))

async function get(auth?: string) {
  const { GET } = await import('@/app/api/cron/revalidate-listing-pages/route')
  const req = new Request('https://dropmarket.gg/api/cron/revalidate-listing-pages', {
    headers: auth ? { authorization: auth } : {},
  })
  const res = await GET(req as never)
  return { status: res.status, body: await res.json() }
}

describe('nightly listing-page revalidate', () => {
  beforeEach(() => {
    revalidatePath.mockClear()
    revalidateTag.mockClear()
    process.env.CRON_SECRET = 'test-secret'
  })

  it('marks every category page and the shared reads stale', async () => {
    const { status, body } = await get('Bearer test-secret')
    expect(status).toBe(200)
    expect(revalidatePath.mock.calls).toEqual([['/[gameSlug]/[categorySlug]', 'page']])
    expect(revalidateTag.mock.calls.map((c) => c[0]).sort()).toEqual([
      'games:directory',
      'profiles:test-sellers',
      'seller-presence:paused',
    ])
    expect(body.ok).toBe(true)
  })

  it('rejects a missing or wrong bearer without touching the cache', async () => {
    expect((await get()).status).toBe(401)
    expect((await get('Bearer nope')).status).toBe(401)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuses to run when CRON_SECRET is unset (never an open endpoint)', async () => {
    delete process.env.CRON_SECRET
    expect((await get('Bearer ')).status).toBe(401)
  })
})
