import type { LegalBlock } from '@/lib/legal/documents'
import { hoursAsDays } from '@/lib/legal/protection-windows'
import type { PublicWithdrawalTerms } from './public-rates'

/**
 * The /fees "Withdrawals" numbers, built at render time from the same read
 * /sell/fees uses (getPublicWithdrawalTerms: withdrawal_methods +
 * platform_fee_settings). The legal document carries the rules in words
 * only, so an admin change to a fee, minimum or hold can't leave /fees
 * quoting an old number.
 */

const usd = (n: number) => `$${Number(n.toFixed(2))}`
const pct = (n: number) => `${Number(n.toFixed(3))}%`

function feeText(m: PublicWithdrawalTerms['methods'][number]): string {
  let s = pct(m.feePct)
  if (m.feeFixed > 0) s += ` + ${usd(m.feeFixed)}`
  if (m.feeMin > 0) s += `, at least ${usd(m.feeMin)}`
  return s
}

export function withdrawalTermsBlocks(t: PublicWithdrawalTerms): LegalBlock[] {
  const head = ['Payout method', 'Fee', 'Minimum withdrawal']
  const rows = t.methods.length
    ? t.methods.map((m) => [m.displayName, feeText(m), usd(m.minWithdrawal)])
    : [['No payout methods are currently enabled.', '', '']]
  return [
    { t: 'table', head, rows },
    {
      t: 'ul',
      items: [
        `**When a sale becomes withdrawable:** ${t.completionHoldHours} hours after the Buyer confirms receipt, or immediately when the Order completes automatically at the end of its SafeDrop Protection window.`,
        `**New sellers:** withdrawals open ${t.minAccountAgeDays} days after your seller account is approved.`,
        `**Payout details:** changing your payout address or Payoneer email pauses withdrawals for ${hoursAsDays(t.payoutFreezeHours)}. One withdrawal may be in progress at a time.`,
      ],
    },
  ]
}
