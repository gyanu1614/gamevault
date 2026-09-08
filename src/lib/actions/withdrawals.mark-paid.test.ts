import { describe, it, expect, vi, beforeEach } from 'vitest'

// markWithdrawalPaid is the missing half of the withdrawal money flow: the
// hold journal (→ payout_clearing) posts at request creation, and this action
// posts the balancing journal (payout_clearing → external_payout) via the
// withdrawal_payout RPC when ops actually sends the money. These tests pin
// the ordering (journal BEFORE the status flip — a failed journal must leave
// the request approved and retryable), the status gates, and comms isolation.

const h = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
  sendWithdrawalProcessedEmail: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: h.createClient }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: h.createServiceRoleClient }))
vi.mock('@/lib/actions/admin-permissions', () => ({
  requireAdmin: h.requireAdmin,
  requireRole: h.requireRole,
}))
vi.mock('@/lib/actions/wallet-ledger', () => ({ getMyWithdrawableBalance: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendWithdrawalProcessedEmail: h.sendWithdrawalProcessedEmail,
}))

import { markWithdrawalPaid } from '@/lib/actions/withdrawals'

const REQUEST_ID = 'req-1'
const ADMIN_ID = 'admin-1'

// Chainable PostgREST-builder stub: every method returns the builder, awaiting
// the chain (or .single()) resolves to `result`. Call args are recorded on the
// vi.fn() methods for assertions.
function createBuilder(result: any) {
  const builder: any = {}
  for (const m of ['select', 'eq', 'in', 'update', 'insert', 'single']) {
    builder[m] = vi.fn(() => (m === 'single' ? Promise.resolve(result) : builder))
  }
  builder.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej)
  return builder
}

// Service client whose from(table) hands out queued builders in call order;
// tables without a queue get inert empty builders. rpc results dequeue too.
function createServiceMock(queues: Record<string, any[]>, rpcResults: any[] = []) {
  const from = vi.fn((table: string) => {
    const q = queues[table]
    return q?.length ? q.shift() : createBuilder({ data: null, error: null })
  })
  const rpc = vi.fn(async () => rpcResults.shift() ?? { data: 'txn-1', error: null })
  return { from, rpc }
}

const approvedRequest = {
  id: REQUEST_ID,
  status: 'approved',
  user_id: 'seller-1',
  amount: 50,
  method_id: 'method-1',
  method_name: 'usdt',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.requireAdmin.mockResolvedValue({ userId: ADMIN_ID })
  h.requireRole.mockResolvedValue({ userId: ADMIN_ID, role: 'admin' })
  h.sendWithdrawalProcessedEmail.mockResolvedValue({ success: true })
})

describe('markWithdrawalPaid', () => {
  it('posts the payout journal, then flips the request to completed', async () => {
    const loadBuilder = createBuilder({ data: approvedRequest, error: null })
    const updateBuilder = createBuilder({ data: [approvedRequest], error: null })
    const service = createServiceMock({
      withdrawal_requests: [loadBuilder, updateBuilder],
      profiles: [createBuilder({ data: { email: 's@x.com', username: 'sel', full_name: null }, error: null })],
      withdrawal_methods: [createBuilder({ data: { display_name: 'USDT (TRC-20)' }, error: null })],
      notifications: [createBuilder({ data: null, error: null })],
    })
    h.createServiceRoleClient.mockReturnValue(service)

    const result = await markWithdrawalPaid({
      requestId: REQUEST_ID,
      transactionHash: ' 0xabc123 ',
      adminNotes: 'sent via hot wallet',
    })

    expect(result).toEqual({ success: true })

    // The balancing journal: exactly one RPC call, keyed by the request.
    expect(service.rpc).toHaveBeenCalledTimes(1)
    expect(service.rpc).toHaveBeenCalledWith('withdrawal_payout', {
      p_request_id: REQUEST_ID,
    })

    // Journal BEFORE status flip: a failed journal must leave the request
    // approved (retryable), never completed with funds stuck in clearing.
    expect(service.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      updateBuilder.update.mock.invocationCallOrder[0]
    )

    // Terminal state with audit fields; tx hash trimmed.
    const patch = updateBuilder.update.mock.calls[0][0]
    expect(patch.status).toBe('completed')
    expect(patch.processed_by).toBe(ADMIN_ID)
    expect(patch.transaction_hash).toBe('0xabc123')
    expect(patch.admin_notes).toBe('sent via hot wallet')
    expect(patch.completed_at).toBeTruthy()
    // Only an approved/processing request may be flipped (replay/race guard).
    expect(updateBuilder.in).toHaveBeenCalledWith('status', ['approved', 'processing'])

    // Seller comms: paid email + in-app notification.
    expect(h.sendWithdrawalProcessedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 's@x.com', status: 'completed', amount: 50 })
    )
  })

  it('is a no-op success on replay when the request is already completed', async () => {
    const loadBuilder = createBuilder({
      data: { ...approvedRequest, status: 'completed' },
      error: null,
    })
    const service = createServiceMock({ withdrawal_requests: [loadBuilder] })
    h.createServiceRoleClient.mockReturnValue(service)

    const result = await markWithdrawalPaid({ requestId: REQUEST_ID })

    expect(result).toEqual({ success: true })
    expect(service.rpc).not.toHaveBeenCalled()
    expect(service.from).toHaveBeenCalledTimes(1) // load only — no update, no comms
  })

  it.each(['pending', 'rejected', 'cancelled', 'failed'])(
    'refuses a %s request without touching the ledger',
    async (status) => {
      const loadBuilder = createBuilder({ data: { ...approvedRequest, status }, error: null })
      const service = createServiceMock({ withdrawal_requests: [loadBuilder] })
      h.createServiceRoleClient.mockReturnValue(service)

      const result = await markWithdrawalPaid({ requestId: REQUEST_ID })

      expect(result.success).toBe(false)
      expect(result.error).toContain(status)
      expect(service.rpc).not.toHaveBeenCalled()
    }
  )

  it('fails when the request does not exist', async () => {
    const loadBuilder = createBuilder({ data: null, error: { message: 'not found' } })
    const service = createServiceMock({ withdrawal_requests: [loadBuilder] })
    h.createServiceRoleClient.mockReturnValue(service)

    const result = await markWithdrawalPaid({ requestId: 'nope' })

    expect(result.success).toBe(false)
    expect(service.rpc).not.toHaveBeenCalled()
  })

  it('leaves the request approved when the payout journal fails', async () => {
    const loadBuilder = createBuilder({ data: approvedRequest, error: null })
    const updateBuilder = createBuilder({ data: [approvedRequest], error: null })
    const service = createServiceMock(
      { withdrawal_requests: [loadBuilder, updateBuilder] },
      [{ data: null, error: { message: 'hold for request was reversed' } }]
    )
    h.createServiceRoleClient.mockReturnValue(service)

    const result = await markWithdrawalPaid({ requestId: REQUEST_ID })

    expect(result.success).toBe(false)
    expect(updateBuilder.update).not.toHaveBeenCalled()
    expect(h.sendWithdrawalProcessedEmail).not.toHaveBeenCalled()
  })

  it('still succeeds when comms fail — money moved, status flipped', async () => {
    const loadBuilder = createBuilder({ data: approvedRequest, error: null })
    const updateBuilder = createBuilder({ data: [approvedRequest], error: null })
    const service = createServiceMock({
      withdrawal_requests: [loadBuilder, updateBuilder],
      notifications: [createBuilder({ data: null, error: { message: 'insert blew up' } })],
    })
    h.createServiceRoleClient.mockReturnValue(service)

    const result = await markWithdrawalPaid({ requestId: REQUEST_ID })

    expect(result).toEqual({ success: true })
    expect(updateBuilder.update).toHaveBeenCalled()
  })

  it('does nothing when the caller lacks the admin/super_admin role', async () => {
    h.requireRole.mockRejectedValue(new Error('Role not allowed: support'))
    const service = createServiceMock({})
    h.createServiceRoleClient.mockReturnValue(service)

    const result = await markWithdrawalPaid({ requestId: REQUEST_ID })

    expect(result.success).toBe(false)
    expect(h.requireRole).toHaveBeenCalledWith(['admin', 'super_admin'])
    expect(service.from).not.toHaveBeenCalled()
    expect(service.rpc).not.toHaveBeenCalled()
  })
})
