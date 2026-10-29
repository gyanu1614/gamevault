/**
 * Card cases for the admin order page (service role: card_cases and
 * buyer_blocks have no RLS policies). Server-only; the page and the admin
 * actions are the only callers, and both sit behind the admin check.
 */
import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/service'
import { SITE_URL } from '@/config/site'
import type { AccessLogRow, DisputeEvidenceInput } from '@/lib/payments/providers/stripe/dispute-evidence'
import type { ProofPhoto } from '@/lib/payments/providers/stripe/proof-pdf'
import { proofPhotoPaths } from '@/lib/orders/proof-photos'

export interface CardCaseRow {
  id: string
  order_id: string
  kind: 'refund' | 'dispute'
  provider_ref: string
  amount_minor: number
  card_minor: number
  currency: string
  reason: string | null
  status: 'open' | 'awaiting_decision' | 'review' | 'won' | 'settled'
  bearer: 'seller' | 'platform' | null
  evidence_due_by: string | null
  evidence_submitted_at: string | null
  created_at: string
  closed_at: string | null
}

export interface OrderCardCases {
  cases: CardCaseRow[]
  buyerBlock: { reason: string; blocked_at: string } | null
}

const CASE_COLUMNS =
  'id, order_id, kind, provider_ref, amount_minor, card_minor, currency, reason, status, bearer, evidence_due_by, evidence_submitted_at, created_at, closed_at'

/** card_cases / buyer_blocks / order_access_log are newer than the generated DB types. */
const caseDb = () =>
  createServiceRoleClient() as unknown as { from: (table: 'card_cases' | 'buyer_blocks' | 'order_access_log') => any }

export async function loadOrderCardCases(orderId: string, buyerId: string | null): Promise<OrderCardCases> {
  const svc = caseDb()
  const [cases, block] = await Promise.all([
    svc.from('card_cases').select(CASE_COLUMNS).eq('order_id', orderId).order('created_at', { ascending: false }),
    buyerId
      ? svc.from('buyer_blocks').select('reason, blocked_at').eq('user_id', buyerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return { cases: (cases.data ?? []) as unknown as CardCaseRow[], buyerBlock: (block.data ?? null) as OrderCardCases['buyerBlock'] }
}

export async function loadCardCase(caseId: string): Promise<CardCaseRow | null> {
  const { data } = await caseDb().from('card_cases').select(CASE_COLUMNS).eq('id', caseId).maybeSingle()
  return (data ?? null) as unknown as CardCaseRow | null
}

/** Everything the evidence builder needs, read from the order record. */
export async function loadDisputeEvidenceInput(orderId: string, itemTitle: string): Promise<DisputeEvidenceInput | null> {
  const svc = createServiceRoleClient()
  const { data: o } = (await svc
    .from('orders')
    .select('id, order_number, buyer_id, seller_id, total_amount, currency, paid_at, seller_marked_delivered_at, delivered_at, instant_delivery_delivered_at, buyer_confirmed_at, completed_at, delivery_evidence_urls, listing:listings ( game:games ( name ) )')
    .eq('id', orderId)
    .maybeSingle()) as { data: any }
  if (!o) return null

  const [{ data: buyer }, { data: convo }, { data: access }] = await Promise.all([
    svc.from('profiles').select('email, full_name, username').eq('id', o.buyer_id).maybeSingle() as any,
    svc.from('conversations').select('id').eq('order_id', orderId).maybeSingle() as any,
    caseDb().from('order_access_log').select('event, ip, user_agent, first_seen_at, last_seen_at, hits')
      .eq('order_id', orderId).eq('user_id', o.buyer_id).order('first_seen_at').limit(50),
  ])
  const { data: msgs } = convo?.id
    ? ((await svc.from('messages').select('sender_id, content, created_at').eq('conversation_id', convo.id).order('created_at', { ascending: false }).limit(60)) as any)
    : { data: [] }

  const from = (id: string | null): 'Buyer' | 'Seller' | 'DropMarket' =>
    id === o.buyer_id ? 'Buyer' : id === o.seller_id ? 'Seller' : 'DropMarket'
  const total = Number(o.total_amount ?? 0)
  return {
    orderRef: o.order_number || orderId.slice(0, 8).toUpperCase(),
    itemTitle,
    gameName: o.listing?.game?.name ?? null,
    amount: (o.currency ?? 'USD').toUpperCase() === 'USD' ? `$${total.toFixed(2)}` : `${total.toFixed(2)} ${o.currency}`,
    buyer: { email: buyer?.email ?? null, name: buyer?.full_name || buyer?.username || null },
    paidAt: o.paid_at,
    sellerMarkedDeliveredAt: o.seller_marked_delivered_at,
    deliveredAt: o.delivered_at,
    buyerConfirmedAt: o.buyer_confirmed_at,
    completedAt: o.completed_at,
    instantDeliveredAt: o.instant_delivery_delivered_at ?? null,
    deliveryProofFiles: Array.isArray(o.delivery_evidence_urls) ? o.delivery_evidence_urls.length : 0,
    accessLog: ((access ?? []) as any[]).map((r): AccessLogRow => ({
      event: r.event,
      firstSeen: r.first_seen_at,
      lastSeen: r.last_seen_at,
      hits: r.hits,
      ip: r.ip ? String(r.ip).replace(/\/(32|128)$/, '') : null,
      userAgent: r.user_agent ?? '',
    })),
    messages: ((msgs ?? []) as any[])
      .reverse()
      .filter((m) => typeof m.content === 'string' && m.content.trim())
      .map((m) => ({ at: m.created_at, from: from(m.sender_id), text: m.content })),
    policyUrl: `${SITE_URL}/refunds`,
  }
}

const BUCKET = 'delivery-evidence'

async function orderProofPaths(orderId: string): Promise<string[]> {
  const { data } = (await createServiceRoleClient().from('orders').select('delivery_evidence_urls').eq('id', orderId).maybeSingle()) as any
  return proofPhotoPaths(data?.delivery_evidence_urls)
}

/** The order's delivery photos with 10-minute links, for the Submit Evidence dialog. */
export async function loadProofPhotos(orderId: string): Promise<Array<{ path: string; url: string }>> {
  const paths = (await orderProofPaths(orderId)).slice(0, 12)
  if (!paths.length) return []
  const { data } = await createServiceRoleClient().storage.from(BUCKET).createSignedUrls(paths, 600)
  return (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [{ path: d.path, url: d.signedUrl }] : []))
}

// Upload paths start with the upload time in ms (`<orderId>/<ms>-<name>`).
const uploadedAt = (path: string) => {
  const ms = /^(\d{13})-/.exec(path.split('/').pop() ?? '')?.[1]
  return ms ? `, uploaded by the seller ${new Date(Number(ms)).toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''
}

/** The photos an admin chose, read from storage. Each must be one of the order's own. */
export async function loadChosenProofPhotos(orderId: string, orderRef: string, chosen: string[]): Promise<ProofPhoto[]> {
  const own = new Set(await orderProofPaths(orderId))
  const paths = [...new Set(chosen)]
  if (paths.some((p) => !own.has(p))) throw new Error('A chosen photo is not one of this order’s delivery photos.')
  const storage = createServiceRoleClient().storage.from(BUCKET)
  const files = await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await storage.download(path)
      if (error || !data) throw new Error(`Could not read the photo ${path.split('/').pop()}.`)
      return new Uint8Array(await data.arrayBuffer())
    })
  )
  return files.map((data, n) => ({ data, caption: `Delivery photo ${n + 1} of ${files.length}, order ${orderRef}${uploadedAt(paths[n])}` }))
}
