import { createTaggedAnonClient } from '@/lib/supabase/anon'
import { valueListReadTags } from '@/lib/values/revalidation'

/**
 * Shared cache tag + cached readers for SAB price data.
 *
 * The values grid's price reads go through the tagged anon client (the values
 * read rule: src/lib/values/revalidation.ts). Each query response is cached in
 * Next's Data Cache under the SAB list tags — so the publish step
 * (/api/internal/values-revalidate: `price:steal-a-brainrot` on any moved item,
 * `values:steal-a-brainrot` on ?full=1) refreshes the DATA, not only the page
 * shell — plus PRICE_CACHE_TAG for the correct-prices cron.
 *
 * Until 2026-10-05 this was an unstable_cache entry tagged only PRICE_CACHE_TAG,
 * which the values publish step never revalidated: the grid kept its prices for
 * up to the hour window after every publish.
 */
export const PRICE_CACHE_TAG = 'sab-prices'

const SAB_GAME = 'steal-a-brainrot'

function gridPricesClient() {
  return createTaggedAnonClient({
    tags: [PRICE_CACHE_TAG, ...valueListReadTags(SAB_GAME)],
    revalidate: 3600,
  })
}

export interface DefaultPriceRow {
  brainrot_id: string
  market_value_usd: number | null
  market_low_usd: number | null
  market_high_usd: number | null
  cheapest_usd: number | null
  average_usd: number | null
  confidence_label: string | null
  is_trade_ready: boolean | null
  external_sample_size: number | null
}

export interface MutationPriceRow {
  brainrot_id: string
  mutation_slug: string
  cheapest_usd: number | null
  average_usd: number | null
}

/**
 * Every brainrot's default-mutation price + every priced mutation price — the
 * two reads the values grid needs, cached + tagged (see above). Reads hit
 * sab_price_display (indexed table), so even a cache miss is ~5ms.
 */
export async function getCachedGridPrices(): Promise<{
  defaults: DefaultPriceRow[]
  mutations: MutationPriceRow[]
}> {
  const supabase = gridPricesClient()
  const [defaultsResult, mutationsResult] = await Promise.all([
    supabase
      .from('sab_price_display')
      .select(
        'brainrot_id,market_value_usd,market_low_usd,market_high_usd,cheapest_usd,average_usd,confidence_label,is_trade_ready,external_sample_size',
      )
      .eq('mutation_slug', 'default'),
    supabase
      .from('sab_price_display')
      .select('brainrot_id,mutation_slug,cheapest_usd,average_usd')
      .not('cheapest_usd', 'is', null),
  ])
  return {
    defaults: (defaultsResult.data as DefaultPriceRow[] | null) ?? [],
    mutations: (mutationsResult.data as MutationPriceRow[] | null) ?? [],
  }
}
