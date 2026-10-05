/**
 * The publish step every pricing run shares: diff against the published
 * snapshot, revalidate only the moved items, THEN commit the snapshot.
 */
import { describe, it, expect, vi } from 'vitest'

import { DEFAULT_PRICE_CHANGE_RULE, type PublishedPrice } from './change-rule'
import { httpRevalidator, publishPriceChanges, type RevalidateRequest } from './publish'

type Row = { game_slug: string; item_slug: string; variant: string; prices: Record<string, number | null> }

/** In-memory values_published_prices: select/eq/order/range, upsert, delete. */
function fakeSnapshotClient(initial: Row[] = [], opts: { missing?: boolean } = {}) {
  const rows = [...initial]
  const writes: string[] = []
  const client = {
    from(table: string) {
      expect(table).toBe('values_published_prices')
      const filters: Array<[string, unknown]> = []
      let mode: 'select' | 'delete' = 'select'
      const builder: any = {
        select: () => builder,
        order: () => builder,
        eq: (col: string, val: unknown) => {
          filters.push([col, val])
          return builder
        },
        range: async (from: number, to: number) => {
          if (opts.missing) {
            return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.values_published_prices' in the schema cache" } }
          }
          const hit = rows.filter((r) => filters.every(([c, v]) => (r as any)[c] === v))
          return { data: hit.slice(from, to + 1), error: null }
        },
        upsert: async (batch: Row[]) => {
          writes.push(`upsert:${batch.length}`)
          for (const b of batch) {
            const i = rows.findIndex(
              (r) => r.game_slug === b.game_slug && r.item_slug === b.item_slug && r.variant === b.variant,
            )
            if (i >= 0) rows[i] = b
            else rows.push(b)
          }
          return { error: null }
        },
        delete: () => {
          mode = 'delete'
          return builder
        },
        then: (resolve: (v: unknown) => unknown) => {
          if (mode === 'delete') {
            writes.push('delete')
            for (let i = rows.length - 1; i >= 0; i -= 1) {
              if (filters.every(([c, v]) => (rows[i] as any)[c] === v)) rows.splice(i, 1)
            }
          }
          return Promise.resolve({ error: null }).then(resolve)
        },
      }
      return builder
    },
  }
  return { client, rows, writes }
}

const p = (itemSlug: string, variant: string, average: number | null): PublishedPrice => ({
  itemSlug,
  variant,
  prices: { average },
})
const snap = (item_slug: string, variant: string, average: number): Row => ({
  game_slug: 'adopt-me',
  item_slug,
  variant,
  prices: { average },
})

describe('publishPriceChanges', () => {
  const rule = DEFAULT_PRICE_CHANGE_RULE
  const silent = () => {}

  it('revalidates only the moved items, then commits only those rows', async () => {
    const db = fakeSnapshotClient([snap('owl', 'FR', 60), snap('dog', 'FR', 1)])
    const calls: RevalidateRequest[] = []
    const out = await publishPriceChanges({
      client: db.client,
      gameSlug: 'adopt-me',
      current: [p('owl', 'FR', 70), p('dog', 'FR', 1.02)],
      rule,
      revalidate: async (r) => void calls.push(r),
      log: silent,
    })
    expect(calls).toEqual([{ gameSlug: 'adopt-me', changedSlugs: ['owl'] }])
    expect(out.mode).toBe('changed-items')
    expect(out.changed_slugs).toEqual(['owl'])
    expect(out.snapshot_written).toBe(1)
    expect(db.rows.find((r) => r.item_slug === 'owl')!.prices.average).toBe(70)
    // The sub-threshold dog keeps its PUBLISHED baseline.
    expect(db.rows.find((r) => r.item_slug === 'dog')!.prices.average).toBe(1)
  })

  it('zero changes: posts an empty list (the route logs it) and writes nothing', async () => {
    const db = fakeSnapshotClient([snap('owl', 'FR', 60)])
    const calls: RevalidateRequest[] = []
    const out = await publishPriceChanges({
      client: db.client,
      gameSlug: 'adopt-me',
      current: [p('owl', 'FR', 60.5)],
      rule,
      revalidate: async (r) => void calls.push(r),
      log: silent,
    })
    expect(calls).toEqual([{ gameSlug: 'adopt-me', changedSlugs: [] }])
    expect(out.changed_count).toBe(0)
    expect(db.writes).toEqual([])
  })

  it('a failed revalidation leaves the snapshot untouched (next run retries the same items)', async () => {
    const db = fakeSnapshotClient([snap('owl', 'FR', 60)])
    await expect(
      publishPriceChanges({
        client: db.client,
        gameSlug: 'adopt-me',
        current: [p('owl', 'FR', 90)],
        rule,
        revalidate: async () => {
          throw new Error('HTTP 500')
        },
        log: silent,
      }),
    ).rejects.toThrow('HTTP 500')
    expect(db.writes).toEqual([])
    expect(db.rows[0].prices.average).toBe(60)
  })

  it('an empty snapshot is seeded without revalidating anything', async () => {
    const db = fakeSnapshotClient([])
    const revalidate = vi.fn()
    const out = await publishPriceChanges({
      client: db.client,
      gameSlug: 'adopt-me',
      current: [p('owl', 'FR', 60), p('dog', 'FR', 1)],
      rule,
      revalidate,
      log: silent,
    })
    expect(out.mode).toBe('seeded')
    expect(revalidate).not.toHaveBeenCalled()
    expect(db.rows).toHaveLength(2)
  })

  it('before the migration is pushed: falls back to the whole-game refresh, never fails the run', async () => {
    const db = fakeSnapshotClient([], { missing: true })
    const calls: RevalidateRequest[] = []
    const out = await publishPriceChanges({
      client: db.client,
      gameSlug: 'steal-an-egg',
      current: [p('egg', 'default', 1)],
      rule,
      revalidate: async (r) => void calls.push(r),
      log: silent,
    })
    expect(out.mode).toBe('full-fallback')
    expect(calls).toEqual([{ gameSlug: 'steal-an-egg', full: true }])
  })

  it('deletes a vanished row and counts it as a change', async () => {
    const db = fakeSnapshotClient([snap('owl', 'FR', 60), snap('frog', 'FR', 3)])
    const calls: RevalidateRequest[] = []
    const out = await publishPriceChanges({
      client: db.client,
      gameSlug: 'adopt-me',
      current: [p('owl', 'FR', 60)],
      rule,
      revalidate: async (r) => void calls.push(r),
      log: silent,
    })
    expect(calls).toEqual([{ gameSlug: 'adopt-me', changedSlugs: ['frog'] }])
    expect(out.snapshot_deleted).toBe(1)
    expect(db.rows.map((r) => r.item_slug)).toEqual(['owl'])
  })
})

describe('httpRevalidator — the runner side of the route contract', () => {
  it('POSTs the changed slugs with the shared secret header', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
    const revalidate = httpRevalidator({ baseUrl: 'https://dropmarket.gg', secret: 's3', fetchImpl })
    await revalidate({ gameSlug: 'adopt-me', changedSlugs: ['owl'] })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://dropmarket.gg/api/internal/values-revalidate?game=adopt-me')
    expect((init.headers as Record<string, string>)['x-values-revalidate-secret']).toBe('s3')
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'pricing-run', changedSlugs: ['owl'] })
  })

  it('asks for ?full=1 only for the fallback', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    await httpRevalidator({ baseUrl: 'https://dropmarket.gg', secret: 's', fetchImpl })({
      gameSlug: 'steal-an-egg',
      full: true,
    })
    const [url] = fetchImpl.mock.calls[0] as unknown as [string]
    expect(url).toBe('https://dropmarket.gg/api/internal/values-revalidate?game=steal-an-egg&full=1')
  })

  it('throws on a non-2xx so the job fails loudly', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }))
    await expect(
      httpRevalidator({ baseUrl: 'https://dropmarket.gg', secret: 'x', fetchImpl })({
        gameSlug: 'adopt-me',
        changedSlugs: [],
      }),
    ).rejects.toThrow('HTTP 401')
  })
})
