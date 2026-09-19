/**
 * Step 7a — /api/internal/values-revalidate is what the pricing job calls
 * after each run (runner-side reprice.mjs, per game). Two things it must get
 * right, both invisible until prices go stale in production:
 *
 *  1. The item pages are revalidated BY TAG, scoped to the game. The route
 *     used `revalidatePath('/steal-a-brainrot/values/[itemSlug]', 'page')`,
 *     which Next never matches (a page is tagged with its route pattern plus
 *     its concrete pathname; patch-fetch addImplicitTags, Next 14) — a silent
 *     no-op. Revalidating the route PATTERN would match, but it drops every
 *     game's ~700 item pages on every crawl (SAB 3 h + Steal An Egg 3 h +
 *     Adopt Me daily), which is the render bill this PR exists to cut. Each
 *     item page anchors its render to `values:<game>` (lib/values/revalidation),
 *     so revalidateTag hits exactly that game's pages.
 *  2. Every page that renders prices for the game is covered: the values hub,
 *     the item pages, methodology, and — where the game has them — the
 *     calculator and price-index. Their time-based revalidate is now a safety
 *     net; this call is the primary refresh.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const revalidatePath = vi.fn()
const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
}))
vi.mock('@/lib/security/internal-route-auth', () => ({
  authorizeInternalRequest: async () => ({ ok: true }),
  internalJson: (body: unknown, status = 200) => Response.json(body, { status }),
}))

async function post(game: string) {
  const { POST } = await import('@/app/api/internal/values-revalidate/route')
  const res = await POST(new Request(`https://dropmarket.gg/api/internal/values-revalidate?game=${game}`, { method: 'POST' }))
  return { status: res.status, body: await res.json() }
}
const paths = () => revalidatePath.mock.calls.map((c) => c.join(' '))

describe('values-revalidate route', () => {
  beforeEach(() => {
    revalidatePath.mockClear()
    revalidateTag.mockClear()
  })

  it('revalidates the item pages by the game tag and every price page SAB publishes', async () => {
    const { status } = await post('steal-a-brainrot')
    expect(status).toBe(200)
    expect(revalidateTag.mock.calls).toEqual([['values:steal-a-brainrot']])
    expect(paths()).toEqual(
      expect.arrayContaining([
        '/steal-a-brainrot/values',
        '/steal-a-brainrot/values/methodology',
        '/steal-a-brainrot/calculator',
        '/steal-a-brainrot/price-index',
      ]),
    )
    // Never a bracketed path: the concrete form is a no-op and the pattern
    // form drops every game.
    expect(paths().some((p) => p.includes('[itemSlug]'))).toBe(false)
  })

  it('skips pages a game does not publish (Steal An Egg: no calculator, no price-index)', async () => {
    await post('steal-an-egg')
    expect(revalidateTag.mock.calls).toEqual([['values:steal-an-egg']])
    expect(paths()).toEqual(
      expect.arrayContaining(['/steal-an-egg/values', '/steal-an-egg/values/methodology']),
    )
    expect(paths().some((p) => p.includes('calculator') || p.includes('price-index'))).toBe(false)
  })

  it('rejects an unknown game without touching the cache', async () => {
    const { status } = await post('rust')
    expect(status).toBe(400)
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
