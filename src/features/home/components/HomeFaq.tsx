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

import Link from '@/components/navigation/AppLink'

import { FaqCards } from '@/components/marketplace/FaqCards'
import { serializeJsonLd } from '@/lib/seo/jsonld'
import { CANCEL_REQUEST_MIN_DELIVERY_HOURS } from '@/lib/legal/protection-windows'

// Talking tone, the answer first (owner, 2026-10-06; same voice as the game
// hub FAQ). At most six questions.
const ITEMS = [
  {
    q: 'Is DropMarket safe?',
    a: 'Yes, it is safe. Every order comes with SafeDrop Protection for free. If your item never arrives, or it isn\u2019t what the listing said, you get 100% of your money back.',
  },
  {
    q: 'How fast will I get my item?',
    a: 'Most orders arrive within 20 minutes, and many in 5 to 10. You see each seller\u2019s delivery time before you pay, so you know what to expect.',
  },
  {
    q: 'What if my item never arrives?',
    a: `Once the delivery time passes, open a dispute from your order and our team steps in. If the delivery time is ${CANCEL_REQUEST_MIN_DELIVERY_HOURS} hours or longer, you can cancel and get a refund instead of waiting.`,
  },
  {
    q: 'What if it isn\u2019t what the listing said?',
    a: 'Check it before you confirm the order. If it doesn\u2019t match, open a dispute and we look at what both sides send us. If we confirm the mismatch, you get a full refund.',
  },
  {
    q: 'Who am I buying from?',
    a: 'Real players. Every seller verifies their ID before they can list anything, and you can see their rating and past sales on every listing.',
  },
  {
    q: 'What can I buy, and how do I pay?',
    a: 'Game currency, items and accounts for every game we list. Pay with a local payment method or with crypto; you see every option at checkout before you pay.',
  },
]

export function HomeFaq() {
  return (
    <section className="page-measure">
      {/* Title only, no subtitle (owner, 2026-10-06), as on every FAQ. */}
      <h2 className="section-title text-center">Frequently Asked Questions</h2>

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
          __html: serializeJsonLd({
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
