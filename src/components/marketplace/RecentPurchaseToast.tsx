/**
 * Daily Stats Toast — "N Orders Completed Today", once per tab session.
 *
 * This module used to also hold RecentPurchaseToast, a realtime channel on
 * `orders` INSERTs with status=paid opened for EVERY visitor. It could never
 * fire: orders are inserted as 'pending' (paid is an UPDATE), and orders RLS
 * hides other people's orders from anon and from signed-in users alike. It was
 * removed on 2026-10-09 (Supabase usage audit) rather than kept as a dead socket.
 *
 * The count query is RLS-scoped the same way, so an anonymous visitor always
 * reads 0: it runs only for signed-in users, once per tab session.
 */

'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { safeBackground } from '@/lib/utils/safe-background'
import { toast } from 'sonner'
import { LightningIcon } from '@phosphor-icons/react/dist/csr/Lightning'
import { useAuth } from '@/hooks/use-auth'

/**
 * Once per tab (module scope survives client navigations). Deliberately not
 * sessionStorage: every storage key must be listed in the Cookie Policy, and
 * this saves at most one count query per full page load.
 */
let checkedThisTab = false

function alreadyCheckedThisSession(): boolean {
  return checkedThisTab
}

function markCheckedThisSession() {
  checkedThisTab = true
}

/**
 * Daily Stats Toast Component
 * Shows total orders completed today
 */
export function DailyStatsToast() {
  const { user } = useAuth()
  const userId = user?.id
  // Marketplace social proof: never inside the admin console.
  const isAdmin = usePathname()?.startsWith('/admin') ?? false

  useEffect(() => {
    // Anonymous visitors can't read orders (RLS), so the count is always 0:
    // no request. Signed-in users ask once per tab session.
    if (isAdmin || !userId || alreadyCheckedThisSession()) return

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

      markCheckedThisSession()
      if (count && count > 0) showStatsToast(count)
    }

    // Show stats toast after 5 seconds. Wrapped because a bare call here is
    // fire-and-forget: a "Load failed" on a mobile connection would reject with
    // nothing handling it. A missing stats toast is not worth an error.
    const timeout = setTimeout(() => {
      void safeBackground(fetchTodayStats, undefined, 'dailyStatsToast')
    }, 5000)

    return () => clearTimeout(timeout)
  }, [isAdmin, userId])

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

export default DailyStatsToast
