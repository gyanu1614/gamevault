'use client'

/**
 * Currency name + icon per game, from the admin currency config
 * (category_configs, category_type = 'currency'): `unit_label` ("Robux")
 * and `currency_icon_url` (the logo beside the currency page title).
 * Public config, read with the browser client; only the two fields are
 * selected, not the whole blob.
 */

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface CurrencyMeta {
  name: string | null
  iconUrl: string | null
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
        .select('game_id, name:config->>unit_label, icon:config->>currency_icon_url')
        .eq('category_type', 'currency')
        .in('game_id', ids)
      if (error) throw error
      const out: Record<string, CurrencyMeta> = {}
      for (const r of (rows ?? []) as Array<{ game_id: string; name: string | null; icon: string | null }>) {
        out[r.game_id] = { name: r.name || null, iconUrl: r.icon || null }
      }
      return out
    },
  })
  return data ?? {}
}
