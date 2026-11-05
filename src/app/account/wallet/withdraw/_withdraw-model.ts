/**
 * The withdrawal page's rules, free of React. The page never works out a fee:
 * those come from withdrawal_quote. This file only decides what to show.
 */
import { CHAIN_LABELS, type PayoutChain } from '@/lib/crypto/address-validation'
import type { PayoutDetails } from '@/lib/actions/payout-details'
import type { WalletOverview } from '@/lib/actions/wallet-ledger'
import type { WithdrawalMethod, WithdrawalQuote } from '@/lib/actions/withdrawals'

const COIN_NAMES: Record<string, string> = { usdt: 'USDT', usdc: 'USDC', btc: 'Bitcoin', eth: 'Ethereum' }

/** The name a seller knows a network by, short enough for a chip. */
const NETWORK_SHORT: Record<string, string> = { tron: 'TRC-20', ethereum: 'ERC-20', polygon: 'Polygon', bitcoin: 'Bitcoin' }

export interface SavedDestination {
  label: string
  value: string
  mono: boolean
}

export interface MethodGroup {
  key: string
  label: string
  /** Coin ticker, for the badge. Null for Payoneer and other fiat rails. */
  coin: string | null
  methodName: string
  /** The methods a seller can pick; one per network. */
  methods: WithdrawalMethod[]
  comingSoon: boolean
  /** The lowest minimum across the group's methods. */
  minWithdrawal: number
  /** The method in this group whose destination is already saved. */
  ready: WithdrawalMethod | null
  readyDestination: SavedDestination | null
}

export function chainLabel(chain: string | null | undefined): string {
  if (!chain) return ''
  return CHAIN_LABELS[chain as PayoutChain] ?? chain
}

export function networkShort(chain: string | null | undefined): string {
  if (!chain) return ''
  return NETWORK_SHORT[chain] ?? chain
}

/** The saved destination for a method, or null when none is saved for it. */
export function savedDestinationFor(
  method: WithdrawalMethod | null,
  details: PayoutDetails | null,
): SavedDestination | null {
  if (!method || !details) return null
  if (method.method_type === 'crypto') {
    const matches =
      !!details.cryptoAddress && details.cryptoChain === (method.chain ?? '') && details.cryptoCoin === (method.coin ?? '')
    if (!matches) return null
    return {
      label: `${(details.cryptoCoin ?? '').toUpperCase()} on ${chainLabel(details.cryptoChain)}`,
      value: details.cryptoAddress!,
      mono: true,
    }
  }
  if (method.method_name === 'payoneer' && details.payoneerEmail) {
    return { label: 'Payoneer Account', value: details.payoneerEmail, mono: false }
  }
  return null
}

/**
 * One row per way of being paid, so USDT is one choice with its networks under
 * it rather than three lookalike cards. Rows with a saved destination come
 * first, rails that are not open yet come last.
 */
export function groupMethods(methods: WithdrawalMethod[], details: PayoutDetails | null): MethodGroup[] {
  const byKey = new Map<string, WithdrawalMethod[]>()
  for (const method of methods) {
    const key = method.method_type === 'crypto' && method.coin ? method.coin.toLowerCase() : method.method_name
    byKey.set(key, [...(byKey.get(key) ?? []), method])
  }

  const groups = Array.from(byKey.entries()).map(([key, all]): MethodGroup => {
    const open = all.filter((m) => !m.coming_soon)
    const shown = open.length > 0 ? open : all
    const ready = open.find((m) => savedDestinationFor(m, details)) ?? null
    const first = shown[0]
    return {
      key,
      label: first.coin ? COIN_NAMES[first.coin.toLowerCase()] ?? first.coin.toUpperCase() : first.display_name,
      coin: first.coin ?? null,
      methodName: first.method_name,
      methods: shown,
      comingSoon: open.length === 0,
      minWithdrawal: Math.min(...shown.map((m) => m.min_withdrawal)),
      ready,
      readyDestination: savedDestinationFor(ready, details),
    }
  })

  const rank = (g: MethodGroup) => (g.comingSoon ? 2 : g.ready ? 0 : 1)
  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => rank(a.group) - rank(b.group) || a.index - b.index)
    .map(({ group }) => group)
}

/** Which network a group opens on: the saved one, else its first. */
export function defaultMethodFor(group: MethodGroup): WithdrawalMethod {
  return group.ready ?? group.methods[0]
}

/** What the Max button fills in. */
export function maxWithdrawable(method: WithdrawalMethod, available: number): number {
  const cap = method.max_withdrawal > 0 ? method.max_withdrawal : Infinity
  return Math.max(0, Math.min(cap, available))
}

export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

const trimNum = (n: number) => Number(n).toFixed(2).replace(/\.?0+$/, '')

/** "3% + $5", "3%, min $5": the quote's terms as words. */
export function feeTerms(quote: WithdrawalQuote): string {
  const parts = [quote.feePct > 0 ? `${trimNum(quote.feePct)}%` : '', quote.feeFixed > 0 ? `$${trimNum(quote.feeFixed)}` : ''].filter(Boolean)
  const base = parts.join(' + ') || 'No Fee'
  return quote.feeMin > 0 ? `${base}, min $${trimNum(quote.feeMin)}` : base
}

/** After our team's review, so never the optimistic minutes in the method row. */
export function payoutTimeLine(method: WithdrawalMethod): string {
  return method.method_type === 'crypto'
    ? 'Processed within 24 to 48 hours after review.'
    : 'Arrives within 1 to 3 business days after review.'
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

/**
 * Why this seller cannot withdraw right now. The gate fails closed, and the
 * database sends its own sentence, so a reason this file does not map still
 * reads correctly.
 */
export function gateMessage(overview: WalletOverview | null): string | null {
  const gate = overview?.gate
  if (gate && !gate.eligible) {
    if (gate.reason === 'not_a_seller') {
      return 'Store credit is spent at checkout, with no service fee. To withdraw it instead, contact support@dropmarket.gg.'
    }
    if (gate.reason === 'account_age') {
      return `Withdrawals open ${gate.minAgeDays} days after your seller account is approved, on ${fmtDate(gate.unlockAt)}.`
    }
    if (gate.reason === 'payout_details_freeze') {
      return `You changed your payout details recently. Withdrawals resume ${fmtDateTime(gate.freezeUntil)}.`
    }
    return gate.message || 'Withdrawals are not available on this account yet.'
  }
  if (overview?.negative) {
    return 'Your balance is below zero after a refund. Withdrawals resume once new sales bring it above zero.'
  }
  return null
}

/** Refusals shown elsewhere on the page already: the gate block and the destination step. */
const SHOWN_ELSEWHERE = new Set(['kyc_required', 'not_a_seller', 'account_age', 'payout_details_freeze', 'payout_details_missing'])

/** The quote's refusal to show under the amount, if it is about the amount or the request. */
export function amountRefusal(quote: WithdrawalQuote | null, amount: number): string | null {
  if (!quote || quote.ok || amount <= 0 || !quote.message) return null
  return quote.refusal && SHOWN_ELSEWHERE.has(quote.refusal) ? null : quote.message
}

const OPEN_STATUSES = new Set(['pending', 'approved', 'processing'])

export function isOpenWithdrawal(status: string): boolean {
  return OPEN_STATUSES.has(status)
}
