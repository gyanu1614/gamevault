/**
 * POST /api/webhooks/didit — Didit KYC (v3) webhook intake.
 *
 * Today a Didit decision is only picked up when the applicant returns to our
 * tab and the wizard polls (checkKycSession). This route closes that gap:
 * Didit pushes the decision the moment it lands, and we record the SAME
 * evidence row the poll path records, so admin review sees the approved video
 * session even if the applicant never comes back to the tab.
 *
 * Security model:
 *   - HMAC-SHA256 over the RAW request body with DIDIT_WEBHOOK_SECRET,
 *     hex-encoded, delivered in the `X-Signature` header. Compared with
 *     timingSafeEqual. Didit also sends `X-Timestamp` (unix seconds); when
 *     present it must be within a 5-minute window to stop replays.
 *   - Missing secret env → warn + 503 (fail closed in prod, nothing crashes).
 *   - This endpoint ONLY records evidence. It never approves applications,
 *     never changes roles — the webhook body is not trusted for privileges.
 *
 * Conventions mirror /api/webhooks/coingate: raw-body handling, service-role
 * writes, idempotency (re-delivered webhooks must not duplicate rows), fast
 * 2xx responses (providers retry on non-2xx), [didit-webhook]-tagged logging.
 *
 * Runs on the Node runtime (needs node:crypto + the service-role client).
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import {
  isValidDiditSessionId,
  normalizeDiditStatus,
} from '@/app/account/become-seller/_redesign/integrations'
import { DIDIT_EVIDENCE_PREFIX } from '@/lib/utils/seller-verification'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Didit re-delivers on failure; reject signatures older than this (seconds). */
const TIMESTAMP_TOLERANCE_SECONDS = 300

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface DiditWebhookPayload {
  session_id?: string
  status?: string
  vendor_data?: string
  workflow_id?: string
}

/** Constant-time HMAC-SHA256 (hex) check of the raw body. */
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const provided = Buffer.from(signature, 'utf8')
  const wanted = Buffer.from(expected, 'utf8')
  if (provided.length !== wanted.length) return false
  return timingSafeEqual(provided, wanted)
}

export async function POST(req: NextRequest) {
  // Raw body — Didit signs the raw bytes, so read text BEFORE any parsing.
  const rawBody = await req.text()

  const secret = process.env.DIDIT_WEBHOOK_SECRET
  if (!secret) {
    // Fail closed: without the secret we cannot authenticate anything.
    console.warn(
      '[didit-webhook] DIDIT_WEBHOOK_SECRET is not set — rejecting webhook (503)'
    )
    return NextResponse.json(
      { ok: false, error: 'webhook not configured' },
      { status: 503 }
    )
  }

  const signature = req.headers.get('x-signature') ?? ''
  if (!signature || !verifySignature(rawBody, signature, secret)) {
    console.warn('[didit-webhook] invalid or missing X-Signature — rejecting (401)')
    return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 401 })
  }

  // Replay guard — Didit sends X-Timestamp (unix seconds) alongside the
  // signature; when present it must be recent.
  const timestampHeader = req.headers.get('x-timestamp')
  if (timestampHeader) {
    const timestamp = Number(timestampHeader)
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (
      !Number.isFinite(timestamp) ||
      Math.abs(nowSeconds - timestamp) > TIMESTAMP_TOLERANCE_SECONDS
    ) {
      console.warn('[didit-webhook] stale or malformed X-Timestamp — rejecting (401)')
      return NextResponse.json({ ok: false, error: 'stale timestamp' }, { status: 401 })
    }
  }

  // Authenticated from here on. Process inside try/catch and answer 200 fast —
  // a processing hiccup must not trigger a retry storm of valid deliveries.
  try {
    let payload: DiditWebhookPayload
    try {
      payload = JSON.parse(rawBody) as DiditWebhookPayload
    } catch {
      console.error('[didit-webhook] unparseable JSON body — ignoring')
      return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
    }

    const sessionId = payload.session_id ?? ''
    const rawStatus = payload.status ?? 'Unknown'
    const vendorData = payload.vendor_data ?? ''

    if (!isValidDiditSessionId(sessionId)) {
      console.error('[didit-webhook] invalid session_id in payload — ignoring')
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
    }

    // Only terminal/decision statuses matter; lifecycle pings (Not Started /
    // In Progress / Abandoned…) are acknowledged and dropped.
    const status = normalizeDiditStatus(rawStatus)
    if (status !== 'approved' && status !== 'declined' && status !== 'in_review') {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
    }

    // vendor_data carries OUR user id (set at session creation). Anything
    // else is malformed and must not reach a DB query.
    if (!UUID_RE.test(vendorData)) {
      console.error(
        `[didit-webhook] vendor_data is not a uuid (session ${sessionId}) — ignoring`
      )
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
    }
    const userId = vendorData

    if (status === 'declined' || status === 'in_review') {
      // Record nothing — the poll path stores no evidence for these either.
      // The applicant resolves it in the wizard (retry / manual uploads).
      console.log(
        `[didit-webhook] session ${sessionId} for user ${userId}: ${rawStatus} — no evidence stored`
      )
      return NextResponse.json({ ok: true, recorded: false }, { status: 200 })
    }

    // ── Approved: upsert the same synthetic evidence row the poll path
    //    creates (seller_kyc_documents, document_type 'other',
    //    file_path 'didit:<session_id>'). Evidence only — the application's
    //    status/roles are untouched.
    const supabase = createServiceRoleClient()
    const evidencePath = `${DIDIT_EVIDENCE_PREFIX}${sessionId}`

    // Idempotency: a re-delivered webhook must not duplicate the row.
    const { data: existing, error: existingError } = (await supabase
      .from('seller_kyc_documents')
      .select('id')
      .eq('file_path', evidencePath)
      .limit(1)
      .maybeSingle()) as { data: { id: string } | null; error: unknown }

    if (existingError) {
      // DB hiccups are transient — 500 so Didit redelivers (insert is
      // idempotent, so retries are safe). Mirrors the CoinGate spine.
      console.error('[didit-webhook] evidence lookup failed:', existingError)
      return NextResponse.json({ ok: false, error: 'lookup failed' }, { status: 500 })
    }
    if (existing) {
      return NextResponse.json({ ok: true, deduped: true }, { status: 200 })
    }

    // Attach to the user's latest ACTIVE application only — a session
    // completed after a rejection/withdrawal must not decorate the old
    // application; on resubmit the wizard carries the evidence itself.
    const { data: application, error: appError } = (await supabase
      .from('seller_applications')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['pending', 'under_review', 'changes_requested'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { id: string } | null; error: unknown }

    if (appError) {
      console.error('[didit-webhook] application lookup failed:', appError)
      return NextResponse.json({ ok: false, error: 'lookup failed' }, { status: 500 })
    }
    if (!application) {
      console.log(
        `[didit-webhook] approved session ${sessionId} but user ${userId} has no active application — evidence will ride with their next submission`
      )
      return NextResponse.json({ ok: true, recorded: false }, { status: 200 })
    }

    const { error: insertError } = await (supabase
      .from('seller_kyc_documents')
      .insert as any)({
      application_id: application.id,
      user_id: userId,
      document_type: 'other',
      file_path: evidencePath,
      file_name: 'Didit Video Verification (Approved)',
      file_size: 0,
      file_type: 'application/didit-session',
      verified: false,
    })

    if (insertError) {
      console.error('[didit-webhook] evidence insert failed:', insertError)
      return NextResponse.json({ ok: false, error: 'insert failed' }, { status: 500 })
    }

    console.log(
      `[didit-webhook] recorded approved session ${sessionId} for application ${application.id}`
    )
    return NextResponse.json({ ok: true, recorded: true }, { status: 200 })
  } catch (e) {
    console.error('[didit-webhook] processing error:', e)
    // 500 → Didit redelivers with backoff. Transient failures recover; a
    // deterministic bug just exhausts the bounded retries. Idempotency
    // (deduped file_path) makes redelivery safe either way.
    return NextResponse.json({ ok: false, error: 'processing error' }, { status: 500 })
  }
}
