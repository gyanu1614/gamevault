/**
 * Seller Presence Hook
 *
 * Tracks and broadcasts seller online/offline status using Supabase Realtime
 */

'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { POLL_MS, foregroundPoll } from '@/lib/polling/intervals'
import { createClient } from '@/lib/supabase/client'
import { isSellerOnline } from '@/lib/presence/online'

/** A visibility change within this of the last heartbeat writes nothing. */
const HEARTBEAT_MIN_GAP_MS = 60_000

interface SellerPresence {
  seller_id: string
  is_online: boolean
  last_seen_at: string
  status_message?: string
}

/**
 * A plain request, not a server action: Next runs actions one at a time, so a
 * heartbeat could make the seller's own click wait behind it.
 */
async function beat(): Promise<boolean> {
  try {
    const res = await fetch('/api/presence/online', { method: 'POST', keepalive: true })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Hook to track current user's presence (for sellers)
 */
export function useMyPresence() {
  const [isOnline, setIsOnline] = useState(false)
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null)
  /** When presence was last written, so tab switches share one write a minute. */
  const lastBeatRef = useRef(0)
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const initializePresence = async () => {
      // Set initial online status
      lastBeatRef.current = Date.now()
      if ((await beat()) && mounted) {
        setIsOnline(true)
      }
    }

    // Initialize presence
    initializePresence()

    // Heartbeat: Update presence every 2 minutes
    heartbeatInterval.current = setInterval(async () => {
      if (document.visibilityState === 'visible') {
        lastBeatRef.current = Date.now()
        await beat()
      }
    }, 2 * 60 * 1000) // 2 minutes

    // Update presence on visibility change, at most once a minute: quick tab
    // switches wrote a presence row (plus an auth call) each time
    // (2026-10-20 usage audit). Online lasts 2+ minutes, so nothing goes stale.
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        setIsOnline(true)
        if (Date.now() - lastBeatRef.current < HEARTBEAT_MIN_GAP_MS) return
        lastBeatRef.current = Date.now()
        await beat()
      } else {
        // Don't immediately mark offline, let the cron job handle it
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Set offline on beforeunload
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline update
      const formData = new FormData()
      formData.append('action', 'offline')
      navigator.sendBeacon('/api/presence/offline', formData)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    // Cleanup
    return () => {
      mounted = false
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)

      // Mark offline on unmount
      navigator.sendBeacon('/api/presence/offline')
    }
  }, [])

  return { isOnline }
}

/**
 * Helper function to format "last seen" time
 */
export function formatLastSeen(lastSeenAt: string): string {
  const now = new Date()
  const lastSeen = new Date(lastSeenAt)
  const diffMs = now.getTime() - lastSeen.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

/**
 * "Is this seller online" for a dot: true / false, or null while loading or
 * when there is no seller to ask about (then show no dot).
 *
 * Polled, not realtime: seller_presence is not in the supabase_realtime
 * publication, so a postgres_changes subscription never fires. One shared
 * React Query entry per seller, so the header and chat dots on the same page
 * make one request every 2 minutes between them, visible tab only (the
 * heartbeat writes every 2).
 */
export function useSellerOnline(sellerId: string | null | undefined): boolean | null {
  const { data, isLoading } = useQuery({
    queryKey: ['seller-online', sellerId],
    enabled: !!sellerId,
    ...foregroundPoll(POLL_MS.sellerPresence),
    staleTime: 30_000,
    queryFn: async () => {
      const { data: row } = await createClient()
        .from('seller_presence')
        .select('is_online, last_seen_at')
        .eq('seller_id', sellerId!)
        .maybeSingle()
      return row ?? null
    },
  })
  if (!sellerId || isLoading) return null
  return isSellerOnline(data, Date.now())
}

export type PresenceSnapshot = { is_online: boolean | null; last_seen_at: string | null }

/**
 * Live presence for every seller on a listing grid, keyed by seller id.
 *
 * Marketplace pages are ISR (24 h safety net), so presence baked into their
 * HTML can be a day old. Read it fresh in the browser — 100 ids per request,
 * refreshed every 2 min while the tab is visible — and judge it with
 * isSellerOnline. null until the
 * first read lands, so the server HTML and the first client render agree.
 */
export function useSellersPresence(sellerIds: readonly string[]): Record<string, PresenceSnapshot> | null {
  const ids = useMemo(
    () => Array.from(new Set(sellerIds.filter(Boolean))).sort(),
    [sellerIds],
  )
  const { data } = useQuery({
    queryKey: ['sellers-presence', ids],
    enabled: ids.length > 0,
    ...foregroundPoll(POLL_MS.sellerPresence),
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient()
      const byId: Record<string, PresenceSnapshot> = {}
      for (let i = 0; i < ids.length; i += 100) {
        const { data: rows, error } = await supabase
          .from('seller_presence')
          .select('seller_id, is_online, last_seen_at')
          .in('seller_id', ids.slice(i, i + 100))
        if (error) throw error
        for (const r of (rows ?? []) as any[]) {
          byId[r.seller_id] = { is_online: r.is_online, last_seen_at: r.last_seen_at }
        }
      }
      return byId
    },
  })
  return data ?? null
}
