/**
 * "Paid With" for the buyer's order page: the Payssion method's name
 * ("BLIK"), the coin that actually paid a BTCPay invoice ("Bitcoin"),
 * "DropMarket Wallet", or "Bitcoin + Wallet" for a split payment.
 *
 * Server only. The BTCPay coin comes from the invoice's payment methods
 * (the one with a payment on it), cached per invoice and capped at 1.5 s so
 * a slow BTCPay never slows the order page. An invoice an admin marked
 * Settled by hand has no payment on it, so it reads "Crypto".
 */
import 'server-only'

import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { btcpayFetchPaymentMethods } from '@/lib/payments/providers/btcpay'
import { PAYSSION_METHODS } from '@/lib/payments/providers/payssion/methods'

const COINS: Record<string, string> = {
  BTC: 'Bitcoin',
  LTC: 'Litecoin',
  ETH: 'Ethereum',
  XMR: 'Monero',
  DOGE: 'Dogecoin',
  USDT: 'Tether (USDT)',
  USDC: 'USD Coin (USDC)',
  TRX: 'TRON',
  SOL: 'Solana',
  BCH: 'Bitcoin Cash',
}

/** "BTC-CHAIN" → "Bitcoin", "USDT_TRON" → "Tether (USDT) on TRON". */
export function coinLabel(paymentMethodId: string | null | undefined, cryptoCode?: string | null): string | null {
  const id = (paymentMethodId ?? '').toUpperCase()
  const code = (cryptoCode ?? id.split(/[-_]/)[0] ?? '').toUpperCase()
  const name = COINS[code]
  if (!name) return code ? code : null
  if (code === 'USDT' || code === 'USDC') {
    if (/TRON|TRC20/.test(id)) return `${name} on TRON`
    if (/ERC20|ETH/.test(id)) return `${name} on Ethereum`
    if (/BSC|BEP20/.test(id)) return `${name} on BNB Chain`
  }
  return name
}

const paidCoinForInvoice = unstable_cache(
  async (invoiceId: string): Promise<string | null> => {
    const methods = await btcpayFetchPaymentMethods(invoiceId)
    const paid = methods.find((m) => Number(m.totalPaid ?? 0) > 0)
    return paid ? coinLabel(paid.paymentMethodId, paid.cryptoCode) : null
  },
  ['btcpay-paid-coin'],
  // A settled invoice's payments never change; a day keeps the cache small.
  { revalidate: 86_400 },
)

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))])
}

export async function orderPaymentMethodLabel(order: {
  id: string
  payment_provider?: string | null
  buyer_fee_method?: string | null
  wallet_amount_used?: number | string | null
  total_amount?: number | string | null
}): Promise<string | null> {
  const wallet = Number(order.wallet_amount_used ?? 0)
  const total = Number(order.total_amount ?? 0)
  const provider = (order.payment_provider ?? '').toLowerCase()

  if (!provider || provider === 'wallet') {
    return wallet > 0 ? 'DropMarket Wallet' : null
  }
  if (wallet >= total - 0.005 && wallet > 0) return 'DropMarket Wallet'

  let label: string
  if (provider === 'payssion') {
    label = (order.buyer_fee_method && PAYSSION_METHODS[order.buyer_fee_method]?.label) || 'Local Payment'
  } else if (provider === 'btcpay') {
    label = 'Crypto'
    try {
      const { data: attempt } = await (createServiceRoleClient()
        .from('payment_attempts')
        .select('provider_charge_id')
        .eq('order_id', order.id)
        .eq('provider', 'btcpay')
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as any)
      const invoiceId: string | null = attempt?.provider_charge_id ?? null
      if (invoiceId) {
        const coin = await withTimeout(paidCoinForInvoice(invoiceId), 1500).catch(() => null)
        if (coin) label = coin
      }
    } catch {
      // Keep "Crypto": the label must never break the page.
    }
  } else if (provider === 'coingate') {
    label = 'Crypto'
  } else if (provider === 'stripe') {
    label = 'Card'
  } else {
    label = provider.charAt(0).toUpperCase() + provider.slice(1)
  }
  return wallet > 0 ? `${label} + Wallet` : label
}
