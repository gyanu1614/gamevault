/**
 * Card cases for the admin order page (service role: card_cases and
 * buyer_blocks have no RLS policies). Server-only; the page and the admin
 * actions are the only callers, and both sit behind the admin check.
 */
import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/service'
import { SITE_URL } from '@/config/site'
import type { DisputeEvidenceInput } from '@/lib/payments/providers/stripe/dispute-evidence'

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

/** card_cases / buyer_blocks are newer than the generated DB types. */
const caseDb = () => createServiceRoleClient() as unknown as { from: (table: 'card_cases' | 'buyer_blocks') => any }

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
    .select('id, order_number, buyer_id, seller_id, total_amount, currency, paid_at, seller_marked_delivered_at, delivered_at, buyer_confirmed_at, completed_at, delivery_evidence_urls, listing:listings ( game:games ( name ) )')
    .eq('id', orderId)
    .maybeSingle()) as { data: any }
  if (!o) return null

  const [{ data: buyer }, { data: convo }] = await Promise.all([
    svc.from('profiles').select('email, full_name, username').eq('id', o.buyer_id).maybeSingle() as any,
    svc.from('conversations').select('id').eq('order_id', orderId).maybeSingle() as any,
  ])
  const { data: msgs } = convo?.id
    ? ((await svc.from('messages').select('sender_id, content, created_at').eq('conversation_id', convo.id).order('created_at', { ascending: true }).limit(500)) as any)
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
    deliveryProofFiles: Array.isArray(o.delivery_evidence_urls) ? o.delivery_evidence_urls.length : 0,
    messages: ((msgs ?? []) as any[])
      .filter((m) => typeof m.content === 'string' && m.content.trim())
      .map((m) => ({ at: m.created_at, from: from(m.sender_id), text: m.content })),
    policyUrl: `${SITE_URL}/refunds`,
  }
}
