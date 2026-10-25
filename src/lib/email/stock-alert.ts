/**
 * Notify Me: the in-stock email. Sent once per alert when the first live
 * listing of the item appears (src/lib/stock-alerts/dispatch.ts). Same shell as
 * every other email (src/lib/email/shell.ts).
 */
import { emailButton, emailItemRow, emailShell, emailText } from '@/lib/email/shell'
import { escapeHtmlText, sendTransactionalEmail } from '@/lib/email'

export interface StockAlertEmail {
  to: string
  name: string | null
  itemName: string
  gameName: string
  /** The item page (its offers, best first). */
  url: string
  /** Item picture for the thumbnail row, else the game logo. */
  imageUrl: string | null
}

export function stockAlertSubject(itemName: string): string {
  return `${itemName} is on DropMarket now`
}

export function stockAlertHtml(a: Omit<StockAlertEmail, 'to'>): string {
  const item = escapeHtmlText(a.itemName)
  const game = escapeHtmlText(a.gameName)
  return emailShell({
    // The shell inserts preview, heading and button label as HTML: escape every value.
    preview: `${item} is listed on DropMarket. Your alert is done.`,
    icon: 'listinglive',
    heading: `${item} Is Listed`,
    body: [
      emailText(`${a.name ? `Hi ${escapeHtmlText(a.name)}, ` : ''}you asked us to tell you when <strong>${item}</strong> for ${game} was for sale. It is listed now.`),
      a.imageUrl ? emailItemRow({ gameLogoUrl: a.imageUrl, itemName: item, subline: game }) : '',
      emailButton(`Buy ${item}`, a.url),
      emailText('This was a one-time alert. Set a new one on DropMarket to hear about the next listing.'),
    ].join(''),
  })
}

export async function sendStockAlertEmail(a: StockAlertEmail) {
  const { to, ...rest } = a
  return sendTransactionalEmail({ to, subject: stockAlertSubject(a.itemName), html: stockAlertHtml(rest) })
}
