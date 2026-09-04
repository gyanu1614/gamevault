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
    try {
      const raw = await btcpayFetchPaymentMethods(order.provider_charge_id)
      methods = raw.map((m) => ({
        paymentMethodId: m.paymentMethodId,
        due: m.due,
        totalPaid: m.totalPaid,
      }))
    } catch {
      // display-only; ignore
    }

    return {
      success: true,
      orderStatus: order.status,
      invoiceStatus: invoice.status,
      additionalStatus: invoice.additionalStatus,
      methods,
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Status check failed' }
  }
}
