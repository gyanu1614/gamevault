import { useQuery } from '@tanstack/react-query'

export interface SoldItem {
  id: string
  game: string
  item: string
  amount: number
  ago: string
}

const MOCK_RECENT_SALES: SoldItem[] = [
  { id: '1', game: 'Valorant',  item: 'Radiant Account',    amount: 540,  ago: '8s ago' },
  { id: '2', game: 'Roblox',    item: '5,000 Robux',        amount: 39,   ago: '21s ago' },
  { id: '3', game: 'CS2',       item: 'Karambit | Fade',    amount: 1180, ago: '44s ago' },
  { id: '4', game: 'Fortnite',  item: 'OG Skull Trooper',   amount: 128,  ago: '1m ago' },
  { id: '5', game: 'Genshin',   item: 'AR58 Whale Acct',    amount: 420,  ago: '2m ago' },
  { id: '6', game: 'League',    item: 'Diamond IV Account', amount: 89,   ago: '3m ago' },
  { id: '7', game: 'Warzone',   item: 'COD Points 5000',    amount: 34,   ago: '4m ago' },
  { id: '8', game: 'Steam',     item: 'Wallet $50 Code',    amount: 46,   ago: '5m ago' },
]

export function useRecentSales() {
  // TODO(supabase): replace mock with real query + WebSocket subscription
  // subscribe to supabase realtime channel 'recent-sales'
  return useQuery({
    queryKey: ['recent-sales'],
    queryFn: async (): Promise<SoldItem[]> => MOCK_RECENT_SALES,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  })
}
