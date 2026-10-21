/**
 * /safedrop copy, in one place. Every number comes from
 * @/lib/legal/protection-windows, the module the SafeDrop Protection Terms
 * render from, so this page, its FAQ markup and the legal pack always state
 * the same thing. Keep strings short and plain (owner: less text, organised).
 */
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/ssr/ArrowCounterClockwise'
import { BuildingsIcon } from '@phosphor-icons/react/dist/ssr/Buildings'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/ssr/CheckCircle'
import { CreditCardIcon } from '@phosphor-icons/react/dist/ssr/CreditCard'
import { PackageIcon } from '@phosphor-icons/react/dist/ssr/Package'
import { SealCheckIcon } from '@phosphor-icons/react/dist/ssr/SealCheck'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import type { Fact, Step } from '@/components/info'
import {
  COMPLETION_HOLD_HOURS,
  DISPUTE_WINDOW_LABEL,
  PROTECTION_WINDOW_HOURS as WIN,
  hoursAsDays,
  protectionWindowSummary,
} from '@/lib/legal/protection-windows'

export const SAFEDROP_LEAD = "Every DropMarket order is covered. If it isn't delivered or isn't as described, you get a full refund."

/**
 * Sellers list first and pass an ID check before their first withdrawal
 * (open seller signup, 2026-10-07), so the fact says payout, never "before
 * they can sell".
 */
export const SAFEDROP_FACTS: Fact[] = [
  { icon: ShieldCheckIcon, tone: 'green', title: 'On Every Order', body: 'Free, with nothing to add at checkout.' },
  { icon: ArrowCounterClockwiseIcon, tone: 'blue', title: 'Full Refund', body: "If it isn't delivered or isn't as described." },
  { icon: SealCheckIcon, tone: 'lime', title: 'ID-Checked Sellers', body: 'Every seller passes an ID check before their first payout.' },
  { icon: BuildingsIcon, title: 'UK Registered Company', body: 'DropMarket Ltd, Company No. 17309867.', href: '/company' },
]

export const HOW_STEPS: Step[] = [
  { icon: CreditCardIcon, title: 'You Pay', body: 'Your order is covered from the moment you check out.' },
  { icon: PackageIcon, title: 'Seller Delivers', body: 'Within the delivery time shown on the listing.' },
  { icon: CheckCircleIcon, title: 'You Confirm', body: 'Check it, then confirm. Something wrong? Open a dispute instead.' },
]

export const COVERED = [
  "Your order isn't delivered.",
  "The item isn't as described: wrong item, wrong amount or a misleading listing.",
  `An account is taken back by its previous owner within ${hoursAsDays(WIN.account)} of delivery.`,
]

export const NOT_COVERED = [
  'Changing your mind after delivery.',
  'A ban by the game publisher after delivery, outside the account window.',
  'Deals or payments made outside DropMarket.',
]

/** FAQ: the visible accordion and the FAQPage markup are built from this one list. */
export const SAFEDROP_FAQ = [
  {
    q: "What happens if the seller doesn't deliver?",
    a: "You get a full refund. Once the seller's delivery time has passed, open a dispute from your order page.",
  },
  {
    q: 'How long do I have to check my order?',
    a: `${protectionWindowSummary()} Raise any issue within the window and you're covered.`,
  },
  {
    q: 'Can I get a refund after confirming delivery?',
    a: `Yes, if something is wrong. For ${DISPUTE_WINDOW_LABEL} from delivery you can still open a dispute from your order, even after you confirm it or it completes automatically. Confirming tells us you received your order as described, so check it carefully first.`,
  },
  {
    q: 'Is there a fee for SafeDrop Protection?',
    a: 'No. SafeDrop Protection is included free on every order. There is nothing to upgrade.',
  },
  {
    q: 'When do sellers get paid?',
    a: `A sale is credited to the seller's balance when the order completes. It can be withdrawn ${COMPLETION_HOLD_HOURS} hours after the buyer confirms, or straight away when the order completes at the end of its protection window. A dispute opened within ${DISPUTE_WINDOW_LABEL} of delivery sets that amount aside until it is decided.`,
  },
]
