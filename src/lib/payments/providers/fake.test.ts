import { describe, it, expect } from 'vitest'
import { fakeProvider } from '@/lib/payments/providers/fake'
import { registeredProviders, getProvider } from '@/lib/payments/registry'

const sig = { 'x-fake-signature': 'fake-secret' }
const body = (o: Record<string, unknown>) => JSON.stringify(o)

describe('fake provider: registry', () => {
  it('is registered and resolvable', () => {
    expect(registeredProviders()).toContain('fake')
    expect(getProvider('fake').name).toBe('fake')
  })
  it('unknown provider throws', () => {
    expect(() => getProvider('nope')).toThrow()
  })
})

describe('fake provider: createCharge', () => {
  it('returns a charge id + checkout url', async () => {
    const r = await fakeProvider.createCharge({
      orderId: 'o1',
      amount: { amountMinor: 10000n, currency: 'EUR' },
      returnUrl: 'https://x.test/return',
    })
    expect(r.providerChargeId).toBe('fake_o1')
    expect(r.checkoutUrl).toContain('fake_o1')
    expect(r.rawStatus).toBe('pending')
  })
})

describe('fake provider: parseWebhook verification + mapping', () => {
  it('rejects a bad signature', async () => {
    await expect(
      fakeProvider.parseWebhook({ 'x-fake-signature': 'wrong' }, body({ chargeId: 'c1', orderId: 'o1', status: 'paid' }))
    ).rejects.toThrow(/signature/)
  })

  it('maps paid -> CHARGE_CONFIRMED with settled Money', async () => {
    const { providerEventId, events } = await fakeProvider.parseWebhook(
      sig,
      body({ chargeId: 'c1', orderId: 'o1', status: 'paid', amountMinor: '10000', currency: 'EUR' })
    )
    expect(providerEventId).toBe('c1:paid')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'CHARGE_CONFIRMED', orderId: 'o1', providerChargeId: 'c1' })
    expect((events[0] as any).settled).toEqual({ amountMinor: 10000n, currency: 'EUR' })
  })

  it('maps pending/failed/refunded correctly', async () => {
    const p = await fakeProvider.parseWebhook(sig, body({ chargeId: 'c1', orderId: 'o1', status: 'pending' }))
    expect(p.events[0].type).toBe('CHARGE_PENDING')

    const f = await fakeProvider.parseWebhook(sig, body({ chargeId: 'c1', orderId: 'o1', status: 'failed' }))
    expect(f.events[0].type).toBe('CHARGE_FAILED')

    const r = await fakeProvider.parseWebhook(
      sig,
      body({ chargeId: 'c1', orderId: 'o1', status: 'refunded', amountMinor: '10000', currency: 'EUR' })
    )
    expect(r.events[0].type).toBe('REFUND_COMPLETED')
  })

  it('providerEventId is status-scoped (distinct status = distinct dedupe key)', async () => {
    const a = await fakeProvider.parseWebhook(sig, body({ chargeId: 'c1', orderId: 'o1', status: 'pending' }))
    const b = await fakeProvider.parseWebhook(sig, body({ chargeId: 'c1', orderId: 'o1', status: 'paid' }))
    expect(a.providerEventId).not.toBe(b.providerEventId)
  })

  it('unknown status yields no events', async () => {
    const { events } = await fakeProvider.parseWebhook(sig, body({ chargeId: 'c1', orderId: 'o1', status: 'weird' }))
    expect(events).toHaveLength(0)
  })
})

describe('fake provider: voidCharge (test double for the cancel outbox)', () => {
  it('voids by default and records the call', async () => {
    const { fakeVoid } = await import('@/lib/payments/providers/fake')
    fakeVoid.reset()
    const r = await fakeProvider.voidCharge('fake_o1')
    expect(r.outcome).toBe('voided')
    expect(fakeVoid.calls).toEqual(['fake_o1'])
  })
  it('per-charge behaviour: paid / throw', async () => {
    const { fakeVoid } = await import('@/lib/payments/providers/fake')
    fakeVoid.reset()
    fakeVoid.outcomes.set('fake_paid', 'paid')
    fakeVoid.outcomes.set('fake_boom', 'throw')
    expect((await fakeProvider.voidCharge('fake_paid')).outcome).toBe('paid')
    await expect(fakeProvider.voidCharge('fake_boom')).rejects.toThrow(/fake: void failed/)
    fakeVoid.reset()
  })
})
