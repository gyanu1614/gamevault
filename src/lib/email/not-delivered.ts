/**
 * Cancel – Not Delivered: the seller's warning email. The buyer reported an
 * overdue order; the seller has the grace window to reply in the order chat
 * or start delivery, or the order cancels (order_not_delivered_finalize).
 * Same shell as every other email (src/lib/email/shell.ts).
 */
import { emailShell, emailText, emailButton } from '@/lib/email/shell'
import { escapeHtmlText, sendTransactionalEmail } from '@/lib/email'

export function graceSpan(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}` : `${minutes} minutes`
}

export async function sendNotDeliveredSellerEmail(a: {
  to: string
  name: string
  orderNumber: string
  orderUrl: string
  graceMinutes: number
}) {
  const span = graceSpan(a.graceMinutes)
  const subject = `Reply about order #${a.orderNumber} within ${span} or it cancels`
  const html = emailShell({
    preview: `The buyer reported order #${a.orderNumber} as not delivered.`,
    icon: 'notice',
    heading: 'Reply now or the order cancels',
    body: [
      emailText(
        `Hi ${escapeHtmlText(a.name)}, the buyer reported order <strong>#${escapeHtmlText(a.orderNumber)}</strong> as not delivered. ` +
          `Reply to the buyer in the order chat, or start delivery, within <strong>${span}</strong>.`,
      ),
      emailText("If you don't respond by then, the order is cancelled, the buyer is refunded, and it counts against your record."),
      emailButton('Open The Order', a.orderUrl),
    ].join(''),
  })
  return sendTransactionalEmail({ to: a.to, subject, html })
}
