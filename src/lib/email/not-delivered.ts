/**
 * Cancel – Not Delivered: the seller's warning email. The buyer reported an
 * overdue order; the seller has the response window (the listing's delivery
 * time, 15 min .. 24 h) to reply in the order chat or start delivery. With
 * no response the buyer can ask DropMarket to cancel, and an admin reviews
 * it — nothing cancels automatically. Same shell as every other email
 * (src/lib/email/shell.ts).
 */
import { emailShell, emailText, emailButton } from '@/lib/email/shell'
import { escapeHtmlText, sendTransactionalEmail } from '@/lib/email'
import { windowSpan } from '@/lib/orders/not-delivered'

export async function sendNotDeliveredSellerEmail(a: {
  to: string
  name: string
  orderNumber: string
  orderUrl: string
  windowMinutes: number
}) {
  const span = windowSpan(a.windowMinutes)
  const subject = `Reply about order #${a.orderNumber} within ${span}`
  const html = emailShell({
    preview: `The buyer reported order #${a.orderNumber} as not delivered.`,
    icon: 'notice',
    heading: 'The buyer is waiting for their order',
    body: [
      emailText(
        `Hi ${escapeHtmlText(a.name)}, the buyer reported order <strong>#${escapeHtmlText(a.orderNumber)}</strong> as not delivered. ` +
          `Reply to the buyer in the order chat, or start delivery, within <strong>${span}</strong>.`,
      ),
      emailText("If you don't, the buyer can ask DropMarket to cancel the order, and it counts against your record."),
      emailButton('Open The Order', a.orderUrl),
    ].join(''),
  })
  return sendTransactionalEmail({ to: a.to, subject, html })
}
