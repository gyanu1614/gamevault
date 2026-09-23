/**
 * Seller fee notice (fee engine PR 7, Part 5) — the email version of
 * docs/handoff/fee-pr4-seller-notice.md.
 *
 * Every number in this template is a FACT passed in from the database
 * (fee_rules start date, withdrawal_methods, platform_fee_settings): the
 * file itself carries no fee number, so it can be pinned by fee-copy.guard.
 * Sent through sendTransactionalEmail (Resend, same shell as every other
 * email); the send itself is at-most-once per seller (seller_notice_sends).
 */

import {
  emailShell, emailText, emailBox, emailButton, emailFooterNote, emailOrderSummary, EMAIL_TOKENS,
} from '@/lib/email/shell'
import { escapeHtmlText, sendTransactionalEmail } from '@/lib/email'

export interface FeeNoticeMethod {
  displayName: string
  /** Already rendered, e.g. "3% + $5" — from describeWithdrawalFee. */
  feeText: string
  minWithdrawal: number
}

export interface FeeNoticeFacts {
  /** ISO date the new commission schedule starts (fee_rules PR4 rows). */
  ratesStartAt: string
  /** platform_fee_settings.founding_months, rendered as a phrase ("first year"). */
  foundingPeriodText: string
  foundingDiscountPct: number
  methods: FeeNoticeMethod[]
  minAccountAgeDays: number
  completionHoldHours: number
  disputeWindowDays: number
  payoutFreezeHours: number
  sellFeesUrl: string
  settingsUrl: string
}

const { APP_URL, INK, FOREST_2 } = EMAIL_TOKENS

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const hoursText = (h: number) => (h % 24 === 0 && h >= 24 ? `${h / 24} day${h === 24 ? '' : 's'}` : `${h} hours`)
const money = (n: number) => `$${Number(n).toFixed(2).replace(/\.?0+$/, '')}`

export const FEE_NOTICE_KEY_PREFIX = 'fee-schedule'

/** The notice key: one send per seller per schedule start date. */
export function feeNoticeKey(facts: FeeNoticeFacts): string {
  return `${FEE_NOTICE_KEY_PREFIX}:${facts.ratesStartAt.slice(0, 10)}`
}

export function buildFeeNoticeEmail(name: string, facts: FeeNoticeFacts): { subject: string; html: string } {
  const start = fmtDate(facts.ratesStartAt)
  const subject = `Your seller fees are changing on ${start} — and a new way to get paid`
  const html = emailShell({
    preview: `New commission schedule from ${start}, founding half-price rate, Payoneer payouts, and how withdrawals work now.`,
    icon: 'payout',
    heading: 'Changes to your seller fees',
    body:
      emailText(
        `Hi ${escapeHtmlText(name)} — a heads-up on everything that changes about fees and payouts on DropMarket. ` +
          `Nothing changes on orders you have already sold: the rate on an order is fixed when it is placed.`,
      ) +
      emailBox({
        accent: true,
        title: `New commission schedule from ${start}`,
        html:
          `Commission is set per category, and some game economies carry their own rate. The full schedule — every rate, ` +
          `per-game override and the rank discount ladder — is published live on the ` +
          `<a href="${facts.sellFeesUrl}" style="color:${FOREST_2};font-weight:600;text-decoration:underline;">Seller Fees page</a>, ` +
          `read from the same table checkout uses. Your exact rate is shown on the listing form before you publish and on every order.`,
      }) +
      emailBox({
        title: 'Founding sellers',
        html:
          `Founding sellers pay <strong class="dm-strong" style="color:${INK};">${facts.foundingDiscountPct.toFixed(0).replace(/^50$/, 'half')}` +
          `${facts.foundingDiscountPct === 50 ? '-price' : '% off'}</strong> commission for their ${escapeHtmlText(facts.foundingPeriodText)}, ` +
          `applied automatically to every sale. This replaces the rank discount while it runs.`,
      }) +
      emailText(`<strong class="dm-strong" style="color:${INK};">Getting paid</strong>`) +
      emailOrderSummary(
        facts.methods.map((m) => [`${escapeHtmlText(m.displayName)} fee`, `${escapeHtmlText(m.feeText)} · min ${money(m.minWithdrawal)}`] as [string, string]),
      ) +
      emailText(
        `<ul style="margin:0;padding-left:18px;line-height:1.7;">` +
          `<li>A sale is credited when the buyer confirms receipt and becomes withdrawable <strong style="color:${INK};">${hoursText(facts.completionHoldHours)}</strong> later; ` +
          `an order that completes automatically at the end of its SafeDrop Protection window is withdrawable at once.</li>` +
          `<li>Buyers can open a dispute for <strong style="color:${INK};">${facts.disputeWindowDays} days</strong> after delivery. While a dispute is open, that order's amount is set aside; we handle it on your behalf and release or refund it when it is decided.</li>` +
          `<li>New seller accounts can withdraw <strong style="color:${INK};">${facts.minAccountAgeDays} days</strong> after approval.</li>` +
          `<li>Save where you want to be paid — a crypto wallet or your Payoneer email — in your payout settings. Changing it pauses withdrawals for ${hoursText(facts.payoutFreezeHours)}.</li>` +
          `</ul>`,
      ) +
      emailButton('See the full schedule →', facts.sellFeesUrl) +
      emailFooterNote(
        `Set up your payout details in <a href="${facts.settingsUrl}" style="color:${FOREST_2};font-weight:600;text-decoration:underline;">Settings → Payouts</a>. ` +
          `Questions? Reply to this email — a human reads every one.`,
      ),
  })
  return { subject, html }
}

export async function sendFeeNoticeEmail({ to, name, facts }: { to: string; name: string; facts: FeeNoticeFacts }) {
  const { subject, html } = buildFeeNoticeEmail(name, facts)
  return sendTransactionalEmail({ to, subject, html })
}

export const FEE_NOTICE_APP_URL = APP_URL
