/**
 * Loads what the shared listing validator needs to know about the target
 * (game, category): today only the currency config (price floor / ceiling,
 * minimum order size, bundle list). Read with whatever client the caller
 * has — category_configs is a public read.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CurrencyConfig } from '@/lib/types/category-configs'
import type { ListingRuleContext } from './validate'

type Client = SupabaseClient<any, any, any, any, any>

export async function loadListingRuleContext(
  supabase: Client,
  gameId: string,
  categoryType: string,
): Promise<ListingRuleContext> {
  if (categoryType !== 'currency') return { categoryType, currencyConfig: null }
  const { data } = await supabase
    .from('category_configs')
    .select('config')
    .eq('game_id', gameId)
    .eq('category_type', 'currency')
    .maybeSingle()
  const config = (data as { config?: Partial<CurrencyConfig> | null } | null)?.config ?? null
  return { categoryType, currencyConfig: config }
}
