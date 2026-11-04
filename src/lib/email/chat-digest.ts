/**
 * Chat digest email: ONE email for a burst of chat messages.
 *
 * The database batches them (migration 20261102161137_chat_email_digest):
 * the email goes out once the chat has been quiet for 2 minutes and carries
 * whatever the recipient still hasn't read, latest 5 lines, oldest first.
 * Sent by /api/cron/chat-email-digest through sendTransactionalBatch.
 *
 * Pure (no I/O), so the copy and escaping are unit-tested: chat-digest.test.ts.
 */

import { emailShell, emailText, emailBox, emailButton, emailFooterNote, EMAIL_TOKENS } from '@/lib/email/shell'
import { escapeHtmlText } from '@/lib/email'

export interface ChatDigestLine {
  content: string
  has_attachment?: boolean
}

export interface ChatDigestEmailArgs {
  /** Recipient's display name. */
  name: string
  senderName: string
  /** Null for a direct message (no order). */
  orderNumber: string | null
  orderId: string | null
  /** Latest unread lines, oldest first (the DB sends at most 5). */
  lines: ChatDigestLine[]
  /** Every unread line in the chat; can be more than `lines`. */
  unreadCount: number
  appUrl?: string
}

const LINE_MAX = 160

function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > LINE_MAX ? `${flat.slice(0, LINE_MAX - 1)}…` : flat
}

export function chatDigestSubject({ senderName, orderNumber, unreadCount }: Pick<ChatDigestEmailArgs, 'senderName' | 'orderNumber' | 'unreadCount'>): string {
  const what = unreadCount > 1 ? `sent you ${unreadCount} messages` : 'messaged you'
  return orderNumber ? `${senderName} ${what} about order #${orderNumber}` : `${senderName} ${what}`
}

export function buildChatDigestEmail(args: ChatDigestEmailArgs): { subject: string; html: string } {
  const { INK, MUTED } = EMAIL_TOKENS
  const appUrl = args.appUrl ?? EMAIL_TOKENS.APP_URL
  const name = escapeHtmlText(args.name)
  const sender = escapeHtmlText(args.senderName)
  const lines = args.lines.filter((l) => l.content.trim().length > 0)
  const count = Math.max(args.unreadCount, lines.length)
  const about = args.orderNumber
    ? ` about order <strong style="color:${INK};">#${escapeHtmlText(args.orderNumber)}</strong>`
    : ''
  const intro =
    count > 1
      ? `Hi ${name}, <strong style="color:${INK};">${sender}</strong> sent you ${count} new messages${about}:`
      : `Hi ${name}, <strong style="color:${INK};">${sender}</strong> just messaged you${about}:`

  const quoted = lines
    .map(
      (l) =>
        `<p style="margin:0 0 8px 0;overflow-wrap:anywhere;">${escapeHtmlText(clip(l.content))}</p>`,
    )
    .join('')
  const more =
    count > lines.length
      ? `<p style="margin:4px 0 0 0;color:${MUTED};font-size:13px;">+ ${count - lines.length} more in the chat</p>`
      : ''

  const href = args.orderId ? `${appUrl}/account/orders/${args.orderId}` : `${appUrl}/account/messages`
  const last = lines[lines.length - 1]
  const subject = chatDigestSubject({ senderName: args.senderName, orderNumber: args.orderNumber, unreadCount: count })

  const body =
    emailText(intro) +
    (quoted ? emailBox({ html: quoted + more }) : '') +
    emailButton('Reply Now', href) +
    emailFooterNote('We bundle chat messages into one email, so a quick back-and-forth never floods your inbox.')

  return {
    subject,
    html: emailShell({
      // emailShell puts the preview in the HTML as-is: escape it here.
      preview: escapeHtmlText(last ? `${args.senderName}: ${clip(last.content)}` : subject),
      icon: 'message',
      heading: count > 1 ? 'You have new messages' : 'You have a new message',
      body,
    }),
  }
}
