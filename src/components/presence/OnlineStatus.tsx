/**
 * Online Status Component
 *
 * Shows seller online/offline status with realtime updates
 */

'use client'

import React from 'react'
import { Circle } from 'lucide-react'
import { useSellerPresence, formatLastSeen } from '@/hooks/use-seller-presence'

interface OnlineStatusProps {
  sellerId: string
  showLabel?: boolean
  showLastSeen?: boolean
  className?: string
}

export default function OnlineStatus({
  sellerId,
  showLabel = true,
  showLastSeen = false,
  className = ''
}: OnlineStatusProps) {
  const { presence, isLoading } = useSellerPresence(sellerId)

  if (isLoading) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
        {showLabel && <span className="text-sm text-gray-500">Loading...</span>}
      </div>
    )
  }

  if (!presence) {
    return null
  }

  const isOnline = presence.is_online
  const lastSeen = presence.last_seen_at

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Status indicator */}
      <div className="relative">
        <Circle
          className={`w-2 h-2 ${isOnline ? 'text-green-400 fill-green-400' : 'text-gray-500 fill-gray-500'}`}
        />
        {isOnline && (
          <Circle className="absolute inset-0 w-2 h-2 text-green-400 fill-green-400 animate-ping opacity-75" />
        )}
      </div>

      {/* Label */}
      {showLabel && (
        <span className={`text-sm font-medium ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}

      {/* Last seen */}
      {showLastSeen && !isOnline && lastSeen && (
        <span className="text-xs text-gray-400">
          {formatLastSeen(lastSeen)}
        </span>
      )}

      {/* Status message */}
      {presence.status_message && (
        <span className="text-xs text-gray-400 italic">
          {presence.status_message}
        </span>
      )}
    </div>
  )
}

/**
 * Badge variant - compact design
 */
export function OnlineStatusBadge({ sellerId }: { sellerId: string }) {
  const { presence } = useSellerPresence(sellerId)

  if (!presence?.is_online) {
    return null
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
      <Circle className="w-1.5 h-1.5 text-green-400 fill-green-400 animate-pulse" />
      <span className="text-xs font-medium text-green-400">Online</span>
    </div>
  )
}

/**
 * Simple dot indicator only
 */
export function OnlineStatusDot({ sellerId, size = 'sm' }: { sellerId: string; size?: 'sm' | 'md' | 'lg' }) {
  const { presence } = useSellerPresence(sellerId)

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  return (
    <div className="relative inline-block">
      <Circle
        className={`${sizeClasses[size]} ${presence?.is_online ? 'text-green-400 fill-green-400' : 'text-gray-500 fill-gray-500'}`}
      />
      {presence?.is_online && (
        <Circle
          className={`absolute inset-0 ${sizeClasses[size]} text-green-400 fill-green-400 animate-ping opacity-75`}
        />
      )}
    </div>
  )
}
