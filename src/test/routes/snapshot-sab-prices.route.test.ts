/**
 * The daily SAB snapshot cron used to re-send EVERY Steal a Brainrot URL (~504)
 * to IndexNow in one batch each day, whether or not a price moved. Bing flagged it
 * as "batch mode" and said other new pages were never submitted. The cron now
 * refreshes the SEO evidence (lib/seo/gate), which logs only the pages whose
 * cash value really moved for IndexNow, and still busts the ISR cache for every
 * price page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))
vi.mock('@/lib/security/cron-auth', () => ({ isCronAuthorized: () => true }))

const runEvidenceRefresh = vi.fn(async (game: string) => ({ game, items: 3, moved: ['alpha', 'beta', 'gamma'], flipped: [] as string[] }))
vi.mock('@/lib/seo/gate/run', () => ({ runEvidenceRefresh: (game: string) => runEvidenceRefresh(game) }))
const submitIndexNow = vi.fn(async (..._a: unknown[]) => undefined)
vi.mock('@/lib/seo/indexnow/submit', () => ({ submitIndexNow: (...a: unknown[]) => submitIndexNow(...a) }))

// A tiny Supabase stand-in: the corrected view has three brainrots, upserts succeed.
const VIEW_ROWS = ['alpha', 'beta', 'gamma'].map((slug, i) => ({
  brainrot_id: `b${i}`, brainrot_slug: slug, mutation_id: 'm0', mutation_slug: 'default',
  market_value_usd: 10 + i, market_low_usd: 9, market_high_usd: 12, external_sample_size: 5,
  source_count: 2, confidence_label: 'high', is_trade_ready: true, is_public_estimate: false,
  price_updated_at: '2026-10-01T00:00:00Z',
}))
const upserts: { table: string; rows: unknown[]; options: unknown }[] = []
function fakeAdmin() {
  const from = (table: string) => {
    const b: any = {}
    for (const m of ['select', 'eq', 'order', 'gt', 'or']) b[m] = () => b
    // Keyset read: one short page holds the fixture. OFFSET paging is a failure.
    b.limit = async () => ({ data: table === 'sab_price_display' ? VIEW_ROWS : [], error: null })
    b.range = () => {
      throw new Error(`OFFSET paging on ${table}`)
    }
    b.upsert = async (rows: unknown[], options: unknown) => {
      upserts.push({ table, rows, options })
      return { error: null }
    }
    b.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: table === 'sab_price_display' ? VIEW_ROWS : [], error: null }).then(resolve)
    return b
  }
  return { from }
}
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => fakeAdmin() }))

async function runCron() {
  const { GET } = await import('@/app/api/cron/snapshot-sab-prices/route')
  const res = await GET(new Request('https://dropmarket.gg/api/cron/snapshot-sab-prices') as never)
  return { status: res.status, body: await res.json() }
}

describe('snapshot-sab-prices cron', () => {
  beforeEach(() => {
    revalidatePath.mockClear()
    runEvidenceRefresh.mockClear()
    submitIndexNow.mockClear()
    upserts.length = 0
  })

  it('refreshes the SEO evidence (the change detector), once, for steal-a-brainrot', async () => {
    const { status, body } = await runCron()
    expect(status).toBe(200)
    expect(runEvidenceRefresh).toHaveBeenCalledTimes(1)
    expect(runEvidenceRefresh.mock.calls[0][0]).toBe('steal-a-brainrot')
    expect(body.indexnow_changed).toBe(3)
  })

  it('no longer sends every value URL in one batch', async () => {
    await runCron()
    expect(submitIndexNow).not.toHaveBeenCalled()
  })

  // 2026-10-20 usage audit (A6): re-rendering all ~500 SAB price pages every
  // day undid the changed-only publish. The pricing publish revalidates the
  // items whose price moved (and the list pages); the evidence refresh above
  // revalidates the pages whose evidence moved.
  it('does not re-render every price page', async () => {
    await runCron()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('records today without overwriting a row the reprice already wrote', async () => {
    const { body } = await runCron()
    const history = upserts.filter((u) => u.table === 'sab_price_history')
    expect(history).toHaveLength(1)
    expect(history[0].rows).toHaveLength(3)
    expect(history[0].options).toMatchObject({ onConflict: 'brainrot_id,mutation_id,history_date', ignoreDuplicates: true })
    expect(body.captured).toBe(3)
  })

  it('the response does not claim a "pinged" batch any more', async () => {
    const { body } = await runCron()
    expect('pinged' in body).toBe(false)
  })
})
