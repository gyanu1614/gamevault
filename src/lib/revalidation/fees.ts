import { revalidatePath, revalidateTag } from 'next/cache'

import { FEE_RULES_TAG } from './tags'

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
