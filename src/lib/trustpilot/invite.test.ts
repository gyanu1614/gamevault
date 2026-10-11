import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/email', () => ({ sendOrderCompletionEmail: vi.fn(async () => ({ success: true })) }))

import {
  decideInvite,
  trustpilotSnippet,
  runCompletionInvite,
  type InviteFacts,
  type InviteDeps,
  type InviteOutcome,
} from './invite'

const base: InviteFacts = {
  orderId: 'o1',
  orderNumber: 'DM-ABC123',
  orderStatus: 'completed',
  releaseMethod: 'buyer_confirmed',
  disputed: false,
  buyerId: 'b1',
  buyerEmail: 'buyer@example.com',
  buyerName: 'Sam',
  buyerIsTest: false,
  sellerIsTest: false,
  reviewInvitesOn: true,
  inviteStatus: 'scheduled',
  attempts: 0,
  firstFailedAt: null,
  totalPaid: 12.5,
  listingTitle: 'Shadow Dragon',
}

describe('decideInvite', () => {
  it('invites a buyer-confirmed order and an auto-released order alike', () => {
    expect(decideInvite(base)).toEqual({ invite: true })
    expect(decideInvite({ ...base, releaseMethod: 'auto' })).toEqual({ invite: true })
  })

  it.each([
    [{ orderStatus: 'refunded' }, 'not_completed'],
    [{ orderStatus: 'cancelled' }, 'not_completed'],
    [{ releaseMethod: 'dispute_resolved' }, 'dispute'],
    [{ releaseMethod: 'admin' }, 'dispute'],
    [{ disputed: true }, 'dispute'],
    [{ sellerIsTest: true }, 'test_account'],
    [{ buyerIsTest: true }, 'test_account'],
    [{ buyerEmail: null }, 'no_email'],
    [{ reviewInvitesOn: false }, 'opted_out'],
  ] as const)('skips %o as %s', (patch, reason) => {
    expect(decideInvite({ ...base, ...patch })).toEqual({ invite: false, reason })
  })

  it('never reads anything about how the buyer felt — the facts carry no rating at all', () => {
    expect(Object.keys(base).some((k) => /rating|star|happy|sentiment/i.test(k))).toBe(false)
  })
})

describe('trustpilotSnippet', () => {
  it('is the Automatic Feedback structured snippet with the order number as referenceId', () => {
    const html = trustpilotSnippet({ recipientEmail: 'a@b.co', recipientName: 'Sam', referenceId: 'DM-1' })
    expect(html.startsWith('<script type="application/json+trustpilot">')).toBe(true)
    const json = JSON.parse(html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''))
    expect(json).toEqual({ recipientEmail: 'a@b.co', recipientName: 'Sam', referenceId: 'DM-1' })
  })

  it('cannot be broken out of by a hostile username', () => {
    const html = trustpilotSnippet({ recipientEmail: 'a@b.co', recipientName: '</script><img src=x>', referenceId: 'DM-1' })
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(html).not.toContain('<img')
  })
})

function harness(facts: Partial<InviteFacts> | null, opts: { bcc?: string | null; sendOk?: boolean } = {}) {
  const saved: InviteOutcome[] = []
  const sent: Array<{ to: string; bcc: string | null; snippet: string | null; autoReleased: boolean }> = []
  const deps: InviteDeps = {
    loadFacts: async () => (facts === null ? null : { ...base, ...facts }),
    saveOutcome: async (_id, outcome) => { saved.push(outcome) },
    sendReceipt: async (args) => {
      sent.push({ to: args.to, bcc: args.trustpilot?.bcc ?? null, snippet: args.trustpilot?.snippetHtml ?? null, autoReleased: args.autoReleased })
      return opts.sendOk === false ? { success: false, error: 'provider down' } : { success: true }
    },
    bccAddress: () => (opts.bcc === undefined ? 'dropmarket.gg+abc@invite.trustpilot.com' : opts.bcc),
    now: () => new Date('2026-10-11T09:00:00Z'),
  }
  return { deps, saved, sent }
}

describe('runCompletionInvite — completion path', () => {
  beforeEach(() => vi.clearAllMocks())

  it('qualifying order: one receipt, BCC + snippet attached, recorded as sent', async () => {
    const h = harness({})
    const r = await runCompletionInvite('o1', 'completion', h.deps)
    expect(r.status).toBe('sent')
    expect(h.sent).toHaveLength(1)
    expect(h.sent[0].bcc).toBe('dropmarket.gg+abc@invite.trustpilot.com')
    expect(h.sent[0].snippet).toContain('"referenceId":"DM-ABC123"')
    expect(h.saved).toEqual([expect.objectContaining({ status: 'sent', attempts: 1, sentAt: '2026-10-11T09:00:00.000Z', lastError: null })])
  })

  it('auto-released order gets the auto-release receipt copy', async () => {
    const h = harness({ releaseMethod: 'auto' })
    await runCompletionInvite('o1', 'completion', h.deps)
    expect(h.sent[0].autoReleased).toBe(true)
  })

  it('non-qualifying order: the receipt still goes out, with NO BCC, recorded as skipped', async () => {
    const h = harness({ sellerIsTest: true })
    const r = await runCompletionInvite('o1', 'completion', h.deps)
    expect(r.status).toBe('skipped')
    expect(h.sent).toEqual([expect.objectContaining({ bcc: null, snippet: null })])
    expect(h.saved).toEqual([expect.objectContaining({ status: 'skipped', skipReason: 'test_account' })])
  })

  it('opt-out unreadable: receipt without BCC, invite failed (retried), never assumed on', async () => {
    const h = harness({ reviewInvitesOn: null })
    const r = await runCompletionInvite('o1', 'completion', h.deps)
    expect(r.status).toBe('failed')
    expect(h.sent).toEqual([expect.objectContaining({ bcc: null })])
    expect(h.saved[0].lastError).toMatch(/email preferences/)
  })

  it('opted-out buyer: receipt without BCC', async () => {
    const h = harness({ reviewInvitesOn: false })
    await runCompletionInvite('o1', 'completion', h.deps)
    expect(h.sent[0].bcc).toBeNull()
    expect(h.saved[0]).toMatchObject({ status: 'skipped', skipReason: 'opted_out' })
  })

  it('provider refuses: recorded as failed with the error, due for the next cron run', async () => {
    const h = harness({}, { sendOk: false })
    const r = await runCompletionInvite('o1', 'completion', h.deps)
    expect(r.status).toBe('failed')
    expect(h.saved[0]).toMatchObject({
      status: 'failed', attempts: 1, lastError: 'provider down',
      firstFailedAt: '2026-10-11T09:00:00.000Z', scheduledFor: '2026-10-11T09:00:00.000Z',
    })
  })

  it('BCC address not configured: receipt goes out, invite recorded as failed so the ops alert fires', async () => {
    const h = harness({}, { bcc: null })
    const r = await runCompletionInvite('o1', 'completion', h.deps)
    expect(r.status).toBe('failed')
    expect(h.sent).toEqual([expect.objectContaining({ bcc: null })])
    expect(h.saved[0].lastError).toMatch(/TRUSTPILOT_BCC_EMAIL/)
  })

  it('an invite already sent is never sent twice: receipt only, row untouched', async () => {
    const h = harness({ inviteStatus: 'sent', attempts: 1 })
    const r = await runCompletionInvite('o1', 'completion', h.deps)
    expect(r.status).toBe('sent')
    expect(h.sent[0].bcc).toBeNull()
    expect(h.saved).toEqual([])
  })
})

describe('runCompletionInvite — cron retry path', () => {
  it('a failed invite is re-sent (receipt + BCC); a later failure keeps first_failed_at', async () => {
    const h = harness({ inviteStatus: 'failed', attempts: 1, firstFailedAt: '2026-10-10T09:00:00.000Z' }, { sendOk: false })
    await runCompletionInvite('o1', 'retry', h.deps)
    expect(h.sent[0].bcc).not.toBeNull()
    expect(h.saved[0]).toMatchObject({ status: 'failed', attempts: 2, firstFailedAt: '2026-10-10T09:00:00.000Z' })
  })

  it('BCC address not configured on a retry: no second receipt is mailed', async () => {
    const h = harness({ inviteStatus: 'failed', attempts: 1, firstFailedAt: '2026-10-10T09:00:00.000Z' }, { bcc: null })
    const r = await runCompletionInvite('o1', 'retry', h.deps)
    expect(r.status).toBe('failed')
    expect(h.sent).toEqual([])
  })

  it('a non-qualifying order found by the cron (e.g. dispute-resolved) is skipped and nothing is emailed', async () => {
    const h = harness({ releaseMethod: 'dispute_resolved' })
    const r = await runCompletionInvite('o1', 'retry', h.deps)
    expect(r.status).toBe('skipped')
    expect(h.sent).toEqual([])
  })

  it('a missing order is reported, not thrown', async () => {
    const h = harness(null)
    await expect(runCompletionInvite('o1', 'retry', h.deps)).resolves.toMatchObject({ status: 'missing' })
  })
})
