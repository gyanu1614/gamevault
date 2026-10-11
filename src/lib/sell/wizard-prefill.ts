import 'server-only'

import {
  fetchListingForDuplicate,
  fetchPublishPolicy,
  fetchSellGamesForCategory,
  type DuplicatePrefill,
  type SellGameOption,
  type SellerPublishPolicy,
} from '@/lib/actions/sell-wizard'
import { getAttributeTemplateFull, type AttributeTemplateFull } from '@/lib/actions/new-schema'
import { fetchCategoryConfig } from '@/lib/actions/admin-category-configs'
import type { CurrencyConfig } from '@/lib/types/category-configs'

/**
 * Everything the sell wizard's Details step needs to open an existing listing
 * (edit) or a copy of one (duplicate), read on the server in two parallel
 * waves: [listing, publish policy] → [game list, attribute template, currency
 * config]. The wizard then mounts straight on the Details step, filled in.
 *
 * It used to mount on step 1 and walk itself to step 3 in the browser, one
 * server action after another (listing → games → template → config, plus the
 * policy), each re-asking Supabase Auth: 6–8 serial round trips before the
 * form showed. Owner-only (fetchListingForDuplicate checks the seller).
 */
export interface WizardPrefill {
  listing: DuplicatePrefill
  /** Every game in the listing's category (the duplicate flow can step back to the game list). */
  games: SellGameOption[]
  game: SellGameOption
  template: AttributeTemplateFull | null
  currencyConfig: CurrencyConfig | null
  policy: SellerPublishPolicy | null
}

type Result<T> = { success: true; data: T } | { success: false; error: string }

export async function loadWizardPrefill(listingId: string): Promise<Result<WizardPrefill>> {
  const [listingRes, policyRes] = await Promise.all([fetchListingForDuplicate(listingId), fetchPublishPolicy()])
  if (!listingRes.success) return { success: false, error: listingRes.error }
  const listing = listingRes.data

  const [gamesRes, templateRes, currencyConfig] = await Promise.all([
    fetchSellGamesForCategory(listing.category_slug),
    getAttributeTemplateFull(listing.game_category_id),
    listing.category_slug === 'currency' ? fetchCategoryConfig(listing.game_id, 'currency') : Promise.resolve(null),
  ])
  if (!gamesRes.success) return { success: false, error: gamesRes.error }
  const game = gamesRes.data.find((g) => g.game_id === listing.game_id)
  if (!game) return { success: false, error: 'This game is no longer available for this category' }

  return {
    success: true,
    data: {
      listing,
      games: gamesRes.data,
      game,
      template: templateRes.success ? templateRes.data : null,
      currencyConfig: (currencyConfig as CurrencyConfig | null) ?? null,
      policy: policyRes.success ? policyRes.data : null,
    },
  }
}
