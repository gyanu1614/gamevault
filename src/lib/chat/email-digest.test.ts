import { describe, it, expect, vi } from 'vitest'
import { runChatEmailDigest, type ClaimedDigest, type DigestDeps, type DigestResult } from './email-digest'

function claimed(over: Partial<ClaimedDigest> = {}): ClaimedDigest {
  return {
    conversation_id: 'c1',
    recipient_id: 'u1',
    claimed_at: '2026-11-02T22:00:00Z',
    recipient_email: 'buyer@example.com',
    recipient_name: 'Sam',
    sender_name: 'TopSeller',
    order_id: 'o1',
    order_number: 'DM-1001',
    unread_count: 3,
    messages: [{ content: 'Hey' }, { content: 'how are you' }, { content: "what's your user?" }],
    ...over,
  }
}

function deps(batches: ClaimedDigest[][], over: Partial<DigestDeps> = {}) {
  const queue = [...batches]
  const completed: DigestResult[][] = []
  const sent: { to: string; subject: string }[][] = []
  const d: DigestDeps = {
    claim: vi.fn(async () => queue.shift() ?? []),
    complete: vi.fn(async (r) => void completed.push(r)),
    allowed: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, true]))),
    sendBatch: vi.fn(async (emails: { to: string; subject: string; html: string }[]) => {
      sent.push(emails.map(({ to, subject }) => ({ to, subject })))
      return emails.map(() => true)
    }),
    appUrl: 'https://dropmarket.test',
    ...over,
  }
  return { d, completed, sent }
}

describe('runChatEmailDigest', () => {
  it('sends ONE email for a batch of three messages, in one provider request', async () => {
    const { d, completed, sent } = deps([[claimed()]])
    const summary = await runChatEmailDigest(d)
    expect(summary).toEqual({ claimed: 1, sent: 1, skipped: 0, failed: 0 })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toEqual([{ to: 'buyer@example.com', subject: 'TopSeller sent you 3 messages about order #DM-1001' }])
    expect(completed[0]).toEqual([{ conversation_id: 'c1', recipient_id: 'u1', claimed_at: '2026-11-02T22:00:00Z', outcome: 'sent' }])
  })

  it('skips a batch already read, an opted-out recipient and a missing address — without calling the provider', async () => {
    const { d, completed, sent } = deps(
      [[
        claimed({ conversation_id: 'read', unread_count: 0, messages: [] }),
        claimed({ conversation_id: 'optout', recipient_id: 'u2' }),
        claimed({ conversation_id: 'noaddr', recipient_email: null }),
      ]],
      { allowed: async () => new Map([['u1', true], ['u2', false]]) },
    )
    const summary = await runChatEmailDigest(d)
    expect(summary).toEqual({ claimed: 3, sent: 0, skipped: 3, failed: 0 })
    expect(sent).toHaveLength(0)
    expect(completed[0].map((r) => r.outcome)).toEqual(['skipped', 'skipped', 'skipped'])
  })

  it('marks only the emails the provider refused as failed', async () => {
    const { d, completed } = deps([[claimed({ conversation_id: 'a' }), claimed({ conversation_id: 'b' })]], {
      sendBatch: async (emails) => emails.map((_, i) => i === 0),
    })
    await runChatEmailDigest(d)
    expect(completed[0].map((r) => [r.conversation_id, r.outcome])).toEqual([['a', 'sent'], ['b', 'failed']])
  })

  it('drains a backlog in rounds and stops at a short page', async () => {
    const full = Array.from({ length: 2 }, (_, i) => claimed({ conversation_id: `p1-${i}` }))
    const short = [claimed({ conversation_id: 'p2-0' })]
    const { d, completed } = deps([full, short, [claimed({ conversation_id: 'never' })]])
    const summary = await runChatEmailDigest(d, { limit: 2, maxRounds: 5 })
    expect(summary.claimed).toBe(3)
    expect(completed).toHaveLength(2)
    expect(d.claim).toHaveBeenCalledTimes(2)
  })

  it('never claims more rounds than allowed', async () => {
    const page = () => [claimed({ conversation_id: Math.random().toString() })]
    const { d } = deps([page(), page(), page(), page()])
    await runChatEmailDigest(d, { limit: 1, maxRounds: 2 })
    expect(d.claim).toHaveBeenCalledTimes(2)
  })

  it('does nothing when nothing is due', async () => {
    const { d } = deps([])
    expect(await runChatEmailDigest(d)).toEqual({ claimed: 0, sent: 0, skipped: 0, failed: 0 })
    expect(d.complete).not.toHaveBeenCalled()
    expect(d.sendBatch).not.toHaveBeenCalled()
  })
})
