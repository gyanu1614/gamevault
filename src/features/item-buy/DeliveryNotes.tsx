'use client'

import { CollapsibleText } from '@/components/ui/collapsible-text'

/**
 * The picked offer's delivery instructions (owner, 2026-10-28: "a good place
 * to show the Delivery Instructions"), under the picture and spec card. The
 * seller's own words are the listing description, as on the order page, kept
 * line for line; four lines show (seven on desktop, where the glass panel has
 * room), then the house expand/collapse chevron eases the rest open. A seller
 * who wrote nothing gets the hand-over every order follows (`fallback`). Another
 * offer's text starts collapsed again. Floating on the page, no card (owner,
 * 2026-11-02). The top rule is desktop only: on phones the seller row above
 * already ends in one.
 */
export function DeliveryNotes({ text, fallback, resetKey }: { text: string | null; fallback: string; resetKey: string }) {
  const body = text?.trim() || fallback
  return (
    <section aria-labelledby="delivery-notes" className="pt-6 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
      <h2 id="delivery-notes" className="text-[16px] font-semibold text-text-primary">
        Delivery Instructions
      </h2>
      <CollapsibleText clampClassName="line-clamp-4 lg:line-clamp-[7]" resetKey={resetKey} moreLabel="Show all instructions" lessLabel="Show fewer lines" className="mt-2 text-[14px] leading-relaxed text-text-secondary">
        {body}
      </CollapsibleText>
    </section>
  )
}
