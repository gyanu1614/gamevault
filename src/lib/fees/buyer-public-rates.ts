import { unstable_cache } from 'next/cache'

import { createAnonClient } from '@/lib/supabase/anon'
import type { LegalBlock } from '@/lib/legal/documents'
import { BUYER_FEES_TAG } from '@/lib/revalidation/tags'

/**
 * Public, cookie-free, cached read of the buyer method-fee table (checkout
 * B3 Part 4). /fees renders its per-method processing fees from this — the
 * ONLY page where buyer-fee numbers may appear — and every number comes from
 * payment_method_fees at render time, never from copy. The admin action
 * revalidates BUYER_FEES_TAG after each write; the page's 24 h `revalidate`
 * is the backstop.
 *
 * Nothing here computes a fee: describeMethodFee() restates a row's TERMS
 * (rate, fixed, FX, buffer, floor, minimum, cap); the amount a buyer pays on
 * a given order is buyer_fee_quote's, shown at checkout.
 */

const TWENTY_FOUR_HOURS = 86_400

export interface PublicMethodFee {
  method: string
  label: string
  provider: string
  feeCurrency: string
  providerPct: number
  providerFixedMinor: number
  fxMarkupPct: number
  bufferPct: number
  floorPct: number
  minFeeMinor: number
  maxTotalMinor: number | null
  refundable: boolean
  instantClearing: boolean
  selectable: boolean
}

const pct = (n: number) => `${Number(n).toFixed(3).replace(/\.?0+$/, '')}%`
const money = (minor: number, currency: string) =>
  currency === 'USD' ? `$${(minor / 100).toFixed(2)}` : `${currency} ${(minor / 100).toFixed(2)}`

/** One line of TERMS for a method: "3.75% + 7.5% currency conversion + 1% buffer, at least 5% of the item price, minimum $0.35". */
export function describeMethodFee(r: PublicMethodFee): string {
  const parts: string[] = []
  if (r.providerPct > 0) parts.push(pct(r.providerPct))
  if (r.providerFixedMinor > 0) parts.push(money(r.providerFixedMinor, r.feeCurrency))
  if (r.fxMarkupPct > 0) parts.push(`${pct(r.fxMarkupPct)} currency conversion`)
  if (r.bufferPct > 0) parts.push(`${pct(r.bufferPct)} buffer`)
  const clauses: string[] = [parts.length ? parts.join(' + ') : 'no provider charge']
  clauses.push(`at least ${pct(r.floorPct)} of the item price`)
  if (r.minFeeMinor > 0) clauses.push(`minimum ${money(r.minFeeMinor, r.feeCurrency)}`)
  if (r.maxTotalMinor != null) clauses.push(`orders up to ${money(r.maxTotalMinor, r.feeCurrency)}`)
  return clauses.join(', ')
}

/** The legal-page table block: selectable rows only, in the order given. */
export function buyerFeeTableBlock(rows: PublicMethodFee[]): Extract<LegalBlock, { t: 'table' }> {
  const head = ['Payment method', 'Processing fee', 'Refunds', 'Clears']
  const visible = rows.filter((r) => r.selectable)
  if (visible.length === 0) return { t: 'table', head, rows: [['No payment methods are currently enabled.', '', '', '']] }
  return {
    t: 'table',
    head,
    rows: visible.map((r) => [
      r.label,
      describeMethodFee(r),
      r.refundable ? 'Yes' : 'Store credit only',
      r.instantClearing ? 'Instantly' : 'After the provider settles',
    ]),
  }
}

/** Provider display order: crypto/wallet first, then local rails by label. */
const PROVIDER_ORDER: Record<string, number> = { btcpay: 0, coingate: 0, wallet: 1, payssion: 2, fake: 9 }

async function readBuyerFees(): Promise<PublicMethodFee[]> {
  const { data, error } = await createAnonClient()
    .from('payment_method_fees')
    .select('method, label, provider, fee_currency, provider_pct, provider_fixed_minor, fx_markup_pct, buffer_pct, floor_pct, min_fee_minor, max_total_minor, refundable, instant_clearing, selectable')
  if (error) throw new Error(`payment_method_fees: ${error.message}`)
  return ((data ?? []) as any[])
    .filter((r) => r.provider !== 'fake')
    .map((r) => ({
      method: r.method,
      label: r.label,
      provider: r.provider,
      feeCurrency: String(r.fee_currency).trim(),
      providerPct: Number(r.provider_pct),
      providerFixedMinor: Number(r.provider_fixed_minor),
      fxMarkupPct: Number(r.fx_markup_pct),
      bufferPct: Number(r.buffer_pct),
      floorPct: Number(r.floor_pct),
      minFeeMinor: Number(r.min_fee_minor),
      maxTotalMinor: r.max_total_minor == null ? null : Number(r.max_total_minor),
      refundable: !!r.refundable,
      instantClearing: !!r.instant_clearing,
      selectable: !!r.selectable,
    }))
    .sort((a, b) => (PROVIDER_ORDER[a.provider] ?? 5) - (PROVIDER_ORDER[b.provider] ?? 5) || a.label.localeCompare(b.label))
}

export const getPublicBuyerFees = unstable_cache(readBuyerFees, ['public-buyer-fees'], {
  tags: [BUYER_FEES_TAG],
  revalidate: TWENTY_FOUR_HOURS,
})
