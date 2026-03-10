/**
 * Presence Provider
 *
 * Automatically tracks seller presence when they're logged in
 * Add this to layouts where sellers need presence tracking
 */

'use client'

import React, { useEffect } from 'react'
import { useMyPresence } from '@/hooks/use-seller-presence'
import { useAuth } from '@/hooks/use-auth'

interface PresenceProviderProps {
  children: React.ReactNode
  enabled?: boolean
}

export default function PresenceProvider({ children, enabled = true }: PresenceProviderProps) {
  const { user } = useAuth()
  const { isOnline } = useMyPresence()

  // Only track if user is logged in and enabled
  const shouldTrack = enabled && user

  if (!shouldTrack) {
    return <>{children}</>
  }

  return <>{children}</>
}

/**
 * Presence Status Indicator
 * Shows current user's online status (for debugging/testing)
 */
export function PresenceDebugIndicator() {
  const { isOnline } = useMyPresence()
  const { user } = useAuth()

  if (!user || process.env.NODE_ENV === 'production') {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 px-3 py-2 bg-black/90 border border-white/[0.1] rounded-lg text-xs">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-500'}`} />
        <span className="text-white">
          Presence: {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  )
}
