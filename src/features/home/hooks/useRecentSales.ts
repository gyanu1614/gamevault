import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface SoldItem {
  id: string
  game: string
  item: string
  amount: number
  ago: string
}

// Minimum real sales before the "live · just sold" ticker is worth showing.
// Below this we return [] and the homepage hides the section entirely rather
// than padding it with fabricated activity.
export const MIN_RECENT_SALES = 6

const relativeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.max(1, Math.floor(diff / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function useRecentSales() {
  return useQuery({
    queryKey: ['recent-sales'],
    queryFn: async (): Promise<SoldItem[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, completed_at, created_at, listing:listings!orders_listing_id_fkey(title, game:game_id(name, display_name))')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(20)

      if (error || !data) return []

      const rows = (data as any[])
        .map((o) => {
          const game = o.listing?.game?.display_name || o.listing?.game?.name
          const item = o.listing?.title
          if (!game || !item) return null
          return {
            id: o.id as string,
            game: game as string,
            item: item as string,
            amount: Math.round(Number(o.total_amount ?? 0)),
            ago: relativeAgo(o.completed_at ?? o.created_at),
          }
        })
        .filter((r): r is SoldItem => r !== null)

      // Hide the ticker until there's genuine recent activity.
      return rows.length >= MIN_RECENT_SALES ? rows : []
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}
