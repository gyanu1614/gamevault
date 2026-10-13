/**
 * Trustpilot review invites — the ONE place that decides and records them.
 *
 * How an invite reaches a buyer: the order-complete receipt is BCC'd to our
 * Trustpilot Automatic Feedback address with a structured snippet (buyer
 * email, name, order number), and Trustpilot sends its own invite after the
 * delay set in its dashboard. No API key is needed.
 *
 * Trustpilot bans selective inviting, so the decision never looks at how the
 * order went: every order completed by buyer confirmation or auto-release is
 * invited, unless it is a test order, the buyer has no email or opted out
 * (Settings → Notifications), or the order was disputed. The receipt itself
 * always goes out on completion; only the BCC is conditional.
 *
 * Every attempt is recorded on trustpilot_invitations (status sent / failed /
 * skipped) — the /admin card and the ops alert read those rows. The daily
 * cron re-runs this for rows the completion path missed or that failed.
 */
import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveEmailPref } from '@/lib/email/preferences'
import { orderItemTitleFor } from '@/lib/orders/item-title-server'

export type SkipReason = 'not_completed' | 'dispute' | 'test_account' | 'no_email' | 'opted_out'
export type InviteStatus = 'scheduled' | 'sent' | 'failed' | 'skipped'

/** At most this many sends per invite: the completion, then two daily retries. */
export const MAX_ATTEMPTS = 3

/** Release methods that mean the buyer got what they paid for without a dispute. */
const INVITED_RELEASES = new Set(['buyer_confirmed', 'auto'])

export interface InviteFacts {
  orderId: string
  orderNumber: string
  orderStatus: string
  releaseMethod: string | null
  /** orders.disputed_at is set — any dispute, before or after completion. */
  disputed: boolean
  buyerId: string
  buyerEmail: string | null
  buyerName: string
  buyerIsTest: boolean
  sellerIsTest: boolean
  /** Settings → Notifications switch; null = could not be read (never guessed). */
  reviewInvitesOn: boolean | null
  inviteStatus: InviteStatus | null
  attempts: number
  firstFailedAt: string | null
  totalPaid: number
  listingTitle: string
}

export type InviteDecision = { invite: true } | { invite: false; reason: SkipReason }

export function decideInvite(f: InviteFacts): InviteDecision {
  if (f.orderStatus !== 'completed') return { invite: false, reason: 'not_completed' }
  if (f.disputed || !INVITED_RELEASES.has(f.releaseMethod ?? '')) return { invite: false, reason: 'dispute' }
  if (f.buyerIsTest || f.sellerIsTest) return { invite: false, reason: 'test_account' }
  if (!f.buyerEmail) return { invite: false, reason: 'no_email' }
  if (f.reviewInvitesOn === false) return { invite: false, reason: 'opted_out' }
  return { invite: true }
}

/**
 * Trustpilot's Automatic Feedback structured-data snippet. `<` is escaped so a
 * username can never close the script element.
 */
export function trustpilotSnippet(r: { recipientEmail: string; recipientName: string; referenceId: string }): string {
  const json = JSON.stringify({ recipientEmail: r.recipientEmail, recipientName: r.recipientName, referenceId: r.referenceId })
  return `<script type="application/json+trustpilot">${json.replace(/</g, '\\u003c')}</script>`
}

export interface InviteOutcome {
  status: Exclude<InviteStatus, 'scheduled'>
  skipReason: SkipReason | null
  attempts: number
  sentAt: string | null
  firstFailedAt: string | null
  lastAttemptAt: string | null
  lastError: string | null
  scheduledFor: string | null
  email: string | null
}

export interface ReceiptArgs {
  to: string
  name: string
  orderId: string
  orderNumber: string
  listingTitle: string
  totalPaid: number
  autoReleased: boolean
  trustpilot: { bcc: string; snippetHtml: string } | null
}

export interface InviteDeps {
  loadFacts(orderId: string): Promise<InviteFacts | null>
  saveOutcome(orderId: string, outcome: InviteOutcome, facts: InviteFacts): Promise<void>
  sendReceipt(args: ReceiptArgs): Promise<{ success: boolean; error?: unknown }>
  bccAddress(): string | null
  now(): Date
}

export type InviteResult = { status: InviteStatus | 'missing'; skipReason?: SkipReason; error?: string }

/**
 * completion — called once when an order completes: sends the buyer's
 *   receipt (always), with the Trustpilot BCC when the order qualifies.
 * retry — called by the cron for a scheduled/failed row: sends the receipt
 *   with the BCC only when the order qualifies; otherwise records the skip
 *   and emails nothing (dispute and admin completions have their own comms).
 */
export async function runCompletionInvite(
  orderId: string,
  mode: 'completion' | 'retry',
  deps: InviteDeps = defaultDeps,
): Promise<InviteResult> {
  const facts = await deps.loadFacts(orderId)
  if (!facts) return { status: 'missing' }

  const nowIso = deps.now().toISOString()
  const alreadyDone = facts.inviteStatus === 'sent' || facts.inviteStatus === 'skipped'
  const decision = decideInvite(facts)
  const bcc = deps.bccAddress()
  const wantInvite = !alreadyDone && decision.invite
  const trustpilot =
    wantInvite && bcc && facts.buyerEmail
      ? {
          bcc,
          snippetHtml: trustpilotSnippet({
            recipientEmail: facts.buyerEmail,
            recipientName: facts.buyerName,
            referenceId: facts.orderNumber,
          }),
        }
      : null

  const receiptBase = () => ({
    to: facts.buyerEmail as string,
    name: facts.buyerName,
    orderId: facts.orderId,
    orderNumber: facts.orderNumber,
    listingTitle: facts.listingTitle,
    totalPaid: facts.totalPaid,
    autoReleased: facts.releaseMethod === 'auto',
  })
  const sendReceipt = () => deps.sendReceipt({ ...receiptBase(), trustpilot })

  // Never invite twice: the receipt may still go out, the row stays as is.
  if (alreadyDone) {
    if (mode === 'completion' && facts.buyerEmail) await sendReceipt()
    return { status: facts.inviteStatus as InviteStatus }
  }

  if (!decision.invite) {
    if (mode === 'completion' && facts.buyerEmail) await sendReceipt()
    await deps.saveOutcome(orderId, {
      status: 'skipped', skipReason: decision.reason, attempts: facts.attempts, sentAt: null,
      firstFailedAt: null, lastAttemptAt: facts.attempts > 0 ? nowIso : null, lastError: null,
      scheduledFor: null, email: facts.buyerEmail,
    }, facts)
    return { status: 'skipped', skipReason: decision.reason }
  }

  const attempts = facts.attempts + 1
  const failed = async (error: string): Promise<InviteResult> => {
    await deps.saveOutcome(orderId, {
      status: 'failed', skipReason: null, attempts, sentAt: null,
      firstFailedAt: facts.firstFailedAt ?? nowIso, lastAttemptAt: nowIso, lastError: error.slice(0, 500),
      scheduledFor: nowIso, email: facts.buyerEmail, // due at the next daily cron run
    }, facts)
    return { status: 'failed', error }
  }

  // Not configured, or the opt-out could not be read (never assume it is
  // on): the buyer still gets their receipt on completion, without the BCC,
  // and the invite is retried. A retry never mails a receipt without one.
  const blocker = !trustpilot
    ? 'TRUSTPILOT_BCC_EMAIL is not set — no Trustpilot BCC was sent'
    : facts.reviewInvitesOn === null
      ? 'could not read the buyer’s email preferences — no Trustpilot BCC was sent'
      : null
  if (blocker) {
    if (mode === 'completion') await deps.sendReceipt({ ...receiptBase(), trustpilot: null }).catch(() => undefined)
    return failed(blocker)
  }

  let res: { success: boolean; error?: unknown }
  try {
    res = await sendReceipt()
  } catch (e) {
    res = { success: false, error: e }
  }
  if (!res.success) return failed(errorText(res.error))

  await deps.saveOutcome(orderId, {
    status: 'sent', skipReason: null, attempts, sentAt: nowIso,
    firstFailedAt: facts.firstFailedAt, lastAttemptAt: nowIso, lastError: null,
    scheduledFor: null, email: facts.buyerEmail,
  }, facts)
  return { status: 'sent' }
}

function errorText(e: unknown): string {
  if (!e) return 'email provider refused the send'
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  const m = (e as { message?: unknown }).message
  return typeof m === 'string' ? m : JSON.stringify(e)
}

// ── Database + email wiring ─────────────────────────────────────────────────

async function loadFacts(orderId: string): Promise<InviteFacts | null> {
  const db = createServiceRoleClient() as any
  const { data: order } = await db
    .from('orders')
    .select('id, order_number, status, release_method, disputed_at, total_amount, buyer_id, seller_id, listing:listings(title)')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return null

  const [{ data: parties }, { data: invite }, reviewInvitesOn, listingTitle] = await Promise.all([
    db.from('profiles').select('id, email, username, full_name, is_test').in('id', [order.buyer_id, order.seller_id]),
    db.from('trustpilot_invitations').select('status, attempts, first_failed_at').eq('order_id', orderId).maybeSingle(),
    readReviewInvitesPref(db, order.buyer_id),
    orderItemTitleFor(orderId, order.listing?.title || 'your item'),
  ])
  const buyer = parties?.find((p: any) => p.id === order.buyer_id)
  const seller = parties?.find((p: any) => p.id === order.seller_id)

  return {
    orderId,
    orderNumber: order.order_number || orderId.slice(0, 8).toUpperCase(),
    orderStatus: order.status,
    releaseMethod: order.release_method,
    disputed: Boolean(order.disputed_at),
    buyerId: order.buyer_id,
    buyerEmail: buyer?.email || null,
    buyerName: buyer?.full_name || buyer?.username || 'Gamer',
    buyerIsTest: Boolean(buyer?.is_test),
    sellerIsTest: Boolean(seller?.is_test),
    reviewInvitesOn,
    inviteStatus: invite?.status ?? null,
    attempts: invite?.attempts ?? 0,
    firstFailedAt: invite?.first_failed_at ?? null,
    totalPaid: Number(order.total_amount ?? 0),
    listingTitle,
  }
}

/** The opt-out, read strictly: an error is `null` (unknown), never the default. */
async function readReviewInvitesPref(db: any, userId: string): Promise<boolean | null> {
  try {
    const { data, error } = await db.from('email_preferences').select('review_invites').eq('user_id', userId).maybeSingle()
    return error ? null : resolveEmailPref(data, 'review_invites')
  } catch {
    return null
  }
}

async function saveOutcome(orderId: string, o: InviteOutcome, f: InviteFacts): Promise<void> {
  const db = createServiceRoleClient() as any
  const { error } = await db.from('trustpilot_invitations').upsert(
    {
      order_id: orderId,
      buyer_id: f.buyerId,
      email: o.email,
      status: o.status,
      skip_reason: o.skipReason,
      attempts: o.attempts,
      sent_at: o.sentAt,
      first_failed_at: o.firstFailedAt,
      last_attempt_at: o.lastAttemptAt,
      last_error: o.lastError,
      ...(o.scheduledFor ? { scheduled_for: o.scheduledFor } : {}),
    },
    { onConflict: 'order_id' },
  )
  if (error) console.error(`[trustpilot] could not record invite outcome for ${orderId}:`, error.message)
}

async function sendReceipt(a: ReceiptArgs) {
  const { sendOrderCompletionEmail } = await import('@/lib/email')
  return sendOrderCompletionEmail(a)
}

const defaultDeps: InviteDeps = {
  loadFacts,
  saveOutcome,
  sendReceipt,
  bccAddress: () => process.env.TRUSTPILOT_BCC_EMAIL?.trim() || null,
  now: () => new Date(),
}

/** The receipt + invite for a freshly completed order. Never throws. */
export async function sendCompletionReceipt(orderId: string): Promise<InviteResult> {
  try {
    return await runCompletionInvite(orderId, 'completion')
  } catch (e) {
    console.error(`[trustpilot] completion receipt for ${orderId} failed:`, e)
    return { status: 'failed', error: errorText(e) }
  }
}
