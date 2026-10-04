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

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { safeBackground } from '@/lib/utils/safe-background'
import { toast } from 'sonner'
import { ShoppingCartSimpleIcon } from '@phosphor-icons/react/dist/csr/ShoppingCartSimple'
import { LightningIcon } from '@phosphor-icons/react/dist/csr/Lightning'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { TOAST_CARD } from '@/lib/ui/surfaces'

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
  // Marketplace social proof: never inside the admin console.
  const isAdmin = usePathname()?.startsWith('/admin') ?? false

  useEffect(() => {
    if (!isEnabled || isAdmin) return

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
            .single() as any

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
  }, [isEnabled, isAdmin])

  const showPurchaseToast = (purchase: RecentPurchase) => {
    const timeAgo = 'just now'

    toast.custom(
      (t) => (
        <div className={`relative flex w-[356px] max-w-[calc(100vw-32px)] items-center gap-3 py-3 pl-3 pr-11 ${TOAST_CARD}`}>
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-success-bg text-success">
            <ShoppingCartSimpleIcon size={17} weight="bold" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-snug text-text-primary">Recent Purchase</p>
            <p className="line-clamp-2 text-[12.5px] leading-snug text-text-secondary">
              {purchase.buyer_location && (
                <>
                  Someone in <span className="font-medium text-text-primary">{purchase.buyer_location}</span>{' '}
                </>
              )}
              just bought <span className="font-medium text-text-primary">{purchase.game_name}</span>
              <span className="text-text-tertiary"> · {timeAgo}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(t)}
            aria-label="Dismiss"
            className="absolute right-[9px] top-1/2 flex h-[26px] w-[26px] -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <XIcon size={13} weight="bold" />
          </button>
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
  // Marketplace social proof: never inside the admin console.
  const isAdmin = usePathname()?.startsWith('/admin') ?? false

  useEffect(() => {
    if (!isEnabled || isAdmin || hasShownToday.current) return

    const supabase = createClient()

    // Fetch today's order count
    const fetchTodayStats = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact' })
        .eq('status', 'completed')
        .gte('created_at', today.toISOString()).limit(1)

      if (count && count > 0) {
        showStatsToast(count)
        hasShownToday.current = true
      }
    }

    // Show stats toast after 5 seconds. Wrapped because a bare call here is
    // fire-and-forget: a "Load failed" on a mobile connection would reject with
    // nothing handling it. A missing stats toast is not worth an error.
    const timeout = setTimeout(() => {
      void safeBackground(fetchTodayStats, undefined, 'dailyStatsToast')
    }, 5000)

    return () => clearTimeout(timeout)
  }, [isEnabled, isAdmin])

  // One compact row in the house toast style (owner, 2026-09-28: the old
  // two-line card inside the toast frame read as big and fake).
  const showStatsToast = (count: number) => {
    toast(`${count.toLocaleString('en-US')} ${count === 1 ? 'Order' : 'Orders'} Completed Today`, {
      icon: <LightningIcon size={17} weight="fill" aria-hidden />,
      duration: 6000,
      position: 'bottom-left',
    })
  }

  return null
}
