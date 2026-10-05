/**
 * /support help content: the topic cards, the FAQ, and the client-side help
 * search over both. Plain data + pure functions — safe for server and client.
 *
 * COPY RULES
 * - Every FAQ answer is either existing site copy (homepage FAQ) or a
 *   restatement of what the published policies already say (Refund & Dispute
 *   Policy §2, §5, §7, §10, §12; Fees & Charges; Complaints; Prohibited Items;
 *   Trust & Safety). No new obligations, numbers or timings: if a policy
 *   changes, change the answer here to match it.
 * - Outcome framing only: never describe when money moves between buyer,
 *   DropMarket and seller (no-escrow rule), and the product is always
 *   "SafeDrop Protection".
 */

export type HelpTopicId = 'orders' | 'payments' | 'safedrop' | 'disputes' | 'selling' | 'account'

export interface HelpLink {
  label: string
  href: string
}

export interface HelpTopic {
  id: HelpTopicId
  title: string
  summary: string
  links: HelpLink[]
  /** Extra words people search with that aren't in the title/summary. */
  keywords: string[]
}

export interface HelpFaq {
  id: string
  topic: HelpTopicId
  q: string
  a: string
  keywords?: string[]
}

/**
 * Deep links into the Refund & Dispute Policy. Anchors are the ids the legal
 * layout derives from each heading (components/legal/toc.ts). Written out
 * rather than computed so this module stays client-safe — computing them
 * would pull the whole legal pack into the help-search bundle.
 * help-content.test.ts fails if a heading is renamed and an anchor goes stale.
 */
export const REFUNDS_ANCHORS = {
  windows: '/refunds#2-protection-windows-by-category',
  process: '/refunds#5-how-to-request-a-refund-or-raise-a-dispute-the-process',
  evidence: '/refunds#6-evidence-requirements',
  paid: '/refunds#7-how-refunds-are-paid',
  cancellations: '/refunds#12-cancellations-before-delivery',
} as const

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'orders',
    title: 'Orders & Delivery',
    summary: 'Find an order, talk to the seller, and see what happens when delivery runs late.',
    links: [
      { label: 'My Orders', href: '/account/orders' },
      { label: 'Cancellations Before Delivery', href: REFUNDS_ANCHORS.cancellations },
      { label: 'Protection Windows', href: REFUNDS_ANCHORS.windows },
    ],
    keywords: ['order', 'delivery', 'deliver', 'late', 'track', 'cancel', 'arrive', 'chat', 'seller'],
  },
  {
    id: 'payments',
    title: 'Payments & Refunds',
    summary: 'The checkout service fee, store credit, and refunds to your original payment method.',
    links: [
      { label: 'How Refunds Are Paid', href: REFUNDS_ANCHORS.paid },
      { label: 'Fees & Charges', href: '/fees' },
      { label: 'Chargebacks', href: '/chargebacks' },
    ],
    keywords: ['refund', 'money back', 'payment', 'pay', 'fee', 'charge', 'card', 'crypto', 'store credit', 'balance'],
  },
  {
    id: 'safedrop',
    title: 'SafeDrop Protection',
    summary: 'Item Guaranteed or Full Refund — what every order is covered for, and what is not.',
    links: [
      { label: 'How SafeDrop Works', href: '/safedrop' },
      { label: 'SafeDrop Protection Terms', href: '/safedrop-policy' },
      { label: 'Buyer Terms', href: '/buyer-terms' },
    ],
    keywords: ['safe', 'protection', 'guarantee', 'covered', 'scam', 'trust'],
  },
  {
    id: 'disputes',
    title: 'Disputes',
    summary: 'How to raise a dispute, what evidence helps, and how the Resolution Team decides.',
    links: [
      { label: 'Raise a Dispute', href: REFUNDS_ANCHORS.process },
      { label: 'Evidence Requirements', href: REFUNDS_ANCHORS.evidence },
      { label: 'Complaints', href: '/complaints' },
    ],
    keywords: ['dispute', 'problem', 'issue', 'wrong', 'evidence', 'complaint', 'not as described'],
  },
  {
    id: 'selling',
    title: 'Selling on DropMarket',
    summary: 'Seller fees, payouts, and the rules every seller agrees to.',
    links: [
      { label: 'Seller Fees', href: '/sell/fees' },
      { label: 'Seller Agency Agreement', href: '/seller-agreement' },
      { label: 'Prohibited Items', href: '/prohibited' },
    ],
    keywords: ['sell', 'seller', 'list', 'listing', 'commission', 'payout', 'withdraw', 'verification', 'kyc'],
  },
  {
    id: 'account',
    title: 'Account & Security',
    summary: 'Your settings, your privacy, and staying safe while you trade.',
    links: [
      { label: 'Account Settings', href: '/account/settings' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Trust & Safety', href: '/trust-safety' },
    ],
    keywords: ['account', 'password', 'email', 'login', 'sign in', '2fa', 'security', 'privacy', 'data', 'hacked'],
  },
]

export const HELP_FAQ: HelpFaq[] = [
  {
    id: 'is-it-safe',
    topic: 'safedrop',
    q: 'Is it safe to buy on DropMarket?',
    // Homepage FAQ copy (HomeFaq).
    a: 'Yes. Every order is covered by SafeDrop Protection at no extra cost — there is no tier to upgrade to for the basics. If your item does not arrive, or it is not what the listing described, you get your money back in full.',
    keywords: ['scam', 'trust', 'guarantee', 'protection'],
  },
  {
    id: 'late-order',
    topic: 'orders',
    q: 'What if my order is late or never arrives?',
    // Refund & Dispute Policy §12.2.
    a: 'Each listing states the seller’s delivery time. If the seller does not deliver within it — and in any event within 24 hours of the order being accepted — the order is cancelled automatically and you are refunded in full as store credit, service fee included. A refund to your original payment method is available instead on request from the order page.',
    keywords: ['delivery', 'not received', 'missing', 'cancel', 'waiting', 'item'],
  },
  {
    id: 'not-as-described',
    topic: 'disputes',
    q: 'What if the item is not what was described?',
    // Homepage FAQ copy (HomeFaq).
    a: 'Check your order before you confirm it. If it does not match the listing, open a dispute from the order and our team reviews the evidence from both sides. A confirmed mismatch means a full refund.',
    keywords: ['wrong item', 'different', 'broken', 'faulty', 'dispute'],
  },
  {
    id: 'how-disputes-work',
    topic: 'disputes',
    q: 'How do disputes work?',
    // Refund & Dispute Policy §5 (stages 1–5).
    a: 'Start in the order chat — most issues are resolved there. The seller has 12 hours to respond; if the issue is still unresolved, open a dispute from the order page. Both sides then have 24 hours to submit evidence in the order chat, and our Resolution Team decides. Most disputes are resolved within 3 days.',
    keywords: ['dispute', 'resolution', 'evidence', 'decision'],
  },
  {
    id: 'report-window',
    topic: 'orders',
    q: 'How long do I have to report a problem?',
    // Refund & Dispute Policy §2; Buyer Terms.
    a: 'Every order has a Protection Window after delivery, set by category, in which you confirm delivery or open a dispute — each category’s window is listed in the Refund & Dispute Policy. A dispute can still be opened for 7 days from delivery.',
    keywords: ['protection window', 'deadline', 'time limit', 'confirm'],
  },
  {
    id: 'refund-paid',
    topic: 'payments',
    q: 'How are refunds paid?',
    // Refund & Dispute Policy §7.1–7.2.
    a: 'Approved refunds are credited instantly to your Store Balance as store credit, usable on any purchase with no service fee. You can ask from the order page for the refund to be sent back to the payment method you used instead: we review each request within 24 to 48 hours, and approved refunds usually arrive within 5–10 business days. Refunds you are entitled to under the Consumer Rights Act 2015 are always available in full to your original payment method.',
    keywords: ['refund', 'money back', 'store credit', 'balance', 'card'],
  },
  {
    id: 'cost-to-buy',
    topic: 'payments',
    q: 'What does it cost to buy?',
    // Fees & Charges, "Buyer fee".
    a: 'You pay one service fee at checkout, shown as a single line and always included in the displayed total — the price you see at checkout is the price you pay. Orders paid entirely with store credit carry no service fee. The current terms for each payment method are on the Fees & Charges page.',
    keywords: ['fee', 'service fee', 'price', 'checkout', 'charge'],
  },
  {
    id: 'chargeback',
    topic: 'payments',
    q: 'Should I file a chargeback with my bank?',
    // Refund & Dispute Policy §10.1–10.2.
    a: 'Contact us first. The dispute process is faster, and SafeDrop already protects your purchase. Filing a chargeback on a completed order instead of using the dispute process is treated as a breach of the Terms — this never limits your right to dispute a genuinely unauthorised transaction with your bank.',
    keywords: ['chargeback', 'bank', 'card', 'unauthorised', 'unauthorized', 'fraud'],
  },
  {
    id: 'who-am-i-buying-from',
    topic: 'selling',
    q: 'Who am I buying from?',
    // Homepage FAQ copy (HomeFaq).
    a: 'Real players and verified sellers. Every seller completes identity verification before they can list anything, and their rating and sales history sit on each listing so you can see who you are dealing with.',
    keywords: ['seller', 'verified', 'rating', 'reviews', 'identity'],
  },
  {
    id: 'cost-to-sell',
    topic: 'selling',
    q: 'What does it cost to sell?',
    // Fees & Charges, "Seller commissions"; Seller Fees FAQ.
    a: 'Listing is free. Sellers pay a commission set per category, charged on the item price only when an order completes. The current rates are published on the Seller Fees page, and your exact rate is shown on the listing form before you publish.',
    keywords: ['sell', 'commission', 'listing fee', 'rate', 'seller fees'],
  },
  {
    id: 'stay-safe',
    topic: 'account',
    q: 'How do I keep my account and trades safe?',
    // Trust & Safety; Refund & Dispute Policy §4; Prohibited Items.
    a: 'Keep every trade and message on DropMarket — deals done off-platform are not covered by SafeDrop. If you buy a game account, secure it immediately: change the email and password and enable 2FA.',
    keywords: ['security', 'password', '2fa', 'hacked', 'off-platform', 'discord'],
  },
  {
    id: 'complaint',
    topic: 'disputes',
    q: 'How do I make a complaint?',
    // Complaints Handling / Dispute Resolution.
    a: 'Email support@dropmarket.gg. If a consumer complaint remains unresolved after our internal process, we will tell you the name and website of a certified Alternative Dispute Resolution provider and whether we agree to use it.',
    keywords: ['complaint', 'complain', 'adr', 'escalate'],
  },
]

// ── Search ──────────────────────────────────────────────────────────────────

export type HelpResult =
  | { kind: 'faq'; faq: HelpFaq; score: number }
  | { kind: 'topic'; topic: HelpTopic; score: number }

/** Words that carry no meaning in a help query ("how do i get my …"). */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'can', 'do', 'does', 'for', 'get', 'how', 'i', 'if', 'in', 'is', 'it', 'me',
  'my', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'where', 'why', 'with', 'you', 'your',
])

export function normalizeHelpText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .replace(/'/g, '')
    .trim()
}

/** Light suffix stemming for prefix matching: "arrived" ~ "arrives", "refunds" ~ "refund". */
function stem(word: string): string {
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) return word.slice(0, -suffix.length)
  }
  return word
}

export function tokenizeHelpQuery(query: string): string[] {
  const words = normalizeHelpText(query).split(' ').filter(Boolean)
  const meaningful = words.filter((w) => !STOPWORDS.has(w))
  return (meaningful.length > 0 ? meaningful : words).map(stem)
}

/** Does `token` match a word in `text` (word-prefix), e.g. "refund" ~ "refunds", "deliv" ~ "delivery"? */
function matches(text: string, token: string): boolean {
  return (` ${text}`).includes(` ${token}`)
}

/** Sum of the best field weight per token, and how many tokens matched at all. */
function scoreFields(tokens: string[], fields: Array<[text: string, weight: number]>): { score: number; hits: number } {
  let score = 0
  let hits = 0
  for (const token of tokens) {
    let best = 0
    for (const [text, weight] of fields) if (weight > best && matches(text, token)) best = weight
    if (best > 0) hits += 1
    score += best
  }
  return { score, hits }
}

/**
 * Client-side help search: FAQ entries and topics whose text matches EVERY
 * meaningful word of the query (word-prefix match after light stemming,
 * case/diacritic-blind). When nothing matches every word of a 3+ word query,
 * entries missing just one word are returned instead, so a natural question
 * ("my item never arrived") still lands. Titles and questions outrank
 * keywords, which outrank body text; ties keep FAQ first, then source order.
 */
export function searchHelp(
  query: string,
  { faqs = HELP_FAQ, topics = HELP_TOPICS, limit = 8 }: { faqs?: HelpFaq[]; topics?: HelpTopic[]; limit?: number } = {},
): HelpResult[] {
  const tokens = tokenizeHelpQuery(query)
  if (tokens.length === 0) return []
  const n = normalizeHelpText
  const scored: Array<HelpResult & { hits: number }> = []

  faqs.forEach((faq) => {
    const { score, hits } = scoreFields(tokens, [
      [n(faq.q), 3],
      [n((faq.keywords ?? []).join(' ')), 2],
      [n(faq.a), 1],
    ])
    if (hits > 0) scored.push({ kind: 'faq', faq, score, hits })
  })
  topics.forEach((topic) => {
    const { score, hits } = scoreFields(tokens, [
      [n(topic.title), 3],
      [n(topic.keywords.join(' ')), 2],
      [n(`${topic.summary} ${topic.links.map((l) => l.label).join(' ')}`), 1],
    ])
    if (hits > 0) scored.push({ kind: 'topic', topic, score, hits })
  })

  const full = scored.filter((r) => r.hits === tokens.length)
  const pool =
    full.length > 0 || tokens.length < 3 ? full : scored.filter((r) => r.hits === tokens.length - 1)
  const results: HelpResult[] = pool.map((r) =>
    r.kind === 'faq' ? { kind: 'faq', faq: r.faq, score: r.score } : { kind: 'topic', topic: r.topic, score: r.score },
  )

  // Array.prototype.sort is stable, so equal scores keep FAQ-then-topic source order.
  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}
