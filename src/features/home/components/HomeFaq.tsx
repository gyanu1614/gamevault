/**
 * HomeFaq — the homepage FAQ.
 *
 * Reuses `FaqCards` (the single FAQ accordion used across the marketplace
 * and content hubs) via its `glass` variant, rather than adding a second
 * accordion implementation. Open/close behaviour therefore lives in one
 * place for the whole site.
 *
 * Sets no padding, margin, max-width or background: it opts into the page
 * measure and lets `.page-rhythm` own the spacing around it, per the section
 * authoring contract in CLAUDE.md.
 *
 * COPY RULE (see the no-escrow memory): answers describe the ORDER's state
 * and the guarantee, never when money moves between buyer, us and seller.
 * "Item Guaranteed or Full Refund", never "we hold your money until…".
 */

import Link from 'next/link'

import { FaqCards } from '@/components/marketplace/FaqCards'

const ITEMS = [
  {
    q: 'Is it safe to buy game items on DropMarket?',
    a: 'Yes. Every order is covered by SafeDrop Protection at no extra cost — there is no tier to upgrade to for the basics. If your item does not arrive, or it is not what the listing described, you get your money back in full.',
  },
  {
    q: 'How fast will I get my item?',
    a: 'Most orders are delivered within 20 minutes of buying, and many land in five to ten. Each listing shows that seller\u2019s own delivery time before you pay, so you know what you are committing to at checkout.',
  },
  {
    q: 'What if my item is late or never arrives?',
    a: 'Once the seller\u2019s delivery time passes you can open a dispute straight from your order, and our team steps in. If that delivery time is longer than 12 hours, you can cancel and take a refund instead of waiting.',
  },
  {
    q: 'What if the item is not what was described?',
    a: 'Check your order before you confirm it. If it does not match the listing, open a dispute from the order and our team reviews the evidence from both sides. A confirmed mismatch means a full refund.',
  },
  {
    q: 'Who am I buying from?',
    a: 'Real players and verified sellers. Every seller completes identity verification before they can list anything, and their rating and sales history sit on each listing so you can see who you are dealing with.',
  },
  {
    q: 'What can I buy, and how do I pay?',
    a: 'Four categories: in-game currency, items, accounts and top-ups, across every game we support. Pay by card and local methods through Payssion, or in crypto through CoinGate and BTCPay.',
  },
]

export function HomeFaq() {
  return (
    <section className="page-measure">
      <header className="text-center">
        <h2 className="section-title">
          Frequently Asked{' '}
          <span style={{ color: 'var(--color-accent-text)' }}>Questions</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-[1.5] text-text-secondary">
          Everything you need to know before your first order
        </p>
      </header>

      {/* defaultOpen -1: every card closed on load, so the section reads as a
          compact list rather than one expanded block. */}
      <FaqCards items={ITEMS} defaultOpen={-1} glass className="mt-10" />

      <p className="mt-8 text-center text-[14px] text-text-secondary">
        Want the full terms?{' '}
        <Link
          href="/safedrop"
          className="font-medium underline decoration-[color-mix(in_srgb,var(--color-accent-text)_45%,transparent)] underline-offset-4 transition-colors hover:decoration-[var(--color-accent-text)]"
          style={{ color: 'var(--color-accent-text)' }}
        >
          See exactly what SafeDrop covers
        </Link>
      </p>

      {/* FAQPage JSON-LD. NOTE: Google retired FAQ rich results entirely on
          2026-05-07, so this earns no SERP decoration — it is emitted for
          AI/LLM retrieval only, and must never be allowed to shape the copy.
          Mirrors the rendered Q&As exactly, as schema requires. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: ITEMS.map((i) => ({
              '@type': 'Question',
              name: i.q,
              acceptedAnswer: { '@type': 'Answer', text: i.a },
            })),
          }),
        }}
      />
    </section>
  )
}
