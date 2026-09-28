/**
 * Admin activity feeds (integration) — getRecentActivity (dashboard "Recent
 * Activity") and getAllActivities (/admin/activities) in
 * src/lib/actions/admin-dashboard.ts, run as the fixture ADMIN's real session
 * client, so RLS (is_admin()) is exercised, not bypassed.
 *   · disputes show up — one entry per order (its latest dispute), with the
 *     order number, listing title and game resolved from the order. disputes
 *     has no FK to orders (the order id is transaction_id), so an embed of
 *     `orders` is a PGRST200 and the old feed silently had no disputes;
 *   · high-severity fraud flags show up (the old select named a column
 *     fraud_flags does not have);
 *   · a failing query is reported (success:false), never an empty feed;
 *   · a non-admin caller is refused (requireAdmin's redirect is not swallowed).
 * Seeded rows are dated ahead of now so rows from parallel suites can't push
 * them out of the feeds' limits.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, URL, ANON, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({ client: null as any, admin: true }))

vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }))
vi.mock('@/lib/actions/admin-permissions', () => ({
  requireAdmin: async () => {
    if (!state.admin) throw new Error('NEXT_REDIRECT')
    return { userId: 'admin' }
  },
}))

import { getAllActivities, getRecentActivity } from '@/lib/actions/admin-dashboard'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FEEDS = [
  ['getRecentActivity', getRecentActivity],
  ['getAllActivities', getAllActivities],
] as const

let fx: Fixture | null = null
const orderA = { id: '', number: '' }
const orderB = { id: '', number: '' }
const disputeIds = { aOld: '', aNew: '', b: '' }
let fraudId = ''
let listing = { title: '', gameName: '', gameIcon: undefined as string | undefined }
const ahead = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()
const at = { aOld: ahead(30), b: ahead(45), aNew: ahead(60), fraud: ahead(90) }

function sql(q: string): string[] {
  return execFileSync('psql', [DB_URL, '-Atq', '-c', q], { stdio: 'pipe' }).toString().trim().split('|')
}

async function deleteFixtureRows() {
  if (!fx) return
  const { error: de } = await fx.svc.from('disputes').delete().in('buyer_id', [fx.buyer.id])
  if (de) throw new Error(`disputes cleanup: ${de.message}`)
  const { error: fe } = await fx.svc.from('fraud_flags').delete().in('user_id', [fx.buyer.id])
  if (fe) throw new Error(`fraud_flags cleanup: ${fe.message}`)
}

describe.skipIf(!hasEnv)('admin activity feeds (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    state.client = fx.admin.client

    const base = {
      buyer_id: fx.buyer.id, seller_id: fx.seller.id, listing_id: fx.listingId, quantity: 1,
      unit_price: 12.34, subtotal: 12.34, platform_fee_rate: 0, payment_processing_fee_rate: 0,
      platform_fee: 0, payment_processing_fee: 0, total_amount: 12.34, seller_payout: 12.34,
      currency: 'USD', status: 'disputed', escrow_status: 'frozen',
    }
    const { data: orders, error: oe } = await fx.svc.from('orders').insert([base, base]).select('id, order_number')
    if (oe) throw new Error(`orders insert: ${oe.message}`)
    Object.assign(orderA, { id: (orders as any[])[0].id, number: (orders as any[])[0].order_number })
    Object.assign(orderB, { id: (orders as any[])[1].id, number: (orders as any[])[1].order_number })

    const dispute = (order: typeof orderA, extra: Record<string, unknown>) => ({
      transaction_id: order.id, order_reference: order.number, buyer_id: fx!.buyer.id, seller_id: fx!.seller.id,
      reason: 'item_not_received', title: `Order #${order.number}`, description: 'guard test',
      disputed_amount: 12.34, currency: 'USD', ...extra,
    })
    // Order A: a closed dispute, then a newer open one — only the newer shows.
    const { data: ds, error: de } = await fx.svc.from('disputes').insert([
      dispute(orderA, { status: 'closed', priority: 'normal', resolved_at: at.aOld, created_at: at.aOld, updated_at: at.aOld }),
      dispute(orderA, { status: 'open', priority: 'urgent', created_at: at.aNew, updated_at: at.aNew }),
      dispute(orderB, { status: 'under_review', priority: 'normal', reason: 'wrong_item', created_at: at.b, updated_at: at.b }),
    ]).select('id')
    if (de) throw new Error(`disputes insert: ${de.message}`)
    Object.assign(disputeIds, { aOld: (ds as any[])[0].id, aNew: (ds as any[])[1].id, b: (ds as any[])[2].id })

    const { data: flag, error: fe } = await fx.svc.from('fraud_flags').insert({
      user_id: fx.buyer.id, rule_id: 'guard_test', severity: 'high', status: 'open',
      description: `Guard fraud flag ${fx.ns.key}`, created_at: at.fraud,
    }).select('id').single()
    if (fe) throw new Error(`fraud_flags insert: ${fe.message}`)
    fraudId = (flag as any).id

    // Expected lookup values, straight from SQL.
    const [title, gameName, gameIcon] = sql(`
      select l.title, g.name, coalesce(g.image_url, '')
      from listings l join games g on g.id = l.game_id where l.id = '${fx.listingId}'`)
    listing = { title, gameName, gameIcon: gameIcon || undefined }
  }, 120_000)

  afterAll(async () => {
    if (!fx) return
    await deleteFixtureRows()
    await fx.cleanup() // orders go with the fixture users (DEPENDENT_TABLES)
  }, 120_000)

  it.each(FEEDS)('%s lists the latest dispute per order with order, listing and game', async (_name, feed) => {
    const res = await feed()
    expect(res.success, res.error).toBe(true)
    const ours = Object.values(disputeIds)
    const shown = res.activities!.filter((a) => a.type === 'dispute' && ours.includes(a.id))
    expect(shown.map((a) => a.id).sort()).toEqual([disputeIds.aNew, disputeIds.b].sort())

    const a = shown.find((x) => x.id === disputeIds.aNew)!
    expect(a).toMatchObject({
      title: 'Dispute',
      description: 'item not received',
      status: 'Open',
      severity: 'high',
      link: `/admin/disputes/${disputeIds.aNew}`,
      metadata: {
        orderNumber: orderA.number,
        itemTitle: listing.title,
        gameName: listing.gameName,
        gameIcon: listing.gameIcon,
        amount: 12.34,
        currency: 'USD',
      },
    })
    expect(new Date(a.timestamp).getTime()).toBe(new Date(at.aNew).getTime())

    const b = shown.find((x) => x.id === disputeIds.b)!
    expect(b).toMatchObject({
      description: 'wrong item',
      status: 'Under Review',
      severity: 'medium',
      metadata: { orderNumber: orderB.number, itemTitle: listing.title, gameName: listing.gameName },
    })
  })

  it.each(FEEDS)('%s lists high-severity fraud flags', async (_name, feed) => {
    const res = await feed()
    expect(res.success, res.error).toBe(true)
    const flag = res.activities!.find((a) => a.id === fraudId)
    expect(flag).toMatchObject({ type: 'fraud', title: 'Fraud Alert', status: 'Open', severity: 'high', link: '/admin/fraud' })
  })

  it.each(FEEDS)('%s reports a failing query instead of an empty feed', async (_name, feed) => {
    // A session whose JWT PostgREST rejects: every query errors.
    const saved = state.client
    state.client = createClient(URL!, ANON!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: 'Bearer not-a-jwt' } },
    })
    try {
      const res = await feed()
      expect(res.success).toBe(false)
      expect(res.error).toBeTruthy()
      expect(res.activities).toBeUndefined()
    } finally {
      state.client = saved
    }
  })

  it.each(FEEDS)('%s refuses a non-admin caller instead of swallowing the redirect', async (_name, feed) => {
    state.admin = false
    try {
      await expect(feed()).rejects.toThrow('NEXT_REDIRECT')
    } finally {
      state.admin = true
    }
  })
})
