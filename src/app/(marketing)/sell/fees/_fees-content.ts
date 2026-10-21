/**
 * /sell/fees copy and formatting. Every number is read from the fee resolver
 * and the payout tables (lib/fees/public-rates); these helpers only phrase
 * it. No rate may be typed here (fee-copy.guard pins this file).
 */
import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/ssr/CalendarBlank'
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins'
import { GiftIcon } from '@phosphor-icons/react/dist/ssr/Gift'
import { LightningIcon } from '@phosphor-icons/react/dist/ssr/Lightning'
import { PercentIcon } from '@phosphor-icons/react/dist/ssr/Percent'
import { RocketLaunchIcon } from '@phosphor-icons/react/dist/ssr/RocketLaunch'
import { SwordIcon } from '@phosphor-icons/react/dist/ssr/Sword'
import { TagIcon } from '@phosphor-icons/react/dist/ssr/Tag'
import { UserCircleIcon } from '@phosphor-icons/react/dist/ssr/UserCircle'
import { WalletIcon } from '@phosphor-icons/react/dist/ssr/Wallet'
import type { Fact } from '@/components/info'
import {
  formatScheduleDateUtc,
  type PublicFeeSchedule,
  type PublicWithdrawalMethod,
  type PublicWithdrawalTerms,
} from '@/lib/fees/public-rates'

export const fmtDate = formatScheduleDateUtc
export const pct = (n: number) => `${Number(n).toFixed(2).replace(/\.?0+$/, '')}%`
export const pts = (n: number) => `${Number(n).toFixed(2).replace(/\.?0+$/, '')}`
export const hoursText = (h: number) =>
  h % 24 === 0 && h >= 24 ? `${h / 24} day${h === 24 ? '' : 's'}` : `${h} hour${h === 1 ? '' : 's'}`

/** game_categories.type → its icon (the fee key; unknown types get the tag). */
export const CATEGORY_ICON: Record<string, ComponentType<IconProps>> = {
  currency: CoinsIcon,
  items: SwordIcon,
  top_up: LightningIcon,
  gift_card: GiftIcon,
  service: RocketLaunchIcon,
  account: UserCircleIcon,
}
export const categoryIcon = (type: string) => CATEGORY_ICON[type] ?? TagIcon

/** "USDT (TRC-20)" and "USDT (ERC-20)" are one rail: each payout name once, in table order. */
export function payoutRails(methods: PublicWithdrawalMethod[]): string[] {
  return [...new Set(methods.map((m) => m.displayName.replace(/\s*\(.*\)\s*$/, '').trim()))]
}

function listSentence(names: string[]): string {
  if (names.length <= 1) return `${names[0] ?? ''}.`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}.`
}

/** The four facts under the hero, from the live schedule and payout terms. */
export function feeFacts(s: PublicFeeSchedule, w: PublicWithdrawalTerms): Fact[] {
  const rates = s.categories.map((c) => c.pct).filter((p): p is number => p != null)
  const minRate = rates.length ? Math.min(...rates) : null
  const minWithdraw = w.methods.length ? Math.min(...w.methods.map((m) => m.minWithdrawal)) : null
  return [
    { icon: TagIcon, tone: 'lime', title: 'No Listing Fee', body: 'List as many offers as you like, free.' },
    {
      icon: PercentIcon,
      tone: 'green',
      title: minRate == null ? 'Commission on Sales' : `Commission From ${pct(minRate)}`,
      body: 'On the item price, only when an order completes.',
    },
    {
      icon: WalletIcon,
      tone: 'blue',
      title: minWithdraw == null ? 'Withdraw Your Sales' : `Withdraw From $${minWithdraw.toFixed(0)}`,
      body: listSentence(payoutRails(w.methods)),
    },
    {
      icon: CalendarBlankIcon,
      tone: 'amber',
      title: s.effectiveFrom ? `Rates From ${fmtDate(s.effectiveFrom)}` : 'Current Rates',
      body: s.nextChange
        ? `Next change: ${fmtDate(s.nextChange)}.`
        : `${s.noticeDays} days' notice before any standard rate changes.`,
    },
  ]
}

/** FAQ: the visible accordion and the FAQPage markup are built from this one list. */
export function sellFeesFaq(s: PublicFeeSchedule, w: PublicWithdrawalTerms) {
  return [
    {
      q: 'Is there a listing fee?',
      a: 'No. Listing is free and stays free. Commission is charged only on the item price when an order completes, never on the buyer fee.',
    },
    {
      q: 'Why does my own rate differ from this page?',
      a: 'This page shows the headline rate before any seller adjustment. Your rank discount or the founding programme applies on top. Your exact rate shows on the listing form before you publish, and on every order.',
    },
    {
      q: 'How much notice do I get before a rate changes?',
      a: `Standard rates change only on a dated schedule, with ${s.noticeDays} days' notice. Scheduled changes are listed on this page in advance. Promotional rates can start at once but always have an end date.`,
    },
    {
      q: 'Can a rate go up after I sell?',
      a: 'No. The rate is fixed when the order is placed and recorded on it. A later change never touches a past order.',
    },
    {
      q: 'When can I withdraw a sale?',
      a: `When the buyer confirms, the sale becomes withdrawable ${hoursText(w.completionHoldHours)} later. If the buyer does nothing, the order completes when its SafeDrop Protection window closes and you can withdraw it at once.`,
    },
  ]
}
