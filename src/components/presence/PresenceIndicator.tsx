'use client'

import { formatDistanceToNow } from 'date-fns'

interface PresenceIndicatorProps {
  isOnline: boolean
  lastSeenAt?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function PresenceIndicator({
  isOnline,
  lastSeenAt,
  showLabel = true,
  size = 'sm'
}: PresenceIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  const dotSize = sizeClasses[size]

  // Format last seen time
  const getLastSeenText = () => {
    if (!lastSeenAt) return 'Unknown'

    const lastSeen = new Date(lastSeenAt)
    const hoursSince = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60)

    // If more than 24 hours, don't show
    if (hoursSince > 24) {
      return null
    }

    // If less than 5 minutes, show as online
    if (hoursSince < 1/12) { // 5 minutes
      return 'Online'
    }

    return `Active ${formatDistanceToNow(lastSeen, { addSuffix: true })}`
  }

  const lastSeenText = getLastSeenText()

  // Don't show anything if last seen more than 24 hours ago
  if (!lastSeenText && !isOnline) {
    return null
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className={`${dotSize} rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'} ${isOnline ? 'animate-pulse' : ''}`} />
      {showLabel && (
        <span className={`text-xs ${isOnline ? 'text-success' : 'text-text-tertiary'}`}>
          {isOnline ? 'Online' : lastSeenText}
        </span>
      )}
    </div>
  )
}
