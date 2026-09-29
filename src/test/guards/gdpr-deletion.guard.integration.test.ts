/**
 * GDPR Art. 17 erasure (integration) — processGdprRequest in
 * src/lib/actions/gdpr.ts, run as the fixture ADMIN's session client.
 *
 * The old path called auth.admin.deleteUser on the SESSION client (anon key),
 * which can never succeed: it logged the failure into the request's notes and
 * still returned success with the request marked 'completed' — an erasure
 * reported done while the account and its data stayed.
 *   · completing a deletion request deletes the auth user and profile, and
 *     records the erasure in admin_activity_log (the request row cascades
 *     away with the user);
 *   · a deletion the database blocks (the user still has a dispute) is
 *     reported as a failure and leaves the request open ('processing', with
 *     the reason) — never 'completed', and nothing is half-deleted;
 *   · rejecting a request still works;
 *   · a non-admin caller is refused (requireAdmin's redirect is not swallowed).
 * The accounts deleted here are throwaway users minted in this file's
 * namespace, never the fixture's own.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({ client: null as any, adminId: '', admin: true }))

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
    return { userId: state.adminId }
  },
}))

import { processGdprRequest } from '@/lib/actions/gdpr'

let fx: Fixture | null = null
const victims: string[] = []
const disputeIds: string[] = []

/** A throwaway account in this file's namespace, with a pending deletion request. */
async function victimWithDeletionRequest(label: string): Promise<{ userId: string; requestId: string }> {
  const email = fx!.ns.email(label)
  const { data, error } = await fx!.svc.auth.admin.createUser({
    // Never signs in — a random password, not a literal a secret scanner flags.
    email, password: randomUUID(), email_confirm: true, user_metadata: { username: fx!.ns.username(label) },
  })
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`)
  const userId = data.user.id
  victims.push(userId)
  const { data: prof } = await fx!.svc.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (!prof) {
    const { error: pe } = await fx!.svc.from('profiles').insert({ id: userId, username: fx!.ns.username(label), email })
    if (pe) throw new Error(`profile insert(${label}): ${pe.message}`)
  }
  const { data: req, error: re } = await fx!.svc.from('gdpr_requests').insert({ user_id: userId, type: 'deletion' }).select('id').single()
  if (re) throw new Error(`gdpr_requests insert(${label}): ${re.message}`)
  return { userId, requestId: (req as any).id }
}

async function userExists(userId: string) {
  const { data } = await fx!.svc.auth.admin.getUserById(userId)
  const { data: prof } = await fx!.svc.from('profiles').select('id').eq('id', userId).maybeSingle()
  return { auth: Boolean(data?.user), profile: Boolean(prof) }
}

describe.skipIf(!hasEnv)('GDPR erasure: processGdprRequest (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    state.client = fx.admin.client
    state.adminId = fx.admin.id
  }, 120_000)

  afterAll(async () => {
    if (!fx) return
    const failures: string[] = []
    if (disputeIds.length) {
      const { error } = await fx.svc.from('disputes').delete().in('id', disputeIds)
      if (error) failures.push(`disputes: ${error.message}`)
    }
    for (const id of victims) {
      const { error } = await fx.svc.auth.admin.deleteUser(id)
      if (error && !/not found/i.test(error.message)) failures.push(`deleteUser(${id}): ${error.message}`)
      await fx.svc.from('profiles').delete().eq('id', id)
    }
    const { error: le } = await fx.svc.from('admin_activity_log').delete().eq('admin_id', fx.admin.id)
    if (le) failures.push(`admin_activity_log: ${le.message}`)
    await fx.cleanup()
    if (failures.length) throw new Error(`gdpr-deletion teardown:\n  - ${failures.join('\n  - ')}`)
  }, 120_000)

  it('completing a deletion request deletes the account and records the erasure', async () => {
    const { userId, requestId } = await victimWithDeletionRequest('erased')

    const res = await processGdprRequest(requestId, 'completed')
    expect(res.success, res.error).toBe(true)

    expect(await userExists(userId)).toEqual({ auth: false, profile: false })
    const { data: req } = await fx!.svc.from('gdpr_requests').select('id').eq('id', requestId)
    expect(req, 'the request row goes with the user (FK cascade)').toEqual([])

    const { data: log } = await fx!.svc.from('admin_activity_log')
      .select('admin_id, action, resource_type, resource_id')
      .eq('resource_id', userId)
    expect(log).toEqual([{ admin_id: fx!.admin.id, action: 'user.deleted', resource_type: 'user', resource_id: userId }])
  }, 30_000)

  it('a deletion the database blocks is reported and leaves the request open — never completed', async () => {
    const { userId, requestId } = await victimWithDeletionRequest('blocked')
    // disputes.buyer_id is NOT NULL with ON DELETE SET NULL: the delete must fail.
    const { data: d, error: de } = await fx!.svc.from('disputes').insert({
      buyer_id: userId, seller_id: fx!.seller.id, reason: 'other', title: 'guard dispute',
      description: 'blocks the erasure', disputed_amount: 1,
    }).select('id').single()
    if (de) throw new Error(`dispute insert: ${de.message}`)
    disputeIds.push((d as any).id)

    const res = await processGdprRequest(requestId, 'completed')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/account deletion failed/i)

    expect(await userExists(userId)).toEqual({ auth: true, profile: true })
    const { data: req } = await fx!.svc.from('gdpr_requests').select('status, notes, completed_at').eq('id', requestId).single()
    expect(req).toMatchObject({ status: 'processing', completed_at: null })
    expect((req as any).notes).toMatch(/account deletion failed/i)
  }, 30_000)

  it('rejecting a request still records the reason', async () => {
    const { userId, requestId } = await victimWithDeletionRequest('rejected')

    const res = await processGdprRequest(requestId, 'rejected', { rejectionReason: 'active orders' })
    expect(res.success, res.error).toBe(true)

    expect(await userExists(userId)).toEqual({ auth: true, profile: true })
    const { data: req } = await fx!.svc.from('gdpr_requests').select('status, rejection_reason').eq('id', requestId).single()
    expect(req).toEqual({ status: 'rejected', rejection_reason: 'active orders' })
  }, 30_000)

  it('a non-admin caller is refused, not handed { success: false }', async () => {
    state.admin = false
    try {
      await expect(processGdprRequest('00000000-0000-0000-0000-000000000000', 'completed')).rejects.toThrow('NEXT_REDIRECT')
    } finally {
      state.admin = true
    }
  }, 30_000)
})
