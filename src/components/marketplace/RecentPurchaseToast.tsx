/**
 * Recent Purchase Toast Component
 *
 * Displays real-time purchase notifications for social proof
 * Features:
 * - Subscribes to Supabase Realtime on orders table
 * - Shows toast when new orders are paid
 * - Throttles to max 1 per 30 seconds
 * - Anonymizes buyer location
 * - Auto-dismisses after 5 seconds
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ShoppingCart, Zap } from 'lucide-react'

interface RecentPurchase {
  id: string
  game_name: string
  listing_title: string
  buyer_location?: string
  created_at: string
}

export default function RecentPurchaseToast() {
  const [isEnabled, setIsEnabled] = useState(true)
  const lastToastTime = useRef<number>(0)
  const THROTTLE_MS = 30000 // 30 seconds

  useEffect(() => {
    if (!isEnabled) return

    const supabase = createClient()

    // Subscribe to orders table for new paid orders
    const channel = supabase
      .channel('recent-purchases')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: 'status=eq.paid',
        },
        async (payload) => {
          const now = Date.now()

          // Throttle toasts to max 1 per 30 seconds
          if (now - lastToastTime.current < THROTTLE_MS) {
            return
          }

          // Fetch additional details about the order
          const { data: orderData } = await supabase
            .from('orders')
            .select(`
              id,
              created_at,
              listing:listings (
                title,
                game:games (
                  name
                )
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (!orderData || !orderData.listing) {
            return
          }

          const purchase: RecentPurchase = {
            id: orderData.id,
            game_name: orderData.listing.game?.name || 'Game',
            listing_title: orderData.listing.title || 'Item',
            buyer_location: getRandomLocation(),
            created_at: orderData.created_at,
          }

          showPurchaseToast(purchase)
          lastToastTime.current = now
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isEnabled])

  const showPurchaseToast = (purchase: RecentPurchase) => {
    const timeAgo = 'just now'

    toast.custom(
      (t) => (
        <div className="bg-gradient-to-r from-violet-500/10 to-blue-500/10 backdrop-blur-xl border border-violet-500/20 rounded-xl p-4 shadow-2xl min-w-[320px] max-w-md">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 p-2 bg-violet-500/20 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-violet-400" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-violet-400" />
                <p className="text-sm font-semibold text-white">Recent Purchase</p>
              </div>

              <p className="text-xs text-gray-300 line-clamp-2 mb-1">
                {purchase.buyer_location && (
                  <>
                    Someone in <span className="font-medium text-violet-300">{purchase.buyer_location}</span>{' '}
                  </>
                )}
                just bought{' '}
                <span className="font-medium text-white">
                  {purchase.game_name}
                </span>
              </p>

              <p className="text-xs text-gray-500">{timeAgo}</p>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => toast.dismiss(t)}
              className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      ),
      {
        duration: 5000,
        position: 'bottom-left',
      }
    )
  }

  // This component doesn't render anything visible
  return null
}

/**
 * Get a random anonymized location for display
 */
function getRandomLocations(): string[] {
  return [
    'California',
    'New York',
    'Texas',
    'Florida',
    'Illinois',
    'Pennsylvania',
    'Ohio',
    'Georgia',
    'North Carolina',
    'Michigan',
    'New Jersey',
    'Virginia',
    'Washington',
    'Arizona',
    'Massachusetts',
    'Tennessee',
    'Indiana',
    'Missouri',
    'Maryland',
    'Wisconsin',
    'Colorado',
    'Minnesota',
    'South Carolina',
    'Alabama',
    'Louisiana',
    'Kentucky',
    'Oregon',
    'Oklahoma',
    'Connecticut',
    'Utah',
    'Nevada',
    'Arkansas',
    'Kansas',
    'New Mexico',
    'Nebraska',
    'West Virginia',
    'Idaho',
    'Hawaii',
    'New Hampshire',
    'Maine',
    'Montana',
    'Rhode Island',
    'Delaware',
    'South Dakota',
    'North Dakota',
    'Alaska',
    'Vermont',
    'Wyoming',
    'London',
    'Paris',
    'Berlin',
    'Tokyo',
    'Sydney',
    'Toronto',
    'Singapore',
    'Dubai',
  ]
}

function getRandomLocation(): string {
  const locations = getRandomLocations()
  return locations[Math.floor(Math.random() * locations.length)]
}

/**
 * Daily Stats Toast Component
 * Shows total orders completed today
 */
export function DailyStatsToast() {
  const [isEnabled, setIsEnabled] = useState(true)
  const hasShownToday = useRef(false)

  useEffect(() => {
    if (!isEnabled || hasShownToday.current) return

    const supabase = createClient()

    // Fetch today's order count
    const fetchTodayStats = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', today.toISOString())

      if (count && count > 0) {
        showStatsToast(count)
        hasShownToday.current = true
      }
    }

    // Show stats toast after 5 seconds
    const timeout = setTimeout(() => {
      fetchTodayStats()
    }, 5000)

    return () => clearTimeout(timeout)
  }, [isEnabled])

  const showStatsToast = (count: number) => {
    toast.custom(
      (t) => (
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-xl border border-green-500/20 rounded-xl p-4 shadow-2xl min-w-[280px]">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 p-2 bg-green-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-green-400" />
            </div>

            <div className="flex-1">
              <p className="text-sm font-semibold text-white mb-1">
                {count} orders completed today
              </p>
              <p className="text-xs text-gray-400">
                Join thousands of satisfied buyers
              </p>
            </div>

            <button
              onClick={() => toast.dismiss(t)}
              className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      ),
      {
        duration: 6000,
        position: 'bottom-left',
      }
    )
  }

  return null
}
