import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Shared cache tag + cached readers for SAB price data.
 *
 * Price pages are ISR-cached (revalidate = 3600). Reads that go through the
 * cached helpers here also carry PRICE_CACHE_TAG, so the correct-prices cron can
 * call revalidateTag(PRICE_CACHE_TAG) right after it refreshes sab_price_display
 * — pages then pick up fresh prices on their next request instead of waiting out
 * the hour, and a render that happened to read a stale snapshot self-heals the
 * moment new prices land.
 *
 * The reads use a plain anon client (NO cookies) so they are safe to memoize
 * inside unstable_cache — a cookie-bound server client cannot be cached.
 */
export const PRICE_CACHE_TAG = 'sab-prices'

function anonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
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
 * two reads the values grid needs. Cached + tagged so the whole grid refreshes
 * the instant a crawl republishes, and reads are served from cache in between.
 * Reads hit sab_price_display (indexed table), so even a cache miss is ~5ms.
 */
export const getCachedGridPrices = unstable_cache(
  async (): Promise<{ defaults: DefaultPriceRow[]; mutations: MutationPriceRow[] }> => {
    const supabase = anonClient()
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
  },
  ['sab-grid-prices'],
  { tags: [PRICE_CACHE_TAG], revalidate: 3600 },
)
