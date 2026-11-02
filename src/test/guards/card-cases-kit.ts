/**
 * Shared helpers for the card-case guard suites (card-cases.guard,
 * card-cases-proof.guard). Each suite keeps its own fixture (its own
 * namespace) and its own list of orders; the kit only reads and writes
 * through them.
 */
import { execFileSync } from 'node:child_process'
import type { Fixture } from './throwaway'

export const CUR = 'USD'
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const targetHost = (() => { try { return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return '' } })()
export const TARGET_IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)

/** Run `sql` in one psql transaction with app.money_fault set; returns stderr ('' on success). */
export function withFault(point: string, sql: string): string {
  const script = `BEGIN;\nSET LOCAL app.money_fault = '${point}';\n${sql};\nCOMMIT;`
  try {
    execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', script], { stdio: 'pipe' })
    return ''
  } catch (e: any) {
    return e?.stderr?.toString() ?? String(e)
  }
}

export function cardCaseKit(getFx: () => Fixture, orders: string[]) {
  const fx = getFx
  async function rpc<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await (fx().svc.rpc as any)(name, args)
    if (error) throw new Error(`${name}: ${error.message}`)
    return data as T
  }
  async function order(id: string) {
    return ((await fx().svc.from('orders').select('*').eq('id', id).single()).data ?? {}) as any
  }
  async function cases(id: string) {
    return ((await (fx().svc as any).from('card_cases').select('*').eq('order_id', id)).data ?? []) as any[]
  }
  async function bal(owner: 'seller' | 'platform' | 'provider', kind: string): Promise<number> {
    const ownerId = owner === 'seller' ? fx().seller.id : null
    return Number(await rpc('ledger_balance', { p_owner_type: owner, p_owner_id: ownerId, p_kind: kind, p_currency: CUR }))
  }
  async function wallet(): Promise<number> {
    return Number(await rpc('user_wallet_balance', { p_user_id: fx().buyer.id, p_currency: CUR }))
  }
  async function entriesOf(key: string) {
    const { data: txn } = await fx().svc.from('ledger_transactions').select('id').eq('idempotency_key', key).maybeSingle()
    if (!txn) return null
    const { data } = await fx().svc.from('ledger_entries').select('direction, amount_minor, account:account_id ( kind, owner_type )').eq('transaction_id', (txn as any).id)
    return ((data ?? []) as any[]).map((e) => `${e.account.owner_type}.${e.account.kind}:${e.direction}:${e.amount_minor}`).sort()
  }
  async function blocked(): Promise<boolean> {
    return Boolean((await (fx().svc as any).from('buyer_blocks').select('user_id').eq('user_id', fx().buyer.id).maybeSingle()).data)
  }

  /** total 1.00, seller payout 0.80 (the platform takes 0.20). `walletMinor`
   *  of the gross is paid from the buyer's wallet, the rest by card. */
  async function paidOrder(walletMinor = 0): Promise<string> {
    const { data, error } = await fx().svc.from('orders').insert({
      buyer_id: fx().buyer.id, seller_id: fx().seller.id, listing_id: fx().listingId, quantity: 1,
      unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
      platform_fee: 0.2, payment_processing_fee: 0, total_amount: 1, seller_payout: 0.8, currency: CUR,
      status: 'pending', escrow_status: 'pending',
    } as any).select('id').single()
    if (error) throw new Error(`order insert: ${error.message}`)
    const id = (data as any).id as string
    orders.push(id)
    if (walletMinor > 0) {
      await rpc('post_journal', {
        p_idempotency_key: `checkout_wallet:${id}`, p_event_ref: 'CHECKOUT_WALLET', p_order_id: id, p_matures_at: null,
        p_entries: [
          { owner_type: 'buyer', owner_id: fx().buyer.id, kind: 'user_wallet', direction: 'debit', amount_minor: walletMinor, currency: CUR },
          { owner_type: 'platform', owner_id: null, kind: 'escrow_held', direction: 'credit', amount_minor: walletMinor, currency: CUR },
        ],
      })
    }
    await rpc('safedrop_transition', { p_order_id: id, p_event: 'CHARGE_CONFIRMED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null })
    // The Checkout Session that paid it: cases are booked only against this one.
    const { error: attErr } = await fx().svc.from('payment_attempts').insert({
      order_id: id, provider: 'stripe', provider_charge_id: `cs_${id}`, status: 'paid',
      amount_minor: 100 - walletMinor, wallet_minor: walletMinor, order_total_minor: 100, currency: CUR,
    } as any)
    if (attErr) throw new Error(`attempt insert: ${attErr.message}`)
    return id
  }
  async function delivered(): Promise<string> {
    const id = await paidOrder()
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx().seller.id })
    return id
  }
  async function completed(): Promise<string> {
    const id = await delivered()
    await rpc('order_confirm_receipt', { p_order_id: id, p_buyer_id: fx().buyer.id })
    return id
  }
  const refund = (id: string, amount = 100, session = `cs_${id}`) =>
    rpc('card_refund_external_book', { p_order_id: id, p_ref: `ch_${id}:refund`, p_session: session, p_amount_minor: amount, p_currency: CUR })
  const disputeOpen = (id: string, amount = 100) =>
    rpc('card_dispute_open', { p_order_id: id, p_ref: `dp_${id}`, p_session: `cs_${id}`, p_amount_minor: amount, p_currency: CUR, p_reason: 'fraudulent', p_due_by: null })
  const disputeClose = (id: string, outcome: 'won' | 'lost') => rpc('card_dispute_close', { p_ref: `dp_${id}`, p_outcome: outcome })
  async function safedropDisputes(id: string) {
    return ((await fx().svc.from('disputes').select('id, status').eq('transaction_id', id)).data ?? []) as any[]
  }

  /** Removes every row the suite's orders caused (orders cascade card_cases + order_access_log). */
  async function cleanup() {
    const svc = fx().svc as any
    for (const id of orders) await svc.from('notifications').delete().like('link', `%${id}%`)
    await svc.from('order_dispute_events').delete().in('order_id', orders)
    const disputeIds = ((await svc.from('disputes').select('id').in('transaction_id', orders)).data ?? []).map((d: any) => d.id)
    await svc.from('dispute_resolutions').delete().in('dispute_id', disputeIds)
    await svc.from('disputes').delete().in('transaction_id', orders)
    await svc.from('buyer_blocks').delete().eq('user_id', fx().buyer.id)
    await svc.from('payment_attempts').delete().in('order_id', orders)
    for (const id of orders) await svc.rpc('ledger_test_cleanup_by_order', { p_order_id: id })
    await svc.from('orders').delete().in('id', orders)
  }

  return { rpc, order, cases, bal, wallet, entriesOf, blocked, paidOrder, delivered, completed, refund, disputeOpen, disputeClose, safedropDisputes, cleanup }
}
