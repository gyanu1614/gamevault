'use client'

import { CollapsibleText } from '@/components/ui/collapsible-text'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'

/**
 * The picked offer's delivery instructions (owner, 2026-10-28: "a good place
 * to show the Delivery Instructions"), under the picture and spec card. The
 * seller's own words are the listing description, as on the order page, kept
 * line for line; four lines show, then the house expand/collapse chevron
 * eases the rest open. A seller who wrote nothing gets the hand-over every
 * order follows (`fallback`). Another offer's text starts collapsed again.
 */
export function DeliveryNotes({ text, fallback, resetKey }: { text: string | null; fallback: string; resetKey: string }) {
  const body = text?.trim() || fallback
  return (
    <section aria-labelledby="delivery-notes" className={cn('rounded-lg p-5', MARKET_CARD)}>
      <h2 id="delivery-notes" className="font-semibold text-text-primary" style={{ fontSize: 'var(--fs-card-title)' }}>
        Delivery Instructions
      </h2>
      <CollapsibleText lines={4} resetKey={resetKey} moreLabel="Show all instructions" lessLabel="Show fewer lines" className="mt-2.5 text-[length:var(--fs-body)] leading-relaxed text-text-secondary">
        {body}
      </CollapsibleText>
    </section>
  )
}
