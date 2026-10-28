import { CreditCardIcon } from '@phosphor-icons/react/dist/ssr/CreditCard'
import { EyeIcon } from '@phosphor-icons/react/dist/ssr/Eye'
import { PercentIcon } from '@phosphor-icons/react/dist/ssr/Percent'
import { WalletIcon } from '@phosphor-icons/react/dist/ssr/Wallet'
import type { Fact } from '@/components/info'
import type { BuyerFeeOverview } from '@/lib/fees/buyer-fee-overview'

/** $1.53 from 153 minor units. */
export const money = (minor: number) => `$${(minor / 100).toFixed(2)}`
/** $20 from 2000; cents only when there are any. */
export const moneyShort = (minor: number) => (minor % 100 === 0 ? `$${minor / 100}` : money(minor))
const pct = (n: number) => `${Number(n.toFixed(2))}%`

/** The four facts under the hero, every number read live. */
export function feeFacts(o: BuyerFeeOverview): Fact[] {
  return [
    {
      icon: PercentIcon,
      tone: 'green',
      title: `${pct(o.marketplacePct)} Marketplace Fee`,
      body: `On the item price, at least ${money(o.marketplaceMinMinor)}. It keeps every order covered by SafeDrop.`,
    },
    { icon: CreditCardIcon, tone: 'blue', title: 'Processing by Method', body: 'Covers what the payment provider charges for the method you pick.' },
    { icon: WalletIcon, tone: 'lime', title: 'Store Credit Is Free', body: 'An order paid fully with store credit has no service fee.' },
    { icon: EyeIcon, tone: 'neutral', title: 'Exact Total First', body: 'Checkout shows the fee as one line before you pay.' },
  ]
}

/** FAQ shown on the page and as FAQPage JSON-LD (same list). */
export function feesFaq(o: BuyerFeeOverview): { q: string; a: string }[] {
  return [
    {
      q: 'Why does the service fee change with the payment method?',
      a: `The marketplace part is the same on every order: ${pct(o.marketplacePct)} of the item price, at least ${money(o.marketplaceMinMinor)}. The processing part covers what the payment provider charges for the method you pick, so it differs between methods. Checkout shows the full service fee for each method before you choose one.`,
    },
    {
      q: 'Is the service fee refunded?',
      a: 'A refund goes to your store credit for the item price straight away. If your payment method supports refunds, you can ask for the full amount you paid, service fee included, to go back to it instead.',
    },
    {
      q: 'Do I pay extra for currency conversion?',
      a: 'Prices are in US dollars. Where a payment provider charges for converting your currency, that cost is part of the processing fee shown at checkout, so nothing is added later.',
    },
    {
      q: 'Is there a fee when I pay with store credit?',
      a: 'No. An order paid entirely with store credit has no service fee.',
    },
    {
      q: 'What is the smallest order?',
      a: `An order whose total would be under ${money(o.minOrderMinor)} is raised to ${money(o.minOrderMinor)}. Checkout shows this before you pay.`,
    },
    {
      q: 'What do sellers pay?',
      a: 'Sellers pay a commission on the item price, set by category, only when an order completes. There is no listing fee. Every rate is on the Seller Fees page.',
    },
  ]
}
