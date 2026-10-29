/**
 * Card dispute evidence (owner 2026-10-27: "DropMarket assembles the evidence,
 * the admin submits with one click"). Pure: the admin action loads the order
 * record and hands it in; this builds Stripe's text evidence fields from it.
 * Every field stays under Stripe's 20,000-character limit. The seller's proof
 * photos go separately as one PDF (proof-pdf.ts → uncategorized_file).
 *
 * Delivery proof (2026-10-29): the IP the buyer paid from and every visit
 * they made to the delivered order (order_access_log) — "the customer
 * accessed the product after paying", the evidence banks weigh most for a
 * digital "not received" claim.
 *
 * Privacy: the bank sees the buyer's OWN chat words, with emails, long numbers
 * and anything that looks like login details taken out. Seller messages go as
 * timestamps only — on account sales they carry the login details.
 */

/** One order_access_log row: a device's payment or its visits to the delivered order. */
export interface AccessLogRow {
  event: 'checkout' | 'view'
  firstSeen: string
  lastSeen: string
  hits: number
  ip: string | null
  userAgent: string
}

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
  /** An instant code shown on the order page. */
  instantDeliveredAt: string | null
  deliveryProofFiles: number
  accessLog: AccessLogRow[]
  messages: Array<{ at: string; from: 'Buyer' | 'Seller' | 'DropMarket'; text: string }>
  policyUrl: string
}

/** The Stripe dispute evidence fields we fill (all optional strings). */
export interface DisputeEvidence {
  product_description: string
  customer_email_address?: string
  customer_name?: string
  customer_purchase_ip?: string
  service_date?: string
  access_activity_log: string
  refund_policy_disclosure: string
  uncategorized_text: string
  /** A Stripe file id (the seller's proof photos), set by the admin action. */
  uncategorized_file?: string
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
const times = (n: number) => (n === 1 ? 'once' : `${n} times`)

/** "Safari on iPhone" from a user agent, for a bank reviewer. */
export function deviceLabel(ua: string): string {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'ChromeOS' : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : /Linux/.test(ua) ? 'Linux' : null
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null
  if (browser && os) return `${browser} on ${os}`
  return browser ?? os ?? 'Unknown device'
}

const purchaseIpOf = (log: AccessLogRow[]) =>
  [...log].filter((r) => r.event === 'checkout' && r.ip).sort((a, b) => a.firstSeen.localeCompare(b.firstSeen))[0]?.ip ?? null

function accessLines(log: AccessLogRow[], purchaseIp: string | null): string[] {
  return [...log]
    .sort((a, b) => a.firstSeen.localeCompare(b.firstSeen))
    .map((r) => {
      const device = deviceLabel(r.userAgent)
      if (r.event === 'checkout') return `${stamp(r.firstSeen)} — Payment made${r.ip ? ` from IP ${r.ip}` : ''} (${device})`
      const when = stamp(r.firstSeen) === stamp(r.lastSeen) ? stamp(r.firstSeen) : `${stamp(r.firstSeen)} to ${stamp(r.lastSeen)}`
      const from = r.ip ? ` from IP ${r.ip}${r.ip === purchaseIp ? ', the same IP as the payment' : ''}` : ''
      return `${when} — Buyer opened the delivered order ${times(r.hits)}${from} (${device})`
    })
}

function visitsSentence(log: AccessLogRow[], purchaseIp: string | null): string | null {
  const views = log.filter((r) => r.event === 'view')
  if (!views.length) return null
  const total = views.reduce((n, r) => n + r.hits, 0)
  const first = views.map((r) => r.firstSeen).sort()[0]
  const sameIp = purchaseIp !== null && views.some((r) => r.ip === purchaseIp)
  return `After delivery the buyer opened the order page ${times(total)}, first on ${stamp(first)}${sameIp ? ', including from the IP address they paid from' : ''}.`
}

function timeline(i: DisputeEvidenceInput): string[] {
  const rows: Array<[string, string | null]> = [
    ['Payment received', i.paidAt],
    ['Seller marked the order delivered', i.sellerMarkedDeliveredAt],
    ['Order delivered', i.deliveredAt],
    ['Code delivered instantly on the order page', i.instantDeliveredAt],
    ['Buyer confirmed they received the order', i.buyerConfirmedAt],
    ['Order completed', i.completedAt],
  ]
  return rows.filter((r): r is [string, string] => Boolean(r[1])).map(([label, at]) => `${stamp(at)} — ${label}`)
}

export function buildDisputeEvidence(i: DisputeEvidenceInput): DisputeEvidence {
  const item = i.gameName ? `${i.itemTitle} (${i.gameName})` : i.itemTitle
  const purchaseIp = purchaseIpOf(i.accessLog)
  const events = timeline(i)
  if (i.deliveryProofFiles > 0) events.push(`The seller uploaded ${i.deliveryProofFiles} delivery proof file(s) to the order.`)
  events.push(...accessLines(i.accessLog, purchaseIp))

  const chat = i.messages
    .slice(-MESSAGES_KEPT)
    .map((m) => `[${stamp(m.at)}] ${m.from}: ${m.from === 'Buyer' ? clip(redactChatLine(m.text), MESSAGE_MAX) : '(message sent)'}`)
  const summary = [
    `Order ${i.orderRef} on DropMarket (dropmarket.gg), a marketplace for digital game items.`,
    `The cardholder bought ${item} for ${i.amount}. The item is delivered inside the game or as account details, through the order page and its chat.`,
    i.buyerConfirmedAt
      ? `The buyer confirmed on ${stamp(i.buyerConfirmedAt)} that they received the order.`
      : i.deliveredAt || i.sellerMarkedDeliveredAt || i.instantDeliveredAt
        ? 'The order was marked delivered.'
        : 'The order record is below.',
    visitsSentence(i.accessLog, purchaseIp) ?? '',
    chat.length ? `\nOrder chat (most recent ${chat.length} messages; the buyer's words, the seller's as times only):\n${chat.join('\n')}` : '',
  ].join('\n')

  const deliveredAt = i.deliveredAt ?? i.sellerMarkedDeliveredAt ?? i.instantDeliveredAt
  return {
    product_description: clip(`Digital game item: ${item}. Order ${i.orderRef}, ${i.amount}. Delivered online by the seller; no physical shipping.`, FIELD_MAX),
    ...(i.buyer.email ? { customer_email_address: i.buyer.email } : {}),
    ...(i.buyer.name ? { customer_name: clip(i.buyer.name, 200) } : {}),
    ...(purchaseIp ? { customer_purchase_ip: purchaseIp } : {}),
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
