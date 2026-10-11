/**
 * Trustpilot review asks — within Trustpilot's rules (growth point 19).
 *
 *  · No incentives: nothing that asks for a review may offer a discount,
 *    credit, Store Balance, cashback, a prize or anything else in return.
 *  · No cherry-picking: every receipt carries the same review line, and the
 *    BCC that triggers Trustpilot's invite depends only on the order's facts
 *    (decideInvite has no input about how the buyer felt).
 *  · Exactly one invite per order: the BCC + snippet ride ONLY on the receipt.
 *
 * Reads source + the pure receipt builder. No DB, no email.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('@/lib/email', () => ({}))

import { buildOrderCompletionEmail } from '@/lib/email/order-completion'
import { trustpilotSnippet } from '@/lib/trustpilot/invite'

const INCENTIVE = /discount|coupon|voucher|promo|credit|store balance|balance|cashback|reward|bonus|free\b|giveaway|prize|win\b|% off|in return/i

/** Every surface that asks a buyer for a Trustpilot review. */
const ASK_SOURCES = [
  'src/components/trust/TrustpilotReviewLine.tsx',
  'src/lib/email/order-completion.ts',
  'src/app/account/settings/_NotificationsTab.tsx',
]

const args = {
  name: 'Sam',
  orderId: '00000000-0000-4000-8000-000000000001',
  orderNumber: 'DM-ABC123',
  listingTitle: 'Shadow Dragon',
  totalPaid: 12.5,
}

describe('trustpilot review asks', () => {
  it.each(ASK_SOURCES)('%s offers nothing in return for a review', (file) => {
    const lines = readFileSync(file, 'utf8').split('\n')
    const asks = lines
      .map((line, i) => ({ line, at: `${file}:${i + 1}` }))
      // copy, not comments: a comment may say "nothing in return"
      .filter(({ line }) => !/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(line))
      .filter(({ line }) => /trustpilot|review us|how did it go/i.test(line))
    expect(asks.length, file).toBeGreaterThan(0)
    for (const { line, at } of asks) expect(line, at).not.toMatch(INCENTIVE)
  })

  it('every receipt carries the same review line, invited or not', () => {
    const plain = buildOrderCompletionEmail(args)
    const invited = buildOrderCompletionEmail({
      ...args,
      trustpilot: { bcc: 'x@invite.trustpilot.com', snippetHtml: trustpilotSnippet({ recipientEmail: 'a@b.co', recipientName: 'Sam', referenceId: 'DM-ABC123' }) },
    })
    for (const e of [plain, invited]) {
      expect(e.html).toContain('How did it go?')
      expect(e.html).toContain('https://www.trustpilot.com/evaluate/dropmarket.gg')
      expect(e.html).not.toMatch(/★|stars?\b|rating/i)
    }
  })

  it('the BCC and snippet appear only on an invited receipt', () => {
    const plain = buildOrderCompletionEmail(args)
    expect(plain.bcc).toBeNull()
    expect(plain.html).not.toContain('application/json+trustpilot')

    const invited = buildOrderCompletionEmail({ ...args, trustpilot: { bcc: 'x@invite.trustpilot.com', snippetHtml: trustpilotSnippet({ recipientEmail: 'a@b.co', recipientName: 'Sam', referenceId: 'DM-ABC123' }) } })
    expect(invited.bcc).toBe('x@invite.trustpilot.com')
    expect(invited.html.match(/application\/json\+trustpilot/g)).toHaveLength(1)
  })

  it('the receipt escapes buyer-controlled text', () => {
    const e = buildOrderCompletionEmail({ ...args, name: '<b>x</b>', listingTitle: '<img src=x>' })
    expect(e.html).not.toContain('<b>x</b>')
    expect(e.html).not.toContain('<img src=x>')
  })

  it('nothing but the receipt seam sends the Trustpilot BCC', () => {
    const email = readFileSync('src/lib/email/index.ts', 'utf8')
    expect(email).not.toMatch(/TRUSTPILOT_BCC_EMAIL/)
    const invite = readFileSync('src/lib/trustpilot/invite.ts', 'utf8')
    expect(invite).toMatch(/TRUSTPILOT_BCC_EMAIL/)
  })
})
