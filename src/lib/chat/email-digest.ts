/**
 * One run of the chat email sender: claim the due batches, email each
 * recipient once, report back.
 *
 * The batching itself lives in the database (migration
 * 20261102161137_chat_email_digest): every message stamps a queue row, and a
 * batch is due once the chat has been quiet for 2 minutes. pg_cron calls
 * /api/cron/chat-email-digest only when something is due; that route runs
 * this with the real dependencies.
 *
 * Per run: one claim RPC, one email-preferences read, one Resend batch
 * request (up to 100 emails), one complete RPC. A batch the recipient has
 * already read, opted out of (Settings → Notifications → New Messages) or has
 * no address for is "skipped"; a send Resend refuses is "failed" and retried
 * by the database a few times.
 *
 * Dependencies are injected so the run is unit-tested: email-digest.test.ts.
 */

import { buildChatDigestEmail, type ChatDigestLine } from '@/lib/email/chat-digest'

export interface ClaimedDigest {
  conversation_id: string
  recipient_id: string
  claimed_at: string
  recipient_email: string | null
  recipient_name: string
  sender_name: string
  order_id: string | null
  order_number: string | null
  unread_count: number
  messages: ChatDigestLine[] | null
}

export type DigestOutcome = 'sent' | 'skipped' | 'failed'

export interface DigestResult {
  conversation_id: string
  recipient_id: string
  claimed_at: string
  outcome: DigestOutcome
}

export interface DigestDeps {
  claim(limit: number): Promise<ClaimedDigest[]>
  complete(results: DigestResult[]): Promise<void>
  /** user id → may we send the optional `new_message` email. */
  allowed(userIds: string[]): Promise<Map<string, boolean>>
  /** One boolean per email, in order: true = accepted by the provider. */
  sendBatch(emails: { to: string; subject: string; html: string }[]): Promise<boolean[]>
  appUrl?: string
}

export interface DigestRunSummary {
  claimed: number
  sent: number
  skipped: number
  failed: number
}

export const DIGEST_CLAIM_LIMIT = 50
/** Rounds per invocation: a backlog drains without one run holding the lease forever. */
export const DIGEST_MAX_ROUNDS = 4

export async function runChatEmailDigest(
  deps: DigestDeps,
  { limit = DIGEST_CLAIM_LIMIT, maxRounds = DIGEST_MAX_ROUNDS }: { limit?: number; maxRounds?: number } = {},
): Promise<DigestRunSummary> {
  const summary: DigestRunSummary = { claimed: 0, sent: 0, skipped: 0, failed: 0 }

  for (let round = 0; round < maxRounds; round++) {
    const claimed = await deps.claim(limit)
    if (claimed.length === 0) break
    summary.claimed += claimed.length

    const allowed = await deps.allowed(claimed.map((c) => c.recipient_id))
    const results: DigestResult[] = claimed.map((c) => ({
      conversation_id: c.conversation_id,
      recipient_id: c.recipient_id,
      claimed_at: c.claimed_at,
      outcome: 'skipped' as DigestOutcome,
    }))

    const emails: { to: string; subject: string; html: string }[] = []
    const emailFor: number[] = []
    claimed.forEach((c, i) => {
      const lines = c.messages ?? []
      if (!c.recipient_email || c.unread_count <= 0 || lines.length === 0) return
      if (allowed.get(c.recipient_id) === false) return
      const { subject, html } = buildChatDigestEmail({
        name: c.recipient_name,
        senderName: c.sender_name,
        orderNumber: c.order_number,
        orderId: c.order_id,
        lines,
        unreadCount: c.unread_count,
        appUrl: deps.appUrl,
      })
      emails.push({ to: c.recipient_email, subject, html })
      emailFor.push(i)
    })

    if (emails.length > 0) {
      const accepted = await deps.sendBatch(emails)
      emailFor.forEach((i, j) => {
        results[i].outcome = accepted[j] ? 'sent' : 'failed'
      })
    }

    for (const r of results) summary[r.outcome]++
    await deps.complete(results)

    if (claimed.length < limit) break
  }

  return summary
}
