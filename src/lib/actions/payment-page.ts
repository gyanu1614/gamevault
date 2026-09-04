'use server'

/**
 * getPaymentPageStatus — the poll behind the native BTCPay payment page
 * (/checkout/pay/[orderId]).
 *
 * READ-ONLY on purpose: the verified webhook is the only thing that moves an
 * order (spec §6). This action just tells the page what to render:
 *   - the ORDER status from our DB (paid → the page redirects to the order),
 *   - the live invoice status from Greenfield while the order is pending
 *     (Processing → "Payment Detected", Expired → the fresh-invoice state),
 *   - per-method paid/due so a partial payment shows up live.
 *
 * Auth: the buyer who owns the order, nobody else.
 */

import { createClient } from '@/lib/supabase/server'

export interface PaymentMethodStatus {
  paymentMethodId: string
  due?: string
  totalPaid?: string
}

export interface PaymentPageStatus {
  success: boolean
  error?: string
  /** Our DB order status — the authority. Anything but 'pending' ends the page. */
  orderStatus?: string
  /** Greenfield invoice status (New | Processing | Settled | Expired | Invalid). */
  invoiceStatus?: string
  additionalStatus?: string
  methods?: PaymentMethodStatus[]
  /** Chain-watch: a transfer reached the reserved address on the network,
   *  even though the payment server hasn't registered it yet. Display-only —
   *  lets the page say "Payment Seen On Network" within seconds. */
  seenOnNetwork?: boolean
}

/** Direct TRON chain peek: any TRC20 transfer INTO `address` at/after `sinceMs`?
 *  Public TronGrid (optional TRONGRID_API_KEY env raises rate limits).
 *  Best-effort display sugar — failures just mean no early "seen" state. */
async function tronSeenAtAddress(address: string, sinceMs: number): Promise<boolean> {
  try {
    const headers: Record<string, string> = {}
    if (process.env.TRONGRID_API_KEY) headers['TRON-PRO-API-KEY'] = process.env.TRONGRID_API_KEY
    const res = await fetch(
      `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=10&only_to=true`,
      { headers, cache: 'no-store' }
    )
    if (!res.ok) return false
    const data = await res.json()
    return (data?.data ?? []).some((t: any) => Number(t.block_timestamp) >= sinceMs)
  } catch {
    return false
  }
}

export async function getPaymentPageStatus(orderId: string): Promise<PaymentPageStatus> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: order } = (await supabase
      .from('orders')
      .select('id, buyer_id, status, payment_provider, provider_charge_id')
      .eq('id', orderId)
      .single()) as any
    if (!order) return { success: false, error: 'Order not found' }
    if (order.buyer_id !== user.id) return { success: false, error: 'Unauthorized' }

    // Terminal or paid → the page redirects; no provider round-trip needed.
    if (order.status !== 'pending') {
      return { success: true, orderStatus: order.status }
    }

    if (order.payment_provider !== 'btcpay' || !order.provider_charge_id) {
      return { success: true, orderStatus: order.status }
    }

    const { btcpayFetchInvoice, btcpayFetchPaymentMethods } = await import(
      '@/lib/payments/providers/btcpay'
    )
    const invoice = await btcpayFetchInvoice(order.provider_charge_id)
    // Methods are best-effort display data (partial-payment progress); a
    // failure here must not blank the whole poll.
    let methods: PaymentMethodStatus[] = []
    let tronDestination: string | undefined
    try {
      const raw = await btcpayFetchPaymentMethods(order.provider_charge_id)
      methods = raw.map((m) => ({
        paymentMethodId: m.paymentMethodId,
        due: m.due,
        totalPaid: m.totalPaid,
      }))
      tronDestination = raw.find(
        (m) =>
          m.destination &&
          (m.paymentMethodId.toUpperCase().includes('USDT') ||
            m.paymentMethodId.toUpperCase().includes('TRON'))
      )?.destination
    } catch {
      // display-only; ignore
    }

    // Chain-watch: only worth checking while the processor still shows nothing
    // (invoice New, no registered payment) — the instant-feedback window.
    let seenOnNetwork = false
    const nothingRegistered =
      invoice.status === 'New' && !methods.some((m) => Number(m.totalPaid ?? 0) > 0)
    if (nothingRegistered && tronDestination && invoice.createdTime) {
      seenOnNetwork = await tronSeenAtAddress(tronDestination, invoice.createdTime * 1000)
    }

    return {
      success: true,
      orderStatus: order.status,
      invoiceStatus: invoice.status,
      additionalStatus: invoice.additionalStatus,
      methods,
      seenOnNetwork,
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Status check failed' }
  }
}
