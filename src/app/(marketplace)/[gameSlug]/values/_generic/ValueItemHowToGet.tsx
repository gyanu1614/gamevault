import type { ValueObtainSource } from '@/lib/values/data'

/**
 * "How To Get" — the seam for a later section (MM2 Step 4+): boxes with their
 * cost and drop odds, events and passes, game passes, crafting, codes, from
 * `values_items.obtain`.
 *
 * Renders nothing today, on purpose. The obtain data is in place, but its
 * `still_obtainable` flag is unreliable (2017 event items read as
 * obtainable), so this needs its own pass before it can make claims. The page
 * already renders this slot where the section will sit (after About, before
 * the price trend) — filling it in is a change to this file only.
 */
export function ValueItemHowToGet(_props: { itemName: string; obtain: ValueObtainSource[] }) {
  return null
}
