import { revalidatePath, revalidateTag } from 'next/cache'

import { BUYER_FEES_TAG, FEE_RULES_TAG } from './tags'

/**
 * Every reader of the fee table, invalidated after an admin fee write
 * (docs/design/fee-engine.md §4.2 / §5.5). Exactly these four calls:
 *
 *   · the tag — every unstable_cache'd resolver read (public schedule,
 *     per-game headline rate);
 *   · /sell/fees — the public schedule page;
 *   · /[gameSlug]/sell — the ROUTE PATTERN (a concrete segment inside a
 *     pattern matches nothing and fails silently — CLAUDE.md);
 *   · /admin/games — the admin list the Fees tab sits under.
 *
 * Called only after a successful write + audit row; a failed revalidate
 * must not roll back the write (the 24 h page revalidate covers it).
 */
export function revalidateFeeReaders(): void {
  revalidateTag(FEE_RULES_TAG)
  revalidatePath('/sell/fees')
  revalidatePath('/[gameSlug]/sell', 'page')
  revalidatePath('/admin/games')
}

/**
 * Every reader of the buyer method-fee table (checkout B3), invalidated after
 * an admin write to payment_method_fees / currency_rates:
 *
 *   · the tag — the unstable_cache'd /fees table read;
 *   · /fees — the legal page that renders it;
 *   · /admin/fees — the editor.
 *
 * Checkout pages are dynamic (per order, per buyer) and quote live, so they
 * need no revalidation.
 */
export function revalidateBuyerFeeReaders(): void {
  revalidateTag(BUYER_FEES_TAG)
  revalidatePath('/fees')
  revalidatePath('/admin/fees')
}
