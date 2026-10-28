/**
 * "Has the provider already taken the money?" — asked before a pending order
 * is superseded or shown as unpaid. Best-effort: any failure answers false.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const payssionState = vi.fn()
const stripeGetCharge = vi.fn()
vi.mock('@/lib/payments/providers/payssion', () => ({ payssionTransactionState: payssionState }))
vi.mock('@/lib/payments/providers/stripe', () => ({ stripeProvider: { getCharge: stripeGetCharge } }))

import { paidAtProvider } from './provider-paid-probe'

beforeEach(() => {
  payssionState.mockReset()
  stripeGetCharge.mockReset()
})

describe('paidAtProvider', () => {
  it('Payssion: completed is paid', async () => {
    payssionState.mockResolvedValue('completed')
    expect(await paidAtProvider({ provider: 'payssion', provider_charge_id: 'T1' }, 'o1')).toBe(true)
  })

  it('Stripe: a completed or processing session is paid', async () => {
    stripeGetCharge.mockResolvedValue({ rawStatus: 'completed' })
    expect(await paidAtProvider({ provider: 'stripe', provider_charge_id: 'cs_1' }, 'o1')).toBe(true)
    stripeGetCharge.mockResolvedValue({ rawStatus: 'processing' })
    expect(await paidAtProvider({ provider: 'stripe', provider_charge_id: 'cs_1' }, 'o1')).toBe(true)
  })

  it('Stripe: an open or expired session is not paid', async () => {
    stripeGetCharge.mockResolvedValue({ rawStatus: 'pending' })
    expect(await paidAtProvider({ provider: 'stripe', provider_charge_id: 'cs_1' }, 'o1')).toBe(false)
    stripeGetCharge.mockResolvedValue({ rawStatus: 'expired' })
    expect(await paidAtProvider({ provider: 'stripe', provider_charge_id: 'cs_1' }, 'o1')).toBe(false)
  })

  it('a failed lookup answers false (the webhook stays the authority)', async () => {
    stripeGetCharge.mockRejectedValue(new Error('network'))
    expect(await paidAtProvider({ provider: 'stripe', provider_charge_id: 'cs_1' }, 'o1')).toBe(false)
  })

  it('crypto attempts and attempts without a charge are never probed', async () => {
    expect(await paidAtProvider({ provider: 'btcpay', provider_charge_id: 'inv' }, 'o1')).toBe(false)
    expect(await paidAtProvider({ provider: 'stripe', provider_charge_id: null }, 'o1')).toBe(false)
    expect(await paidAtProvider(null, 'o1')).toBe(false)
    expect(stripeGetCharge).not.toHaveBeenCalled()
  })
})
