'use client'

/**
 * Currency name + icon per game, from the admin currency config
 * (category_configs, category_type = 'currency'): `unit_label` ("Robux")
 * and `currency_icon_url` (the logo beside the currency page title), plus
 * how quantities are counted (granularity / bundles).
 * Public config, read with the browser client; only the two fields are
 * selected, not the whole blob.
 */

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface CurrencyMeta {
  name: string | null
  iconUrl: string | null
  /** quantity_granularity: 'unit' | 'thousand' | 'million' (K/M games). */
  granularity: 'unit' | 'thousand' | 'million' | null
  /** Sold in fixed bundles: an order's quantity counts bundles. */
  hasBundles: boolean
}

export function useCurrencyMeta(gameIds: string[]): Record<string, CurrencyMeta> {
  const ids = Array.from(new Set(gameIds.filter(Boolean))).sort()
  const { data } = useQuery({
    queryKey: ['currency-meta', ids],
    enabled: ids.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: rows, error } = await createClient()
        .from('category_configs')
        .select('game_id, name:config->>unit_label, icon:config->>currency_icon_url, granularity:config->>quantity_granularity, bundles:config->bundles')
        .eq('category_type', 'currency')
        .in('game_id', ids)
      if (error) throw error
      const out: Record<string, CurrencyMeta> = {}
      for (const r of (rows ?? []) as Array<{ game_id: string; name: string | null; icon: string | null; granularity: string | null; bundles: unknown }>) {
        const g = r.granularity
        out[r.game_id] = {
          name: r.name || null,
          iconUrl: r.icon || null,
          granularity: g === 'thousand' || g === 'million' || g === 'unit' ? g : null,
          hasBundles: Array.isArray(r.bundles) && r.bundles.length > 0,
        }
      }
      return out
    },
  })
  return data ?? {}
}
