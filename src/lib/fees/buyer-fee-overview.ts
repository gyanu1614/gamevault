import { unstable_cache } from 'next/cache'

import { createAnonClient } from '@/lib/supabase/anon'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { PUBLIC_PAYMENT_PROVIDER_KEYS } from '@/lib/legal/payment-processors'
import { PAYSSION_METHODS } from '@/lib/payments/providers/payssion/methods'
import { BUYER_FEES_TAG } from '@/lib/revalidation/tags'
import { describeMethodFee, getPublicBuyerFees } from './buyer-public-rates'
import { publicMethodNames } from './buyer-fee-groups'

/**
 * Everything /fees shows about the buyer service fee, read live: the
 * marketplace part from platform_fee_settings, and for every public payment
 * method the fee on a sample $20 item from THE quote (buyer_fee_quote_many,
 * the call checkout makes), plus the method's terms in words. Nothing here
 * computes a fee. One cached read under BUYER_FEES_TAG, which the admin
 * buyer-fee and currency-rate writes revalidate; 24 h is the backstop.
 * Server only: the quote is service-role.
 */

export const EXAMPLE_SUBTOTAL_MINOR = 2000

export interface MethodFeeExample {
  method: string
  /** Shared checkout labels carry their country ("Credit / Debit Card (Brazil)"). */
  name: string
  provider: string
  coverage: string | null
  refundable: boolean
  /** The quote for the sample item; null when the method can't take it (over a cap, under a minimum). */
  sample: { marketplaceMinor: number; processingMinor: number; serviceFeeMinor: number; totalMinor: number } | null
  /** describeMethodFee: how the processing part is worked out. */
  terms: string
}

export interface BuyerFeeOverview {
  marketplacePct: number
  marketplaceMinMinor: number
  minOrderMinor: number
  subtotalMinor: number
  methods: MethodFeeExample[]
}

interface SqlQuote {
  ok: boolean
  method: string
  marketplace_minor: number | null
  fee_minor: number | null
  service_fee_minor: number | null
  total_minor: number | null
}

async function loadOverview(): Promise<BuyerFeeOverview> {
  const [rows, settingsRes] = await Promise.all([
    getPublicBuyerFees(),
    createAnonClient()
      .from('platform_fee_settings')
      .select('buyer_marketplace_pct, buyer_marketplace_min_minor, buyer_min_order_total_minor')
      .eq('id', true)
      .maybeSingle(),
  ])
  const s = (settingsRes.data ?? {}) as Record<string, number | string | null>
  // Store credit has its own line on the page ("no service fee"); every
  // other public, switched-on method gets a quote.
  const methods = rows.filter((r) => r.selectable && r.provider !== 'wallet' && PUBLIC_PAYMENT_PROVIDER_KEYS.has(r.provider))

  const { data, error } = await (createServiceRoleClient().rpc as any)('buyer_fee_quote_many', {
    p_methods: methods.map((m) => m.method),
    p_subtotal_minor: String(EXAMPLE_SUBTOTAL_MINOR),
    p_currency: 'USD',
  })
  if (error) throw new Error(`buyer_fee_quote_many: ${error.message}`)
  const quotes = new Map(((data ?? []) as SqlQuote[]).map((q) => [q.method, q]))
  const names = publicMethodNames(methods)
  return {
    marketplacePct: Number(s.buyer_marketplace_pct ?? 2),
    marketplaceMinMinor: Number(s.buyer_marketplace_min_minor ?? 30),
    minOrderMinor: Number(s.buyer_min_order_total_minor ?? 100),
    subtotalMinor: EXAMPLE_SUBTOTAL_MINOR,
    methods: methods
      .map((m): MethodFeeExample => {
        const q = quotes.get(m.method)
        const ok = !!q?.ok && q.service_fee_minor != null && q.total_minor != null
        return {
          method: m.method,
          name: names.get(m.method) ?? m.label,
          provider: m.provider,
          coverage: m.provider === 'payssion' ? (PAYSSION_METHODS[m.method]?.coverage ?? null) : 'Worldwide',
          refundable: m.refundable,
          sample: ok
            ? {
                marketplaceMinor: Number(q!.marketplace_minor ?? 0),
                processingMinor: Number(q!.fee_minor ?? 0),
                serviceFeeMinor: Number(q!.service_fee_minor),
                totalMinor: Number(q!.total_minor),
              }
            : null,
          terms: describeMethodFee(m),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export const getBuyerFeeOverview = unstable_cache(loadOverview, ['buyer-fee-overview'], {
  tags: [BUYER_FEES_TAG],
  revalidate: 86_400,
})
