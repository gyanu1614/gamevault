/**
 * Card dispute evidence (owner 2026-10-27: "DropMarket assembles the evidence,
 * the admin submits with one click"). Pure: the admin action loads the order
 * record and hands it in; this builds Stripe's text evidence fields from it.
 *
 * Text only — no file uploads, so the restricted key needs Disputes: Write
 * and nothing more. Every field stays under Stripe's 20,000-character limit.
 *
 * Privacy: the bank sees the buyer's OWN chat words, with emails, long numbers
 * and anything that looks like login details taken out. Seller messages go as
 * timestamps only — on account sales they carry the login details.
 */

export interface DisputeEvidenceInput {
  orderRef: string
  itemTitle: string
  gameName: string | null
  amount: string
  buyer: { email: string | null; name: string | null }
  paidAt: string | null
  sellerMarkedDeliveredAt: string | null
  deliveredAt: string | null
  buyerConfirmedAt: string | null
  completedAt: string | null
  deliveryProofFiles: number
  messages: Array<{ at: string; from: 'Buyer' | 'Seller' | 'DropMarket'; text: string }>
  policyUrl: string
}

/** The Stripe dispute evidence fields we fill (all optional strings). */
export interface DisputeEvidence {
  product_description: string
  customer_email_address?: string
  customer_name?: string
  service_date?: string
  access_activity_log: string
  refund_policy_disclosure: string
  uncategorized_text: string
}

const FIELD_MAX = 19_000
const MESSAGE_MAX = 600
const MESSAGES_KEPT = 60

const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`)

// Any mention of login details drops the whole line; a bare "code" or "user"
// only when it introduces a value (code: …), since those words are common.
const SECRET_HINT = /\b(pass(word|code|wd)?|pwd|pw|2fa|otp|login|log ?in|e-?mail|recovery|security question)\b|\b(code|pin|user ?name|user)\b\s*(is\s*)?[:=-]/i
/** A buyer chat line as the bank may see it. */
export function redactChatLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (SECRET_HINT.test(flat)) return '(account details, not included)'
  return flat.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]').replace(/\+?\d[\d\s().-]{6,}\d/g, '[number]')
}
const stamp = (iso: string) => `${iso.slice(0, 16).replace('T', ' ')} UTC`

function timeline(i: DisputeEvidenceInput): string[] {
  const rows: Array<[string, string | null]> = [
    ['Payment received', i.paidAt],
    ['Seller marked the order delivered', i.sellerMarkedDeliveredAt],
    ['Order delivered', i.deliveredAt],
    ['Buyer confirmed they received the order', i.buyerConfirmedAt],
    ['Order completed', i.completedAt],
  ]
  return rows.filter((r): r is [string, string] => Boolean(r[1])).map(([label, at]) => `${stamp(at)} — ${label}`)
}

export function buildDisputeEvidence(i: DisputeEvidenceInput): DisputeEvidence {
  const item = i.gameName ? `${i.itemTitle} (${i.gameName})` : i.itemTitle
  const events = timeline(i)
  if (i.deliveryProofFiles > 0) events.push(`The seller uploaded ${i.deliveryProofFiles} delivery proof file(s) to the order.`)

  const chat = i.messages
    .slice(-MESSAGES_KEPT)
    .map((m) => `[${stamp(m.at)}] ${m.from}: ${m.from === 'Buyer' ? clip(redactChatLine(m.text), MESSAGE_MAX) : '(message sent)'}`)
  const summary = [
    `Order ${i.orderRef} on DropMarket (dropmarket.gg), a marketplace for digital game items.`,
    `The cardholder bought ${item} for ${i.amount}. The item is delivered inside the game or as account details, through the order page and its chat.`,
    i.buyerConfirmedAt
      ? `The buyer confirmed on ${stamp(i.buyerConfirmedAt)} that they received the order.`
      : i.deliveredAt || i.sellerMarkedDeliveredAt
        ? 'The order was marked delivered; the buyer did not report a problem through our order dispute process.'
        : 'The order record is below.',
    chat.length ? `\nOrder chat (most recent ${chat.length} messages; the buyer's words, the seller's as times only):\n${chat.join('\n')}` : '',
  ].join('\n')

  const deliveredAt = i.deliveredAt ?? i.sellerMarkedDeliveredAt
  return {
    product_description: clip(`Digital game item: ${item}. Order ${i.orderRef}, ${i.amount}. Delivered online by the seller; no physical shipping.`, FIELD_MAX),
    ...(i.buyer.email ? { customer_email_address: i.buyer.email } : {}),
    ...(i.buyer.name ? { customer_name: clip(i.buyer.name, 200) } : {}),
    ...(deliveredAt ? { service_date: deliveredAt.slice(0, 10) } : {}),
    access_activity_log: clip(events.join('\n') || 'No delivery recorded.', FIELD_MAX),
    refund_policy_disclosure: clip(
      `Every order is covered by SafeDrop Protection: a buyer who does not receive their item gets a full refund through the order page. ` +
        `The buyer accepted these terms at checkout. Refund & Dispute Policy: ${i.policyUrl}`,
      FIELD_MAX
    ),
    uncategorized_text: clip(summary, FIELD_MAX),
  }
}
