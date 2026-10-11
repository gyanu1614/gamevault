/**
 * The buyer's order-complete receipt, as data (no send path in this module,
 * so tests can read the HTML). Sent by sendOrderCompletionEmail.
 *
 * Every receipt carries the same "How did it go?" Trustpilot line — no
 * incentive, no condition. For a qualifying order (lib/trustpilot/invite.ts)
 * the receipt is also BCC'd to Trustpilot's Automatic Feedback address with
 * the structured snippet, so Trustpilot sends its one review invite.
 */
import {
  emailShell,
  emailText,
  emailButton,
  emailDetail,
  emailItemRow,
  emailFooterNote,
  gameLogoUrl,
  EMAIL_TOKENS,
} from './shell'
import { TRUSTPILOT_REVIEW_URL } from '@/lib/trustpilot/links'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export interface OrderCompletionEmailArgs {
  name: string
  orderId: string
  orderNumber: string
  listingTitle: string
  gameSlug?: string | null
  totalPaid: number
  /** True when the protection window expired without buyer confirmation. */
  autoReleased?: boolean
  /** BCC + structured snippet for a qualifying order; null = no invite. */
  trustpilot?: { bcc: string; snippetHtml: string } | null
}

/** The review line every receipt carries. */
export const TRUSTPILOT_RECEIPT_LINE = `How did it go? <a href="${TRUSTPILOT_REVIEW_URL}" style="color:${EMAIL_TOKENS.FOREST_2};font-weight:600;text-decoration:underline;">Review us on Trustpilot</a>.`

export function buildOrderCompletionEmail(a: OrderCompletionEmailArgs): { subject: string; html: string; bcc: string | null } {
  const autoReleased = a.autoReleased ?? false
  const html = emailShell({
    preview: `Your order #${a.orderNumber} is complete.`,
    icon: 'ordered',
    heading: 'Order Complete',
    body:
      emailText(
        autoReleased
          ? `Hi ${esc(a.name)} — your protection window ended with no issues reported, so this order completed automatically.`
          : `Thanks, ${esc(a.name)} — you've confirmed delivery, and your order is all wrapped up.`,
      ) +
      emailDetail('Total paid', `$${a.totalPaid.toFixed(2)}`) +
      emailItemRow({ gameLogoUrl: gameLogoUrl(a.gameSlug), itemName: esc(a.listingTitle), subline: `Order #${a.orderNumber}` }) +
      emailText(
        autoReleased
          ? `This order was covered by SafeDrop for its full protection window — the window has closed and the order is complete.`
          : `This order was covered by SafeDrop from checkout until you confirmed delivery — the order is now complete.`,
      ) +
      emailButton('View Your Order →', `${APP_URL}/account/orders/${a.orderId}`) +
      // Own paragraph with air above: it follows the button's fallback link.
      `<p class="dm-body" style="font-size:15px;line-height:1.6;color:${EMAIL_TOKENS.INK_2};margin:22px 0 0;">${TRUSTPILOT_RECEIPT_LINE}</p>` +
      emailFooterNote(`Questions about this order? Just reply — a real person reads it.`) +
      (a.trustpilot ? a.trustpilot.snippetHtml : ''),
  })
  return { subject: `Order complete — ${a.listingTitle}`, html, bcc: a.trustpilot?.bcc ?? null }
}
