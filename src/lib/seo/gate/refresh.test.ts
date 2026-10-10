import { describe, it, expect, vi } from 'vitest'

import { adoptMeHeadline, refreshValueEvidence } from './refresh'

const NOW = '2026-10-09T12:00:00.000Z'
const SITE = 'https://dropmarket.gg'

/** A Supabase stand-in: seeded rows per table and per rpc, upserts captured. Filters are not evaluated. */
function fakeDb(seed: Record<string, any[]>, rpc: any[] = []) {
  const upserts: any[] = []
  const builder = (rows: any[]) => {
    const b: any = {}
    for (const m of ['select', 'eq', 'like', 'order', 'range', 'limit', 'in']) b[m] = () => b
    b.maybeSingle = async () => ({ data: rows[0] ?? null, error: null })
    b.then = (res: any, rej: any) => Promise.resolve({ data: rows, error: null }).then(res, rej)
    return b
  }
  return {
    upserts,
    from: (table: string) => {
      const b = builder(seed[table] ?? [])
      b.upsert = async (rows: any[]) => {
        upserts.push(...rows)
        return { error: null }
      }
      return b
    },
    rpc: () => builder(rpc),
  }
}

const days = (n: number, value: number) =>
  ({ days: Array.from({ length: n }, (_, i) => `2026-09-${String(10 + i).padStart(2, '0')}`), vals: Array(n).fill(value) })

describe('refreshValueEvidence', () => {
  it('ignores a game with no value pages', async () => {
    expect(await refreshValueEvidence(fakeDb({}), 'valorant')).toBeNull()
  })

  it('writes one evidence row per page, unpriced pages included, and logs nothing on a first run', async () => {
    const db = fakeDb(
      {
        values_items: [
          { slug: 'harvester', values_prices: { sample_size: 29, cheapest_usd: 12, price_changed_at: '2026-10-08T00:00:00Z' } },
          { slug: 'gingerscythe', values_prices: null },
        ],
        seo_settings: [{ gate_mode: 'report' }],
      },
      [{ item_slug: 'harvester', series_key: '', ...days(4, 12) }],
    )
    const record = vi.fn(async () => undefined)
    const r = await refreshValueEvidence(db, 'murder-mystery-2', { now: NOW, record, siteUrl: SITE })
    expect(r).toEqual({ game: 'murder-mystery-2', items: 2, moved: [], flipped: [] })
    expect(record).not.toHaveBeenCalled()
    const harvester = db.upserts.find((u) => u.item_slug === 'harvester')
    expect(harvester).toMatchObject({ observations: 29, history_days: 4, value_usd: 12, passes_gate: false, price_moved_at: '2026-09-10T00:00:00.000Z' })
    expect(db.upserts.find((u) => u.item_slug === 'gingerscythe')).toMatchObject({ observations: 0, value_usd: null, passes_gate: false })
  })

  it('logs a material move as value-change (page + hubs) and revalidates that item', async () => {
    const db = fakeDb(
      {
        values_items: [{ slug: 'harvester', values_prices: { sample_size: 29, cheapest_usd: 15, price_changed_at: NOW } }],
        seo_value_evidence: [{ item_slug: 'harvester', anchors: { '': 12 }, price_moved_at: '2026-09-10T00:00:00.000Z', passes_gate: true, passes_changed_at: '2026-09-20T00:00:00Z' }],
        seo_settings: [{ gate_mode: 'report' }],
      },
      [{ item_slug: 'harvester', series_key: '', ...days(10, 12) }],
    )
    const record = vi.fn(async () => undefined)
    const revalidateItem = vi.fn()
    const r = await refreshValueEvidence(db, 'murder-mystery-2', { now: NOW, record, revalidateItem, siteUrl: SITE })
    expect(r?.moved).toEqual(['harvester'])
    expect(record).toHaveBeenCalledWith(expect.arrayContaining(['/murder-mystery-2/values/harvester', '/murder-mystery-2/values']), { reason: 'value-change:murder-mystery-2' })
    expect(revalidateItem).toHaveBeenCalledWith('murder-mystery-2', 'harvester')
    expect(db.upserts[0]).toMatchObject({ price_moved_at: NOW, anchors: { '': 15 } })
  })

  it('logs gate flips only when the gate is enforced, and marks Google-indexed pages protected', async () => {
    const seed = (mode: string) => ({
      values_items: [{ slug: 'harvester', values_prices: { sample_size: 2, cheapest_usd: 12, price_changed_at: null } }],
      seo_value_evidence: [{ item_slug: 'harvester', anchors: { '': 12 }, price_moved_at: '2026-09-10T00:00:00.000Z', passes_gate: true, passes_changed_at: null }],
      seo_url_inspections: [{ url: `${SITE}/murder-mystery-2/values/harvester`, verdict: 'PASS', clicks_90d: 0 }],
      seo_settings: [{ gate_mode: mode }],
    })
    const series = [{ item_slug: 'harvester', series_key: '', ...days(10, 12) }]
    const report = vi.fn(async () => undefined)
    const db1 = fakeDb(seed('report'), series)
    expect((await refreshValueEvidence(db1, 'murder-mystery-2', { now: NOW, record: report, siteUrl: SITE }))?.flipped).toEqual(['harvester'])
    expect(report).not.toHaveBeenCalled()
    expect(db1.upserts[0]).toMatchObject({ passes_gate: false, is_protected: true, passes_changed_at: NOW })
    const enforce = vi.fn(async () => undefined)
    await refreshValueEvidence(fakeDb(seed('enforce'), series), 'murder-mystery-2', { now: NOW, record: enforce, siteUrl: SITE })
    expect(enforce).toHaveBeenCalledWith(['/murder-mystery-2/values/harvester'], { reason: 'gate-demote' })
  })

  it('reads Adopt Me per variant: real prices only, Fly Ride as the headline', async () => {
    const db = fakeDb(
      {
        adopt_me_pets: [{ id: 'p1', slug: 'bat-dragon' }],
        adopt_me_pet_values: [
          { pet_id: 'p1', variant: 'R', cash_value_usd: 120, reputable_count: 0, is_estimated: true, last_priced_at: null },
          { pet_id: 'p1', variant: 'FR', cash_value_usd: 290, reputable_count: 11, is_estimated: false, last_priced_at: '2026-10-08T09:25:40Z' },
          { pet_id: 'p1', variant: 'NFR', cash_value_usd: 600, reputable_count: 15, is_estimated: false, last_priced_at: '2026-10-07T09:05:37Z' },
        ],
        seo_settings: [{ gate_mode: 'report' }],
      },
      [
        { item_slug: 'bat-dragon', series_key: 'FR', ...days(8, 290) },
        { item_slug: 'bat-dragon', series_key: 'NFR', ...days(8, 600) },
      ],
    )
    await refreshValueEvidence(db, 'adopt-me', { now: NOW, record: vi.fn(), siteUrl: SITE })
    expect(db.upserts[0]).toMatchObject({ observations: 15, value_usd: 290, history_days: 8, passes_gate: true, anchors: { FR: 290, NFR: 600 } })
  })
})

describe('adoptMeHeadline', () => {
  it('prefers a real Fly Ride price, else the best-covered real price', () => {
    expect(adoptMeHeadline([{ variant: 'NFR', cashUsd: 600, offers: 15, estimated: false }, { variant: 'FR', cashUsd: 290, offers: 11, estimated: false }])?.variant).toBe('FR')
    expect(adoptMeHeadline([{ variant: 'FR', cashUsd: 290, offers: 0, estimated: true }, { variant: 'N', cashUsd: 50, offers: 3, estimated: false }, { variant: 'NFR', cashUsd: 600, offers: 9, estimated: false }])?.variant).toBe('NFR')
    expect(adoptMeHeadline([])).toBeNull()
  })
})
