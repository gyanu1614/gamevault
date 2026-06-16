/**
 * Auto-Release Countdown Timer Component
 *
 * Displays a real-time countdown until auto-release
 * Updates every second on the client side
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Clock, AlertCircle } from 'lucide-react'

interface AutoReleaseCountdownProps {
  autoReleaseAt: string | null
  orderStatus: string
  escrowStatus: string
}

export default function AutoReleaseCountdown({
  autoReleaseAt,
  orderStatus,
  escrowStatus,
}: AutoReleaseCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<{
    hours: number
    minutes: number
    seconds: number
    total: number
  } | null>(null)

  useEffect(() => {
    if (!autoReleaseAt || orderStatus !== 'delivered' || escrowStatus !== 'held') {
      return
    }

    const calculateTimeRemaining = () => {
      const now = new Date().getTime()
      const releaseTime = new Date(autoReleaseAt).getTime()
      const remaining = Math.max(0, releaseTime - now)

      const hours = Math.floor(remaining / (1000 * 60 * 60))
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000)

      setTimeRemaining({
        hours,
        minutes,
        seconds,
        total: remaining,
      })

      // Auto-refresh page when timer expires
      if (remaining === 0) {
        setTimeout(() => window.location.reload(), 1000)
      }
    }

    // Calculate immediately
    calculateTimeRemaining()

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [autoReleaseAt, orderStatus, escrowStatus])

  // Don't show if no auto-release date or wrong status
  if (!autoReleaseAt || orderStatus !== 'delivered' || escrowStatus !== 'held' || !timeRemaining) {
    return null
  }

  const { hours, minutes, seconds, total } = timeRemaining

  // Determine urgency level
  const isUrgent = total < 3600000 // Less than 1 hour
  const isExpiringSoon = total < 10800000 // Less than 3 hours

  return (
    <div
      className={`rounded-xl border p-4 ${
        isUrgent
          ? 'bg-error-bg border-error/40'
          : isExpiringSoon
          ? 'bg-warning-bg border-warning/40'
          : 'bg-blue-500/10 border-blue-500/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {isUrgent || isExpiringSoon ? (
          <AlertCircle className={`w-5 h-5 mt-0.5 ${isUrgent ? 'text-error' : 'text-warning'}`} />
        ) : (
          <Clock className="w-5 h-5 mt-0.5 text-blue-400" />
        )}
        <div className="flex-1">
          <h4
            className={`font-semibold mb-1 ${
              isUrgent ? 'text-error' : isExpiringSoon ? 'text-warning' : 'text-blue-400'
            }`}
          >
            {total === 0
              ? 'Auto-Release Processing'
              : 'Payment Auto-Release Timer'}
          </h4>
          <p className="text-sm text-text-secondary mb-3">
            {total === 0
              ? 'Payment is being released to the seller...'
              : 'Funds will be automatically released to the seller in:'}
          </p>

          {/* Countdown Display */}
          {total > 0 && (
            <div className="flex items-center gap-3 mb-3">
              {/* Hours */}
              <div className="flex flex-col items-center bg-bg-overlay border border-white/[0.1] rounded-lg p-2 min-w-[60px]">
                <span className="text-2xl font-bold text-white tabular-nums">
                  {hours.toString().padStart(2, '0')}
                </span>
                <span className="text-xs text-text-secondary mt-1">Hours</span>
              </div>

              <span className="text-xl text-text-tertiary">:</span>

              {/* Minutes */}
              <div className="flex flex-col items-center bg-bg-overlay border border-white/[0.1] rounded-lg p-2 min-w-[60px]">
                <span className="text-2xl font-bold text-white tabular-nums">
                  {minutes.toString().padStart(2, '0')}
                </span>
                <span className="text-xs text-text-secondary mt-1">Minutes</span>
              </div>

              <span className="text-xl text-text-tertiary">:</span>

              {/* Seconds */}
              <div className="flex flex-col items-center bg-bg-overlay border border-white/[0.1] rounded-lg p-2 min-w-[60px]">
                <span className="text-2xl font-bold text-white tabular-nums">
                  {seconds.toString().padStart(2, '0')}
                </span>
                <span className="text-xs text-text-secondary mt-1">Seconds</span>
              </div>
            </div>
          )}

          <p className="text-xs text-text-tertiary">
            {total === 0
              ? 'The page will refresh automatically.'
              : isUrgent
              ? '⚠️ Timer expiring soon! Confirm receipt now to release payment early.'
              : 'You can confirm receipt early to release payment immediately.'}
          </p>
        </div>
      </div>
    </div>
  )
}
