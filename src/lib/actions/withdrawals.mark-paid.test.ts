import { describe, it, expect, vi, beforeEach } from 'vitest'

// markWithdrawalPaid settles a withdrawal through ONE service-role RPC
// (withdrawal_mark_paid, fee PR 7): payout journal (payout_clearing →
// external_payout + platform fee) and the completed flip with the payment
// reference happen in one transaction; the seller's in-app notification is
// written there (deduped). These tests pin the seam: the role gate runs
// before any service-role work, the reference is required, RPC outcomes map
// to results, and the email rides on top without ever failing the payout.

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
vi.mock('@/lib/email', () => ({
  sendWithdrawalProcessedEmail: h.sendWithdrawalProcessedEmail,
}))

import { markWithdrawalPaid } from '@/lib/actions/withdrawals'

const REQUEST_ID = 'req-1'
const ADMIN_ID = 'admin-1'

function createBuilder(result: any) {
  const builder: any = {}
  for (const m of ['select', 'eq', 'in', 'update', 'insert', 'single']) {
    builder[m] = vi.fn(() => (m === 'single' ? Promise.resolve(result) : builder))
  }
  builder.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej)
  return builder
}

function createServiceMock(rpcResult: any, profile: any = { email: 's@x.com', username: 'sel', full_name: null }) {
  const from = vi.fn((table: string) =>
    table === 'profiles' ? createBuilder({ data: profile, error: null }) : createBuilder({ data: null, error: null }),
  )
  const rpc = vi.fn(async () => rpcResult)
  return { from, rpc }
}

const paid = {
  changed: true, status: 'completed', payout_txn_id: 'txn-1', user_id: 'seller-1',
  amount: 50, net_amount: 43.5, method_name: 'usdt_trc20', display_name: 'USDT (TRC-20)', reference: '0xabc123',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.requireAdmin.mockResolvedValue({ userId: ADMIN_ID })
  h.requireRole.mockResolvedValue({ userId: ADMIN_ID, role: 'admin' })
  h.sendWithdrawalProcessedEmail.mockResolvedValue({ success: true })
})

describe('markWithdrawalPaid', () => {
  it('calls withdrawal_mark_paid once with the trimmed reference, then emails the seller', async () => {
    const service = createServiceMock({ data: paid, error: null })
    h.createServiceRoleClient.mockReturnValue(service)

    const result = await markWithdrawalPaid({
      requestId: REQUEST_ID,
      transactionHash: ' 0xabc123 ',
      adminNotes: 'sent via hot wallet',
    })

    expect(result).toEqual({ success: true })
    expect(service.rpc).toHaveBeenCalledTimes(1)
    expect(service.rpc).toHaveBeenCalledWith('withdrawal_mark_paid', {
      p_request_id: REQUEST_ID,
      p_admin_id: ADMIN_ID,
      p_reference: '0xabc123',
      p_notes: 'sent via hot wallet',
    })
    // No TS status write, no TS notification insert — the RPC owns both.
    expect(service.from).not.toHaveBeenCalledWith('withdrawal_requests')
    expect(service.from).not.toHaveBeenCalledWith('notifications')
    expect(h.sendWithdrawalProcessedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 's@x.com', status: 'completed', amount: 50, net: 43.5, txReference: '0xabc123' }),
    )
  })

  it('accepts a Payoneer reference through `reference`', async () => {
    const service = createServiceMock({ data: { ...paid, method_name: 'payoneer', display_name: 'Payoneer', reference: 'PYN-42' }, error: null })
    h.createServiceRoleClient.mockReturnValue(service)
    const result = await markWithdrawalPaid({ requestId: REQUEST_ID, reference: 'PYN-42' })
    expect(result).toEqual({ success: true })
    expect(service.rpc).toHaveBeenCalledWith('withdrawal_mark_paid', expect.objectContaining({ p_reference: 'PYN-42' }))
  })

  it('refuses without a reference before touching the ledger', async () => {
    const service = createServiceMock({ data: paid, error: null })
    h.createServiceRoleClient.mockReturnValue(service)
    const result = await markWithdrawalPaid({ requestId: REQUEST_ID, transactionHash: '   ' })
    expect(result.success).toBe(false)
    expect(service.rpc).not.toHaveBeenCalled()
  })

  it('is a no-op success on replay when the request is already completed', async () => {
    const service = createServiceMock({ data: { changed: false, status: 'completed' }, error: null })
    h.createServiceRoleClient.mockReturnValue(service)
    const result = await markWithdrawalPaid({ requestId: REQUEST_ID, reference: 'x' })
    expect(result).toEqual({ success: true })
    expect(h.sendWithdrawalProcessedEmail).not.toHaveBeenCalled()
  })

  it.each(['pending', 'rejected', 'cancelled', 'failed'])('refuses a %s request (RPC says not_approved)', async (status) => {
    const service = createServiceMock({ data: { changed: false, reason: 'not_approved', status }, error: null })
    h.createServiceRoleClient.mockReturnValue(service)
    const result = await markWithdrawalPaid({ requestId: REQUEST_ID, reference: 'x' })
    expect(result.success).toBe(false)
    expect(result.error).toContain(status)
    expect(h.sendWithdrawalProcessedEmail).not.toHaveBeenCalled()
  })

  it('fails when the request does not exist', async () => {
    const service = createServiceMock({ data: { changed: false, reason: 'not_found' }, error: null })
    h.createServiceRoleClient.mockReturnValue(service)
    const result = await markWithdrawalPaid({ requestId: 'nope', reference: 'x' })
    expect(result).toEqual({ success: false, error: 'Withdrawal request not found' })
  })

  it('surfaces a refused payout (hold reversed) as an error — nothing flipped, no email', async () => {
    const service = createServiceMock({ data: null, error: { message: 'hold for request was reversed — refusing to pay out' } })
    h.createServiceRoleClient.mockReturnValue(service)
    const result = await markWithdrawalPaid({ requestId: REQUEST_ID, reference: 'x' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('reversed')
    expect(h.sendWithdrawalProcessedEmail).not.toHaveBeenCalled()
  })

  it('still succeeds when the email fails — money moved, status flipped in the RPC', async () => {
    const service = createServiceMock({ data: paid, error: null })
    h.createServiceRoleClient.mockReturnValue(service)
    h.sendWithdrawalProcessedEmail.mockRejectedValue(new Error('resend down'))
    const result = await markWithdrawalPaid({ requestId: REQUEST_ID, reference: 'x' })
    expect(result).toEqual({ success: true })
  })

  it('does nothing when the caller lacks the admin/super_admin role', async () => {
    h.requireRole.mockRejectedValue(new Error('Role not allowed: support'))
    const service = createServiceMock({ data: paid, error: null })
    h.createServiceRoleClient.mockReturnValue(service)
    const result = await markWithdrawalPaid({ requestId: REQUEST_ID, reference: 'x' })
    expect(result.success).toBe(false)
    expect(h.requireRole).toHaveBeenCalledWith(['admin', 'super_admin'])
    expect(service.from).not.toHaveBeenCalled()
    expect(service.rpc).not.toHaveBeenCalled()
  })
})
