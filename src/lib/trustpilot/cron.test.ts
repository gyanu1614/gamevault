import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/email', () => ({ sendOrderCompletionEmail: vi.fn(async () => ({ success: true })) }))

import { runInviteCron, type CronDeps, type DueInvite } from './cron'
import type { InviteResult } from './invite'

const NOW = new Date('2026-10-11T09:00:00Z')

function harness(due: DueInvite[], results: Record<string, InviteResult>) {
  const alerts: string[] = []
  const ran: string[] = []
  const deps: CronDeps = {
    now: () => NOW,
    listDue: async () => due,
    run: async (orderId) => { ran.push(orderId); return results[orderId] },
    alert: async (msg) => { alerts.push(msg); return true },
  }
  return { deps, alerts, ran }
}

describe('runInviteCron', () => {
  it('re-runs every due invite and reports the counts', async () => {
    const h = harness(
      [
        { orderId: 'a', firstFailedAt: null },
        { orderId: 'b', firstFailedAt: null },
        { orderId: 'c', firstFailedAt: '2026-10-11T08:00:00Z' },
      ],
      { a: { status: 'sent' }, b: { status: 'skipped', skipReason: 'dispute' }, c: { status: 'failed', error: 'x' } },
    )
    const summary = await runInviteCron(h.deps)
    expect(h.ran).toEqual(['a', 'b', 'c'])
    expect(summary).toMatchObject({ processed: 3, sent: 1, skipped: 1, failed: 1, failingTwoDays: 0, alerted: false })
  })

  it('first failure today: no alert yet', async () => {
    const h = harness([{ orderId: 'c', firstFailedAt: '2026-10-11T07:00:00Z' }], { c: { status: 'failed', error: 'down' } })
    await runInviteCron(h.deps)
    expect(h.alerts).toEqual([])
  })

  it('failed yesterday and again today: one Discord ops alert naming the error', async () => {
    const h = harness(
      [
        { orderId: 'c', firstFailedAt: '2026-10-10T09:00:00Z' },
        { orderId: 'd', firstFailedAt: '2026-10-09T20:00:00Z' },
      ],
      { c: { status: 'failed', error: 'TRUSTPILOT_BCC_EMAIL is not set' }, d: { status: 'failed', error: 'provider down' } },
    )
    const summary = await runInviteCron(h.deps)
    expect(summary).toMatchObject({ failingTwoDays: 2, alerted: true })
    expect(h.alerts).toHaveLength(1)
    expect(h.alerts[0]).toMatch(/2 Trustpilot invites/)
    expect(h.alerts[0]).toMatch(/TRUSTPILOT_BCC_EMAIL is not set/)
    expect(h.alerts[0]).toMatch(/\/admin/)
  })

  it('a retry that succeeds after yesterday’s failure does not alert', async () => {
    const h = harness([{ orderId: 'c', firstFailedAt: '2026-10-10T09:00:00Z' }], { c: { status: 'sent' } })
    await runInviteCron(h.deps)
    expect(h.alerts).toEqual([])
  })

  it('a run that throws on one invite still finishes the rest', async () => {
    const h = harness([{ orderId: 'x', firstFailedAt: null }, { orderId: 'a', firstFailedAt: null }], { a: { status: 'sent' } })
    h.deps.run = async (id) => { if (id === 'x') throw new Error('boom'); return { status: 'sent' } }
    const summary = await runInviteCron(h.deps)
    expect(summary).toMatchObject({ processed: 2, sent: 1, failed: 1 })
  })
})
