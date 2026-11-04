/**
 * Moderation buttons answer fast (integration): the decision, its audit row and
 * the public cache refresh happen before the action returns; the seller's email,
 * notification and the search-engine ping run after the response.
 *
 *   · an email that never finishes does not hold up any decision;
 *   · approving several listings is one action, one email, one notification;
 *   · a failure part way stops there and reports what was approved;
 *   · crossing the review threshold still releases the seller's whole queue.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { hasEnv, makeFixture, establishedTier, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({
  client: null as any,
  adminId: '',
  role: 'admin',
  background: [] as Promise<unknown>[],
  emailGate: Promise.resolve() as Promise<unknown>,
  emails: [] as { fn: string; args: any }[],
  submits: 0,
}))

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: (fn: any) => fn,
}))
vi.mock('server-only', () => ({}))
vi.mock('@vercel/functions', () => ({
  waitUntil: (p: Promise<unknown>) => state.background.push(p),
}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(
    Object.keys(real).map((k) => [
      k,
      async (args: unknown) => {
        state.emails.push({ fn: k, args })
        await state.emailGate
        return { success: true }
      },
    ]),
  )
})
vi.mock('@/lib/seo/indexnow', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  submitListingChanges: async () => {
    state.submits += 1
  },
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }))
vi.mock('@/lib/admin/context', () => ({
  getAdminGate: async () => ({ status: 'ok', user: { id: state.adminId }, admin: { role: state.role } }),
}))
vi.mock('@/lib/actions/admin-permissions', () => ({
  requireAdmin: async () => ({ userId: state.adminId }),
}))

import {
  approveListing,
  approveListings,
  rejectListing,
  requestListingChanges,
} from '@/lib/actions/moderation'

let fx: Fixture | null = null

async function pendingListing(): Promise<string> {
  const { data: base } = await fx!.svc.from('listings').select('game_id, game_category_id').eq('id', fx!.listingId).single()
  const { data, error } = await fx!.svc
    .from('listings')
    .insert({
      seller_id: fx!.seller.id,
      game_id: (base as any).game_id,
      game_category_id: (base as any).game_category_id,
      title: fx!.ns.listingTitle(),
      description: 'guard test throwaway',
      price: 1,
      quantity: 5,
      status: 'pending_approval',
    })
    .select('id')
    .single()
  if (error) throw new Error(`listing insert: ${error.message}`)
  return (data as any).id
}

async function statusOf(id: string): Promise<string> {
  const { data } = await fx!.svc.from('listings').select('status').eq('id', id).single()
  return (data as any).status
}

async function notificationsSince(since: string): Promise<{ type: string; message: string }[]> {
  const { data } = await fx!.svc
    .from('notifications')
    .select('type, message')
    .eq('user_id', fx!.seller.id)
    .gte('created_at', since)
  return (data ?? []) as { type: string; message: string }[]
}

async function logRowsFor(id: string): Promise<{ action: string }[]> {
  const { data } = await fx!.svc.from('admin_activity_log').select('action').eq('resource_id', id)
  return (data ?? []) as { action: string }[]
}

const settleBackground = () => Promise.all(state.background)

/** An email that does not finish until the test lets it. */
function holdEmails(): () => void {
  let release = () => {}
  state.emailGate = new Promise<void>((resolve) => {
    release = resolve
  })
  return release
}

describe.skipIf(!hasEnv)('moderation actions (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    state.client = fx.admin.client
    state.adminId = fx.admin.id
    // The fixture seller sits on the entry rank, so a normal approval does not
    // release the rest of the queue. The drain test changes this for itself.
    const { entry } = await establishedTier(fx.svc)
    const { error } = await fx.svc.from('profiles').update({ seller_tier: entry, is_verified: false }).eq('id', fx.seller.id)
    if (error) throw new Error(`seller tier: ${error.message}`)
  }, 60_000)

  afterAll(async () => {
    await settleBackground()
    if (fx) await fx.cleanup()
  }, 60_000)

  beforeEach(async () => {
    // Earlier approvals count toward the entry rank's review threshold (3).
    await settleBackground()
    await fx?.svc.from('listings').delete().eq('seller_id', fx.seller.id).neq('id', fx.listingId)
    state.client = fx?.admin.client
    state.background.length = 0
    state.emails.length = 0
    state.submits = 0
    state.emailGate = Promise.resolve()
  })

  it('approve: decided and logged before the response, seller told after it', async () => {
    const id = await pendingListing()
    const since = new Date().toISOString()
    const release = holdEmails()

    const result = await approveListing(id, 'looks fine')

    expect(result.success).toBe(true)
    expect(await statusOf(id)).toBe('active')
    expect((await logRowsFor(id)).map((r) => r.action)).toContain('listing_approved')
    expect(state.background.length).toBeGreaterThan(0)

    release()
    await settleBackground()
    expect(state.emails.map((e) => e.fn)).toEqual(['sendListingApprovedEmail'])
    expect((await notificationsSince(since)).map((n) => n.type)).toEqual(['listing_approved'])
    expect(state.submits).toBe(1)
  })

  it('every decision stamps updated_at, which History "Everything" sorts by', async () => {
    const stampOf = async (id: string) => {
      const { data } = await (fx!.svc.from('listings') as any).select('updated_at').eq('id', id).single()
      return new Date(data.updated_at).getTime()
    }

    const approved = await pendingListing()
    const beforeApprove = await stampOf(approved)
    await approveListing(approved)
    expect(await stampOf(approved)).toBeGreaterThan(beforeApprove)

    const rejected = await pendingListing()
    const beforeReject = await stampOf(rejected)
    await rejectListing(rejected, 'not allowed')
    expect(await stampOf(rejected)).toBeGreaterThan(beforeReject)
  })

  it('reject: decided before the response, seller told after it', async () => {
    const id = await pendingListing()
    const release = holdEmails()

    const result = await rejectListing(id, 'not allowed')

    expect(result.success).toBe(true)
    expect(await statusOf(id)).toBe('rejected')
    expect((await logRowsFor(id)).map((r) => r.action)).toContain('listing_rejected')

    release()
    await settleBackground()
    expect(state.emails.map((e) => e.fn)).toEqual(['sendListingRejectedEmail'])
    expect(state.emails[0].args.changesRequested).toBe(false)
  })

  it('request changes: decided before the response, seller told after it', async () => {
    const id = await pendingListing()
    const release = holdEmails()

    const result = await requestListingChanges(id, 'fix the title')

    expect(result.success).toBe(true)
    expect(await statusOf(id)).toBe('changes_requested')
    expect((await logRowsFor(id)).map((r) => r.action)).toContain('listing_changes_requested')

    release()
    await settleBackground()
    expect(state.emails[0].args.changesRequested).toBe(true)
  })

  it('approve all: one action, one email, one notification, a log row per listing', async () => {
    // Two: a third would cross the entry rank's threshold and drain the queue.
    const ids = [await pendingListing(), await pendingListing()]
    const since = new Date().toISOString()

    const result = await approveListings(ids)

    expect(result).toMatchObject({ success: true, approvedIds: ids })
    for (const id of ids) {
      expect(await statusOf(id)).toBe('active')
      expect((await logRowsFor(id)).map((r) => r.action)).toContain('listing_approved')
    }

    await settleBackground()
    expect(state.emails.map((e) => e.fn)).toEqual(['sendListingsApprovedEmail'])
    expect(state.emails[0].args.count).toBe(2)
    const notes = await notificationsSince(since)
    expect(notes).toHaveLength(1)
    expect(notes[0].message).toContain('2 of your listings')
    expect(state.submits).toBe(1)
  })

  it('approve all stops at a failure and reports what was approved', async () => {
    const ids = [await pendingListing(), await pendingListing(), await pendingListing()]
    state.client = {
      from: (table: string) => fx!.admin.client.from(table),
      rpc: (fn: string, args: any) =>
        args.listing_id === ids[1] ? { error: { message: 'boom' } } : fx!.admin.client.rpc(fn, args),
    }

    const result = await approveListings(ids)

    expect(result).toMatchObject({ success: false, approvedIds: [ids[0]], error: 'boom' })
    expect(await statusOf(ids[0])).toBe('active')
    expect(await statusOf(ids[2])).toBe('pending_approval')

    await settleBackground()
    expect(state.emails.map((e) => e.fn)).toEqual(['sendListingApprovedEmail'])
  })

  it('crossing the review threshold releases the seller\'s whole queue', async () => {
    const { tier, entry } = await establishedTier(fx!.svc)
    const first = await pendingListing()
    const rest = await pendingListing()
    // Verified, established seller: check_seller_needs_moderation answers false.
    await fx!.svc.from('profiles').update({ seller_tier: tier, is_verified: true }).eq('id', fx!.seller.id)
    try {
      const result = await approveListing(first)

      expect(result.success).toBe(true)
      expect(result.drainedCount).toBeGreaterThanOrEqual(1)
      expect(await statusOf(rest)).toBe('active')
      expect((await logRowsFor(first)).map((r) => r.action)).toContain('listing_threshold_drain')
    } finally {
      await fx!.svc.from('profiles').update({ seller_tier: entry, is_verified: false }).eq('id', fx!.seller.id)
    }
  })

  it('a staff member who is not a moderator changes nothing', async () => {
    const id = await pendingListing()
    state.role = 'finance'
    try {
      expect((await approveListings([id])).success).toBe(false)
      expect((await approveListing(id)).success).toBe(false)
      expect(await statusOf(id)).toBe('pending_approval')
    } finally {
      state.role = 'admin'
    }
  })
})
