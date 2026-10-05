/**
 * /api/internal/values-revalidate — the ONE revalidation contract every value
 * game's pricing run uses (T1, 2026-10-04).
 *
 * The runner diffs displayed prices against the last published snapshot with
 * the shared threshold and POSTs {changedSlugs}. What this route must get
 * right, all invisible until the Vercel bill or a stale page shows it:
 *
 *  1. Changed items only: one `price:<game>:<item>` tag per moved item, never
 *     the whole-game `values:<game>` tag (that rebuilt every item page of the
 *     game on every run — the Adopt Me / Steal an Egg cost before T1).
 *  2. Zero changes = zero revalidations, not a fallback to the whole game.
 *  3. `?full=1` is the only way to the whole-game tag (manual escape hatch).
 *  4. A request with neither is rejected, so no old caller silently becomes
 *     a whole-game refresh — or a no-op.
 *  5. Never a bracketed path: the concrete form is a no-op and the route
 *     pattern drops every game.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const revalidatePath = vi.fn()
const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
  unstable_cache: (fn: unknown) => fn,
}))
let authorized = true
vi.mock('@/lib/security/internal-route-auth', () => ({
  authorizeInternalRequest: async () =>
    authorized
      ? { ok: true }
      : { ok: false, response: Response.json({ ok: false }, { status: 401 }) },
  internalJson: (body: unknown, status = 200) => Response.json(body, { status }),
}))
// IndexNow: which value pages really changed is decided in lib/seo/indexnow.
const submitChangedValuePages = vi.fn(async (..._a: unknown[]) => 2)
vi.mock('@/lib/seo/indexnow', () => ({ submitChangedValuePages: (...a: unknown[]) => submitChangedValuePages(...a) }))
vi.mock('@/lib/supabase/service-role', () => ({ createServiceRoleClient: () => ({ marker: 'service-role' }) }))

async function post(game: string, body?: unknown, query = '') {
  const { POST } = await import('@/app/api/internal/values-revalidate/route')
  const res = await POST(
    new Request(`https://dropmarket.gg/api/internal/values-revalidate?game=${game}${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}
const paths = () => revalidatePath.mock.calls.map((c) => c.join(' '))
const tags = () => revalidateTag.mock.calls.map((c) => c[0])

describe('values-revalidate route — changed items (the scheduled path)', () => {
  beforeEach(() => {
    authorized = true
    revalidatePath.mockClear()
    revalidateTag.mockClear()
    submitChangedValuePages.mockClear()
  })

  it('revalidates one price tag per moved item and the list pages — never the game tag', async () => {
    const { status, body } = await post('adopt-me', { changedSlugs: ['owl', 'frost-dragon'] })
    expect(status).toBe(200)
    expect(body.mode).toBe('changed-items')
    expect(body.changed_count).toBe(2)
    expect(tags()).toEqual(['price:adopt-me:owl', 'price:adopt-me:frost-dragon'])
    expect(tags()).not.toContain('values:adopt-me')
    expect(tags()).not.toContain('price:adopt-me')
    expect(paths()).toEqual(expect.arrayContaining(['/adopt-me/values']))
    expect(paths().some((p) => p.includes('[itemSlug]'))).toBe(false)
  })

  it('zero changes: revalidates nothing at all (no tags, no paths, no IndexNow)', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { status, body } = await post('steal-an-egg', { changedSlugs: [] })
    expect(status).toBe(200)
    expect(body.changed_count).toBe(0)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(submitChangedValuePages).not.toHaveBeenCalled()
    expect(log.mock.calls.flat().join(' ')).toContain('0 changed items')
    log.mockRestore()
  })

  it('skips list pages a game does not publish (Steal an Egg: no calculator, no price-index)', async () => {
    await post('steal-an-egg', { changedSlugs: ['cosmic-egg'] })
    expect(tags()).toEqual(['price:steal-an-egg:cosmic-egg'])
    expect(paths().some((p) => p.includes('calculator') || p.includes('price-index'))).toBe(false)
  })

  it('SAB goes through the same contract (the reprice publish step calls it)', async () => {
    await post('steal-a-brainrot', { changedSlugs: ['tim-cheese'] })
    expect(tags()).toEqual(['price:steal-a-brainrot:tim-cheese'])
    expect(paths()).toEqual(
      expect.arrayContaining(['/steal-a-brainrot/values', '/steal-a-brainrot/calculator']),
    )
  })

  it('drops anything that is not a page slug, and de-duplicates', async () => {
    const { body } = await post('adopt-me', { changedSlugs: ['owl', 'owl', '../x', 'A B', 7, ''] })
    expect(body.changed_count).toBe(1)
    expect(tags()).toEqual(['price:adopt-me:owl'])
  })

  it('rejects a body without changedSlugs (no silent whole-game fallback)', async () => {
    const { status } = await post('adopt-me', { reason: 'pricing-run' })
    expect(status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects an empty request the same way', async () => {
    const { status } = await post('adopt-me')
    expect(status).toBe(400)
  })
})

describe('values-revalidate route — ?full=1 escape hatch', () => {
  beforeEach(() => {
    authorized = true
    revalidatePath.mockClear()
    revalidateTag.mockClear()
    submitChangedValuePages.mockClear()
  })

  it('revalidates the whole-game tag and every price page the game publishes', async () => {
    const { status, body } = await post('steal-a-brainrot', undefined, '&full=1')
    expect(status).toBe(200)
    expect(body.mode).toBe('full')
    expect(tags()).toEqual(['values:steal-a-brainrot'])
    expect(paths()).toEqual(
      expect.arrayContaining([
        '/steal-a-brainrot/values',
        '/steal-a-brainrot/values/methodology',
        '/steal-a-brainrot/calculator',
        '/steal-a-brainrot/price-index',
      ]),
    )
    expect(paths().some((p) => p.includes('[itemSlug]'))).toBe(false)
  })

  it('is behind the same auth', async () => {
    authorized = false
    const { status } = await post('adopt-me', undefined, '&full=1')
    expect(status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

describe('IndexNow after a republish: only value pages whose cash value moved', () => {
  beforeEach(() => {
    authorized = true
    submitChangedValuePages.mockClear()
  })

  it.each(['adopt-me', 'steal-an-egg'])('%s: runs the change detector once when items moved', async (game) => {
    const { status, body } = await post(game, { changedSlugs: ['x'] })
    expect(status).toBe(200)
    expect(submitChangedValuePages).toHaveBeenCalledTimes(1)
    expect(submitChangedValuePages.mock.calls[0][1]).toBe(game)
    expect(body.indexnow_changed).toBe(2)
  })

  it('steal-a-brainrot: left to its daily snapshot cron (no double submission)', async () => {
    const { body } = await post('steal-a-brainrot', { changedSlugs: ['x'] })
    expect(submitChangedValuePages).not.toHaveBeenCalled()
    expect(body.indexnow_changed).toBe(0)
  })
})

describe('values-revalidate route — input', () => {
  beforeEach(() => {
    authorized = true
    revalidatePath.mockClear()
    revalidateTag.mockClear()
  })

  it('rejects an unknown game without touching the cache', async () => {
    const { status } = await post('rust', { changedSlugs: ['x'] })
    expect(status).toBe(400)
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rejects a bad secret before reading anything', async () => {
    authorized = false
    const { status } = await post('adopt-me', { changedSlugs: ['owl'] })
    expect(status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
