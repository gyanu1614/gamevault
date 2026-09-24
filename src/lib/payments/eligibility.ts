import 'server-only'

/**
 * eligibleMethods — the ONE source of "which payment methods can this order
 * be paid with, and what does each cost the buyer" (checkout B3 Part 3;
 * audit pass-6 PART C §6).
 *
 * Used by BOTH the checkout page (to render the tiles + summary) and
 * createCheckout (to refuse any method the page would not have shown), so
 * the two can never disagree:
 *
 *   candidates  = the crypto row for the env-active provider
 *               + every Payssion selector method in the registry (methods.ts)
 *               + 'wallet' when a buyer is signed in (store credit covers all)
 *   eligible    = candidates whose payment_method_fees row is selectable,
 *                 accepts the order currency and quotes under its provider cap
 *   quote       = buyer_fee_quote_many(...) — ONE round trip, service role;
 *                 no TypeScript computes a fee (the SQL is the formula).
 *
 * `country` never hides a method: it only marks countryMatch so the page can
 * pin the buyer's local rails first (a Filipino buyer travelling abroad still
 * picks GCash from the country selector). Hidden rows (selectable=false),
 * unsupported currencies and cap breaches are returned in `refused` with the
 * SQL reason, so a refusal message can name the cause.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import { activePaymentProviderName } from '@/lib/payments/registry'
import { payssionSelectorMethods } from '@/lib/payments/providers/payssion/methods'

export type MethodKind = 'crypto' | 'local' | 'wallet'

export interface MethodQuote {
  /** Buyer processing fee, minor units of the order currency. */
  feeMinor: number
  /** subtotal + fee, minor units (before the marketplace fee / promo / wallet). */
  totalMinor: number
  /** fee ÷ subtotal × 100, 2 dp; null on a zero subtotal. */
  pctEffective: number | null
}

export interface EligibleMethod {
  /** payment_method_fees.method — the key the order snapshot records. */
  method: string
  provider: string
  /** Payssion pm_id for local rails; null for crypto / wallet. */
  pmId: string | null
  kind: MethodKind
  label: string
  /** ISO-3166 alpha-2 codes the rail is local to ([] = everywhere). */
  countries: string[]
  /** Region copy for the tile chip (registry `coverage`). */
  coverage: string
  /** true when `country` is one of `countries` (or the method is global). */
  countryMatch: boolean
  refundable: boolean
  instantClearing: boolean
  quote: MethodQuote
}

export interface RefusedMethod {
  method: string
  kind: MethodKind
  label: string
  reason: string
}

export interface EligibilityInput {
  buyerId: string | null
  /** Order currency (the ledger base, USD). */
  currency: string
  /** Buyer country hint (geo header); null = unknown → everything matches. */
  country: string | null
  subtotalMinor: bigint
}

export interface Eligibility {
  methods: EligibleMethod[]
  refused: RefusedMethod[]
}

/** What the client needs to render a tile — no provider internals. */
export type ClientMethod = Pick<
  EligibleMethod,
  'method' | 'pmId' | 'kind' | 'label' | 'countries' | 'coverage' | 'countryMatch' | 'refundable' | 'instantClearing' | 'quote'
>

type Candidate = { method: string; provider: string; pmId: string | null; kind: MethodKind; label: string; countries: string[]; coverage: string }
type SqlQuote = {
  ok: boolean
  reason: string | null
  method: string
  label?: string
  provider?: string
  fee_minor: number | string | null
  total_minor: number | string | null
  pct_effective: number | string | null
  refundable: boolean | null
  instant_clearing: boolean | null
}

const REFUSAL_COPY: Record<string, (label: string) => string> = {
  not_selectable: (l) => `${l} isn’t available for this order right now — please pick another payment method.`,
  no_fee_row: (l) => `${l} isn’t available for this order right now — please pick another payment method.`,
  currency_unsupported: (l) => `${l} can’t be used for an order in this currency — please pick another payment method.`,
  fx_rate_missing: (l) => `${l} isn’t available for this order right now — please pick another payment method.`,
  over_cap: (l) => `This order is over the payment limit for ${l} — please pick another payment method.`,
}

/** Buyer-facing message for a refusal reason returned by buyer_fee_quote. */
export function buyerFeeRefusalMessage(reason: string | null | undefined, label = 'That payment method'): string {
  const f = reason ? REFUSAL_COPY[reason] : undefined
  return f ? f(label) : `${label} isn’t available for this order right now — please pick another payment method.`
}

function candidates(buyerId: string | null): Candidate[] {
  const crypto = activePaymentProviderName()
  const out: Candidate[] = [
    { method: crypto, provider: crypto, pmId: null, kind: 'crypto', label: 'Crypto', countries: [], coverage: 'Worldwide' },
    ...payssionSelectorMethods().map((m) => ({
      method: m.pmId, provider: 'payssion', pmId: m.pmId, kind: 'local' as const, label: m.label, countries: m.countries, coverage: m.coverage,
    })),
  ]
  if (buyerId) out.push({ method: 'wallet', provider: 'wallet', pmId: null, kind: 'wallet', label: 'Store credit', countries: [], coverage: '' })
  return out
}

export async function eligibleMethods(input: EligibilityInput): Promise<Eligibility> {
  const cands = candidates(input.buyerId)
  const cc = (input.country ?? '').trim().toUpperCase()
  const countryKnown = /^[A-Z]{2}$/.test(cc)
  const currency = input.currency.toUpperCase()

  const { data, error } = await (createServiceRoleClient().rpc as any)('buyer_fee_quote_many', {
    p_methods: cands.map((c) => c.method),
    p_subtotal_minor: input.subtotalMinor.toString(),
    p_currency: currency,
  })
  if (error) throw new Error(`buyer_fee_quote_many failed: ${error.message}`)
  const quotes = (data ?? []) as SqlQuote[]
  if (quotes.length !== cands.length) throw new Error(`buyer_fee_quote_many returned ${quotes.length} rows for ${cands.length} methods`)

  const methods: EligibleMethod[] = []
  const refused: RefusedMethod[] = []
  cands.forEach((c, i) => {
    const q = quotes[i]
    if (!q || q.method !== c.method) throw new Error(`buyer_fee_quote_many: row ${i} is ${q?.method}, expected ${c.method}`)
    if (!q.ok || q.fee_minor == null || q.total_minor == null) {
      refused.push({ method: c.method, kind: c.kind, label: c.label, reason: q?.reason ?? 'no_fee_row' })
      return
    }
    methods.push({
      method: c.method,
      provider: c.provider,
      pmId: c.pmId,
      kind: c.kind,
      label: c.label,
      countries: c.countries,
      coverage: c.coverage,
      countryMatch: c.countries.length === 0 || !countryKnown || c.countries.includes(cc),
      refundable: q.refundable ?? true,
      instantClearing: q.instant_clearing ?? true,
      quote: {
        feeMinor: Number(q.fee_minor),
        totalMinor: Number(q.total_minor),
        pctEffective: q.pct_effective == null ? null : Number(q.pct_effective),
      },
    })
  })
  return { methods, refused }
}

/** Strip provider internals before handing methods to a client component. */
export function toClientMethods(methods: EligibleMethod[]): ClientMethod[] {
  return methods.map(({ method, pmId, kind, label, countries, coverage, countryMatch, refundable, instantClearing, quote }) => ({
    method, pmId, kind, label, countries, coverage, countryMatch, refundable, instantClearing, quote,
  }))
}
