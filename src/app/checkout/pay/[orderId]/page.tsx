/**
 * /checkout/pay/[orderId] — the native BTCPay payment page.
 *
 * The buyer lands here from checkout (createCheckout stores this URL as the
 * order's checkout_url when the active provider is btcpay). Server side we:
 *   - authenticate + verify the buyer owns the order,
 *   - bounce anywhere sensible if the order is already paid / not payable,
 *   - pull the live invoice + per-coin payment methods from Greenfield,
 *   - pre-render a QR per method (server-side; the address set is fixed at
 *     invoice creation, so no client QR lib is needed).
 *
 * The client component polls getPaymentPageStatus; the verified webhook is
 * the only thing that actually marks the order paid.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import PayClient, { type PayMethod } from './_PayClient'

export const dynamic = 'force-dynamic'

interface PayPageProps {
  params: Promise<{ orderId: string }>
}

/** Human label for a Greenfield paymentMethodId ("BTC-CHAIN", "LTC-CHAIN",
 *  plugin ids for USDT…). Defensive: unknown ids fall back to the raw code. */
function methodLabel(id: string): { label: string; short: string } {
  const u = id.toUpperCase()
  if (u.includes('LN')) return { label: 'Bitcoin (Lightning)', short: 'BTC ⚡' }
  if (u.startsWith('BTC')) return { label: 'Bitcoin', short: 'BTC' }
  if (u.startsWith('LTC')) return { label: 'Litecoin', short: 'LTC' }
  if (u.includes('USDT') || u.includes('TRON'))
    return { label: 'USDT (TRON · TRC20)', short: 'USDT' }
  const code = u.split('-')[0]
  return { label: code, short: code }
}

export default async function PayPage({ params }: PayPageProps) {
  const { orderId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/checkout/pay/${orderId}`)

  const { data: order } = (await supabase
    .from('orders')
    .select(
      'id, buyer_id, status, total_amount, currency, payment_provider, provider_charge_id, payment_expires_at, checkout_url, listing_id, listing:listing_id ( title )'
    )
    .eq('id', orderId)
    .single()) as any

  if (!order || order.buyer_id !== user.id) redirect('/account/orders')

  // Already paid (or otherwise terminal) → the order page owns the story.
  if (order.status !== 'pending') redirect(`/account/orders/${orderId}`)

  // Not a BTCPay order (legacy/hosted provider) → its own checkout URL, or
  // the order page's Awaiting Payment panel as the fallback.
  if (order.payment_provider !== 'btcpay' || !order.provider_charge_id) {
    redirect(order.checkout_url && !order.checkout_url.includes('/checkout/pay/')
      ? order.checkout_url
      : `/account/orders/${orderId}`)
  }

  // Live invoice + payable methods from Greenfield.
  const { btcpayFetchInvoice, btcpayFetchPaymentMethods } = await import(
    '@/lib/payments/providers/btcpay'
  )
  let invoiceStatus = 'Expired'
  let methods: PayMethod[] = []
  let expiresAtIso: string | null = order.payment_expires_at ?? null
  // Invoice amount = the remaining charge (order total minus any wallet
  // credit applied at checkout). Falls back to the order total.
  let invoiceAmount = Number(order.total_amount) || 0
  try {
    const invoice = await btcpayFetchInvoice(order.provider_charge_id)
    invoiceStatus = invoice.status
    if (invoice.amount && Number.isFinite(Number(invoice.amount))) {
      invoiceAmount = Number(invoice.amount)
    }
    if (invoice.expirationTime) {
      expiresAtIso = new Date(invoice.expirationTime * 1000).toISOString()
    }
    if (invoice.status === 'New' || invoice.status === 'Processing') {
      const raw = await btcpayFetchPaymentMethods(order.provider_charge_id)
      methods = await Promise.all(
        raw
          .filter((m) => m.destination)
          .map(async (m) => {
            const { label, short } = methodLabel(m.paymentMethodId)
            const qrText = m.paymentLink || m.destination
            const qrDataUrl = await QRCode.toDataURL(qrText, { width: 480, margin: 1 })
            return {
              id: m.paymentMethodId,
              label,
              short,
              address: m.destination,
              paymentLink: m.paymentLink ?? null,
              due: m.due ?? m.amount ?? '',
              totalPaid: m.totalPaid ?? '0',
              rate: m.rate ?? null,
              qrDataUrl,
            }
          })
      )
    }
  } catch (e) {
    // Greenfield unreachable — render the retry state rather than a 500; the
    // client's poll recovers as soon as the instance responds again.
    console.error('[PayPage] Greenfield fetch failed:', e)
    invoiceStatus = 'Unreachable'
  }

  return (
    <main className="w-full">
      <PayClient
        orderId={orderId}
        listingTitle={order.listing?.title ?? 'Your Order'}
        totalAmount={Number(order.total_amount) || 0}
        currency={order.currency || 'USD'}
        invoiceAmount={invoiceAmount}
        initialInvoiceStatus={invoiceStatus}
        expiresAt={expiresAtIso}
        methods={methods}
      />
    </main>
  )
}
