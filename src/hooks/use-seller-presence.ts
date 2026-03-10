/**
 * Seller Presence Hook
 *
 * Tracks and broadcasts seller online/offline status using Supabase Realtime
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updatePresenceOnline, updatePresenceOffline } from '@/lib/actions/seller-presence'

interface SellerPresence {
  seller_id: string
  is_online: boolean
  last_seen_at: string
  status_message?: string
}

/**
 * Hook to track current user's presence (for sellers)
 */
export function useMyPresence() {
  const [isOnline, setIsOnline] = useState(false)
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const initializePresence = async () => {
      // Set initial online status
      const result = await updatePresenceOnline()
      if (result.success && mounted) {
        setIsOnline(true)
      }
    }

    // Initialize presence
    initializePresence()

    // Heartbeat: Update presence every 2 minutes
    heartbeatInterval.current = setInterval(async () => {
      if (document.visibilityState === 'visible') {
        await updatePresenceOnline()
      }
    }, 2 * 60 * 1000) // 2 minutes

    // Update presence on visibility change
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await updatePresenceOnline()
        setIsOnline(true)
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
      updatePresenceOffline()
    }
  }, [])

  return { isOnline }
}

/**
 * Hook to subscribe to a specific seller's presence
 */
export function useSellerPresence(sellerId: string | null | undefined) {
  const [presence, setPresence] = useState<SellerPresence | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!sellerId) {
      setPresence(null)
      setIsLoading(false)
      return
    }

    let mounted = true

    const fetchPresence = async () => {
      const { data, error } = await supabase
        .from('seller_presence')
        .select('*')
        .eq('seller_id', sellerId)
        .single()

      if (mounted) {
        if (data) {
          setPresence(data)
        }
        setIsLoading(false)
      }
    }

    fetchPresence()

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`seller-presence:${sellerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seller_presence',
          filter: `seller_id=eq.${sellerId}`,
        },
        (payload) => {
          if (mounted) {
            setPresence(payload.new as SellerPresence)
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      channel.unsubscribe()
    }
  }, [sellerId, supabase])

  return { presence, isLoading }
}

/**
 * Hook to get all online sellers with realtime updates
 */
export function useOnlineSellers() {
  const [onlineSellers, setOnlineSellers] = useState<SellerPresence[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const fetchOnlineSellers = async () => {
      const { data, error } = await supabase
        .from('seller_presence')
        .select('*')
        .eq('is_online', true)
        .order('last_seen_at', { ascending: false })

      if (mounted) {
        if (data) {
          setOnlineSellers(data)
        }
        setIsLoading(false)
      }
    }

    fetchOnlineSellers()

    // Subscribe to realtime updates for all online sellers
    const channel = supabase
      .channel('online-sellers')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seller_presence',
          filter: 'is_online=eq.true',
        },
        (payload) => {
          if (mounted) {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newPresence = payload.new as SellerPresence
              if (newPresence.is_online) {
                setOnlineSellers((prev) => {
                  const filtered = prev.filter((s) => s.seller_id !== newPresence.seller_id)
                  return [newPresence, ...filtered]
                })
              } else {
                setOnlineSellers((prev) => prev.filter((s) => s.seller_id !== newPresence.seller_id))
              }
            } else if (payload.eventType === 'DELETE') {
              setOnlineSellers((prev) =>
                prev.filter((s) => s.seller_id !== (payload.old as SellerPresence).seller_id)
              )
            }
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      channel.unsubscribe()
    }
  }, [supabase])

  return { onlineSellers, isLoading }
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
