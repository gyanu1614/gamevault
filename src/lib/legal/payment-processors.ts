/**
 * The payment providers DropMarket actually uses: the ONE list the legal pack
 * (Fees & Charges, Privacy Policy, AML / KYC, Chargeback & Payment Policy) and
 * the homepage FAQ name. Mirrors src/lib/payments/registry.ts: Stripe for
 * cards (hosted Checkout, live 2026-10-28), Payssion for local methods (pm_ids
 * in providers/payssion/methods.ts), BTCPay (self-hosted, PAYMENT_PROVIDER=btcpay)
 * for crypto, and the Payoneer payout method.
 *
 * Only providers that are live go here. A provider that is planned, in review
 * or retired (CoinGate, Tazapay, Glocash) is never named in public copy.
 */

export interface PaymentProviderEntry {
  /** payment_method_fees.provider / registry key. */
  key: string
  name: string
  /** What it does for DropMarket, in plain English. */
  role: string
}

/** Providers that take Buyers' payments. */
export const PAYMENT_PROCESSORS: readonly PaymentProviderEntry[] = [
  {
    key: 'stripe',
    name: 'Stripe',
    role: 'processes card payments (debit and credit cards, and Apple Pay or Google Pay where your device offers them) on Stripe’s own secure payment page',
  },
  {
    key: 'payssion',
    name: 'Payssion',
    role: 'processes payments made with local payment methods (bank transfers, e-wallets, QR payments, local cards and vouchers) in the countries where they are offered',
  },
  {
    key: 'btcpay',
    name: 'BTCPay Server',
    role: 'open-source payment software that DropMarket hosts itself, used to receive crypto payments; no third-party processor handles these payments',
  },
] as const

/** Providers that carry Seller payouts. */
export const PAYOUT_PROVIDERS: readonly PaymentProviderEntry[] = [
  { key: 'payoneer', name: 'Payoneer', role: 'carries Seller payouts to a Payoneer account' },
] as const

/**
 * payment_method_fees.provider values the public /fees table may show: the
 * live processors plus store credit ('wallet'). A row for any other provider
 * (a retired one such as 'coingate') is never published, even if its DB row
 * is still selectable.
 */
export const PUBLIC_PAYMENT_PROVIDER_KEYS: ReadonlySet<string> = new Set([...PAYMENT_PROCESSORS.map((p) => p.key), 'wallet'])

/** "A", "A and B", "A, B and C" */
const listJoin = (names: readonly string[]): string =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/** "Stripe, Payssion and BTCPay Server" */
export const PAYMENT_PROCESSOR_NAMES = listJoin(PAYMENT_PROCESSORS.map((p) => p.name))

/** "our payment processors (currently: Stripe, Payssion and BTCPay Server)" */
export const PAYMENT_PROCESSORS_PHRASE = `our payment processors (currently: ${PAYMENT_PROCESSOR_NAMES})`
