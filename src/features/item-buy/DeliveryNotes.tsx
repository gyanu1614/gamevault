'use client'

import { CollapsibleText } from '@/components/ui/collapsible-text'

/**
 * The picked offer's delivery instructions (owner, 2026-10-28: "a good place
 * to show the Delivery Instructions"), under the picture and spec card. The
 * seller's own words are the listing description, as on the order page, kept
 * line for line; four lines show, then the house expand/collapse chevron
 * eases the rest open. A seller who wrote nothing gets the hand-over every
 * order follows (`fallback`). Another offer's text starts collapsed again.
 * A card on desktop; on phones it sits on the page (owner, 2026-11-02).
 */
export function DeliveryNotes({ text, fallback, resetKey }: { text: string | null; fallback: string; resetKey: string }) {
  const body = text?.trim() || fallback
  return (
    <section
      aria-labelledby="delivery-notes"
      className="lg:rounded-lg lg:bg-[linear-gradient(180deg,#212228_0%,#1A1B1F_100%)] lg:p-5 lg:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
    >
      <h2 id="delivery-notes" className="font-semibold text-text-primary" style={{ fontSize: 'var(--fs-card-title)' }}>
        Delivery Instructions
      </h2>
      <CollapsibleText lines={4} resetKey={resetKey} moreLabel="Show all instructions" lessLabel="Show fewer lines" className="mt-2.5 text-[length:var(--fs-body)] leading-relaxed text-text-secondary">
        {body}
      </CollapsibleText>
    </section>
  )
}
