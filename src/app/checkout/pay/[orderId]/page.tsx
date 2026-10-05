/**
 * /checkout/pay/[orderId] — the native BTCPay payment page (2026-10 layout:
 * payment column + order summary / status column on the dark ground).
 *
 * Server side: authenticate + verify the buyer owns the order, bounce anywhere
 * sensible if it isn't payable, pull the live invoice + per-coin payment
 * methods from Greenfield. The QR is drawn as plain SVG from qr.ts (payload =
 * BTCPay's own payment URI, verbatim); the client polls getPaymentPageStatus
 * (including the instant chain-watch) while the verified webhook remains the
 * only thing that actually marks the order paid.
 */

import { redirect } from 'next/navigation'
import { isUuid } from '@/lib/ids'
import { createClient } from '@/lib/supabase/server'
import { withOwnOrderFields } from '@/lib/orders/own-fields'
import PayClient, { type PayMethod, type PaySummary } from './_PayClient'

export const dynamic = 'force-dynamic'

interface PayPageProps {
  params: Promise<{ orderId: string }>
  searchParams: Promise<{ net?: string; coin?: string }>
}

/** Preselect the payment-method tab from the checkout page's coin/network
 *  choice (?coin=usdt&net=trc20). Defensive substring matching — plugin
 *  paymentMethodIds vary. Falls back to the first method. */
function preferredMethodId(
  methods: PayMethod[],
  coin?: string,
  net?: string
): string | null {
  if (!methods.length) return null
  const find = (pred: (u: string) => boolean) =>
    methods.find((m) => pred(m.id.toUpperCase()))?.id ?? null
  if (coin === 'btc') return find((u) => u.startsWith('BTC')) ?? methods[0].id
  switch (net) {
    case 'polygon':
      return find((u) => u.includes('POLYGON') || u.includes('MATIC')) ?? methods[0].id
    case 'ethereum':
      return find((u) => u.includes('ETHEREUM')) ?? methods[0].id
    case 'trc20':
      return find((u) => u.includes('TRON')) ?? methods[0].id
    default:
      return methods[0].id
  }
}

/** Display metadata for a Greenfield paymentMethodId. The chain must be
 *  PROVEN by the method id (or the address prefix as tiebreaker — TRON
 *  base58 addresses start with T, EVM with 0x); a wrong network label sends
 *  the buyer's funds to a dead address, so an unproven chain renders a
 *  generic double-check warning instead of a guess. */
function methodMeta(
  id: string,
  address: string
): {
  label: string
  short: string
  icon: string | null
  network: string | null
  networkName: string | null
  confirmEta: string | null
  networkWarning: string | null
} {
  const u = id.toUpperCase()
  if (u.includes('USDT')) {
    const chain =
      u.includes('TRON') || address.startsWith('T')
        ? { network: 'TRON (TRC20)', name: 'TRON', eta: 'usually under a minute' }
        : u.includes('POLYGON') || u.includes('MATIC')
          ? { network: 'Polygon', name: 'Polygon', eta: 'usually under a minute' }
          : u.includes('ETH')
            ? { network: 'Ethereum (ERC20)', name: 'Ethereum', eta: 'usually 2 to 5 minutes' }
            : null
    return {
      label: 'USDT',
      short: 'USDT',
      icon: '/crypto/usdt.svg',
      network: chain?.network ?? null,
      networkName: chain?.name ?? null,
      confirmEta: chain?.eta ?? null,
      networkWarning: chain
        ? `Send only USDT on the ${chain.name} network. Funds sent on any other network can’t be recovered.`
        : 'Check the network in your wallet matches this address. Funds sent on the wrong network can’t be recovered.',
    }
  }
  if (u.includes('LN'))
    return { label: 'Bitcoin (Lightning)', short: 'BTC', icon: '/crypto/btc.svg', network: 'Lightning', networkName: 'Lightning', confirmEta: 'usually instant', networkWarning: null }
  if (u.startsWith('BTC'))
    return { label: 'Bitcoin', short: 'BTC', icon: '/crypto/btc.svg', network: 'Bitcoin', networkName: 'Bitcoin', confirmEta: 'usually 10 to 20 minutes', networkWarning: null }
  const code = u.split('-')[0]
  return { label: code, short: code, icon: null, network: null, networkName: null, confirmEta: null, networkWarning: null }
}

export default async function PayPage({ params, searchParams }: PayPageProps) {
  const { orderId } = await params
  const { net, coin } = await searchParams
  // ROUTE-009 — short-circuit a malformed id before the query, matching this
  // route's own miss behaviour below (redirect to the orders list).
  if (!isUuid(orderId)) redirect('/account/orders')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/checkout/pay/${orderId}`)

  const { data: order } = (await supabase
    .from('orders')
    .select(
      'id, order_number, buyer_id, status, quantity, subtotal, total_amount, currency, listing_id, listing:listing_id ( title, images, game:game_id ( name ) )'
    )
    .eq('id', orderId)
    .single()) as any

  if (!order || order.buyer_id !== user.id) redirect('/account/orders')

  // Buyer profile for the navbar account menu (username + avatar).
  const { data: buyerProfile } = (await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', user.id)
    .maybeSingle()) as any

  // Already paid (or otherwise terminal) → the order page owns the story.
  if (order.status !== 'pending') redirect(`/account/orders/${orderId}`)

  // Round B: the charge this page renders is the order's OPEN payment
  // attempt. Not a BTCPay attempt (hosted provider) → its own checkout URL,
  // or the order page's Awaiting Payment panel as the fallback.
  const { openAttemptForOrder } = await import('@/lib/payments/attempts')
  const attempt = await openAttemptForOrder(orderId)
  if (attempt?.provider !== 'btcpay' || !attempt.provider_charge_id) {
    redirect(attempt?.checkout_url && !attempt.checkout_url.includes('/checkout/pay/')
      ? attempt.checkout_url
      : `/account/orders/${orderId}`)
  }
  const invoiceId: string = attempt.provider_charge_id

  // Order summary (display only). Item price + total are shared columns;
  // promo / processing fee / store credit are the buyer's own private fields,
  // read through the auth.uid()-scoped RPC. Same arithmetic as the order
  // page's breakdown; on any read failure the summary shows the total only.
  const round2 = (n: number) => Math.round(n * 100) / 100
  const totalNum = Number(order.total_amount) || 0
  let summary: PaySummary = {
    itemPrice: null,
    quantity: Number(order.quantity) || 1,
    serviceFee: null,
    promoDiscount: 0,
    storeCredit: 0,
    total: totalNum,
  }
  try {
    const [own] = await withOwnOrderFields(supabase, 'buyer', [{ id: order.id as string }])
    const itemPrice = Number(order.subtotal ?? 0)
    const promoDiscount = Number(own?.promo_discount ?? 0) || 0
    summary = {
      ...summary,
      itemPrice: itemPrice > 0 ? itemPrice : null,
      // Marketplace + payment fee as one Service Fee row (order page model).
      serviceFee: itemPrice > 0 ? Math.max(0, round2(totalNum - itemPrice + promoDiscount)) : null,
      promoDiscount,
      storeCredit: Number(own?.wallet_amount_used ?? 0) || 0,
    }
  } catch (e) {
    console.error('[PayPage] own order fields read failed:', e)
  }

  // Live invoice + payable methods from Greenfield.
  const { btcpayFetchInvoice, btcpayFetchPaymentMethods } = await import(
    '@/lib/payments/providers/btcpay'
  )
  let invoiceStatus = 'Expired'
  let methods: PayMethod[] = []
  let expiresAtIso: string | null = attempt.expires_at ?? null
  // Invoice amount = the remaining charge (order total minus any wallet
  // credit applied at checkout). Falls back to the order total.
  let invoiceAmount = Number(order.total_amount) || 0
  let invoiceCreatedIso: string | null = null
  try {
    const invoice = await btcpayFetchInvoice(invoiceId)
    invoiceStatus = invoice.status
    if (invoice.createdTime) {
      invoiceCreatedIso = new Date(invoice.createdTime * 1000).toISOString()
    }
    if (invoice.amount && Number.isFinite(Number(invoice.amount))) {
      invoiceAmount = Number(invoice.amount)
    }
    if (invoice.expirationTime) {
      expiresAtIso = new Date(invoice.expirationTime * 1000).toISOString()
    }
    if (invoice.status === 'New' || invoice.status === 'Processing') {
      const raw = await btcpayFetchPaymentMethods(invoiceId)
      methods = raw
        .filter((m) => m.destination)
        .map((m) => {
          const meta = methodMeta(m.paymentMethodId, m.destination)
          return {
            id: m.paymentMethodId,
            ...meta,
            address: m.destination,
            paymentLink: m.paymentLink ?? null,
            due: m.due ?? m.amount ?? '',
            totalPaid: m.totalPaid ?? '0',
            rate: m.rate ?? null,
          }
        })
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
        orderNumber={order.order_number ?? null}
        listingId={order.listing_id ?? null}
        listingTitle={order.listing?.title ?? 'Your Order'}
        itemImage={order.listing?.images?.[0] ?? null}
        gameName={order.listing?.game?.name ?? null}
        summary={summary}
        currency={order.currency || 'USD'}
        invoiceAmount={invoiceAmount}
        initialInvoiceStatus={invoiceStatus}
        expiresAt={expiresAtIso}
        createdAt={invoiceCreatedIso}
        methods={methods}
        initialMethodId={preferredMethodId(methods, coin, net)}
        user={{ email: user.email }}
        buyerProfile={buyerProfile ?? null}
      />
    </main>
  )
}
