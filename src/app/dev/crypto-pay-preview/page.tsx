/**
 * Dev-only preview of the crypto payment page (PayClient) with mock data, so
 * the design can be checked in every state without a BTCPay invoice.
 * ?state=waiting|seen|partial|confirming|paid|expired|unreachable (default
 * waiting) and ?coin=btc for the Bitcoin variant. Gated by /dev/layout
 * (404 on the live site). Mirrors /dev/checkout-preview.
 */

import PayClient, { type PayMethod, type ViewState } from '@/app/checkout/pay/[orderId]/_PayClient'

const STATES: ViewState[] = ['waiting', 'seen', 'partial', 'confirming', 'paid', 'expired', 'unreachable']

const USDT: PayMethod = {
  id: 'USDT-TRON',
  label: 'Tether USDT',
  short: 'USDT',
  icon: '/crypto/usdt.svg',
  network: 'TRC20',
  networkName: 'TRON',
  confirmEta: 'usually under a minute',
  networkWarning: 'Only send USDT on the TRON (TRC20) network. Funds sent on another network cannot be recovered.',
  address: 'TQ5yS3PRmxvDJ8kq9h2DQd1TfY6mWzEnoB',
  paymentLink: null,
  due: '21.42',
  totalPaid: '0',
  rate: '1.00',
}

const BTC: PayMethod = {
  id: 'BTC-CHAIN',
  label: 'Bitcoin',
  short: 'BTC',
  icon: '/crypto/btc.svg',
  network: null,
  networkName: 'Bitcoin',
  confirmEta: 'usually 10 to 30 minutes',
  networkWarning: 'Only send Bitcoin on the Bitcoin network. Funds sent on another network cannot be recovered.',
  address: 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h',
  paymentLink: null,
  due: '0.00031217',
  totalPaid: '0',
  rate: '68617.40',
}

export default async function CryptoPayPreview({ searchParams }: { searchParams: Promise<{ state?: string; coin?: string }> }) {
  const sp = await searchParams
  const state = STATES.includes(sp.state as ViewState) ? (sp.state as ViewState) : 'waiting'
  const method = sp.coin === 'btc' ? BTC : USDT
  return (
    <PayClient
      orderId="00000000-0000-4000-8000-00000000c0de"
      orderNumber="DM-7Q2K-91XD"
      listingId={null}
      listingTitle="Dragon Fruit (Permanent)"
      itemImage={null}
      gameName="Blox Fruits"
      summary={{ itemPrice: 20, quantity: 1, serviceFee: 1.42, promoDiscount: 0, storeCredit: 0, total: 21.42 }}
      currency="USD"
      invoiceAmount={21.42}
      initialInvoiceStatus="New"
      expiresAt={new Date(Date.now() + 14 * 60_000 + 32_000).toISOString()}
      createdAt={new Date().toISOString()}
      methods={[state === 'partial' ? { ...method, due: method === USDT ? '1.42' : '0.00002068', totalPaid: '20' } : method]}
      previewView={state}
    />
  )
}
