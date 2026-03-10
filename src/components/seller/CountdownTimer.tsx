/**
 * Real-time Countdown Timer Component
 *
 * Displays a live countdown for seller reapplication cooldown period
 * Updates every second with precise time remaining
 */

'use client'

import { useState, useEffect } from 'react'
import { Clock, Calendar, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

interface CountdownTimerProps {
  targetDate: string // ISO timestamp
  onComplete?: () => void
  className?: string
}

interface TimeRemaining {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalSeconds: number
  isExpired: boolean
}

export default function CountdownTimer({
  targetDate,
  onComplete,
  className = '',
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(
    calculateTimeRemaining(targetDate)
  )

  useEffect(() => {
    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining(targetDate)
      setTimeRemaining(remaining)

      // Call onComplete when timer expires
      if (remaining.isExpired && onComplete) {
        onComplete()
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [targetDate, onComplete])

  if (timeRemaining.isExpired) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center ${className}`}
      >
        <div className="mb-2 flex items-center justify-center gap-2 text-green-400">
          <AlertCircle className="h-5 w-5" />
          <span className="font-semibold">Cooldown Period Expired</span>
        </div>
        <p className="text-sm text-green-300">You can now reapply!</p>
      </motion.div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 text-yellow-400">
        <Clock className="h-5 w-5" />
        <span className="font-semibold">Eligible to reapply in:</span>
      </div>

      {/* Countdown Display */}
      <div className="grid grid-cols-4 gap-3">
        <TimeUnit value={timeRemaining.days} label="Days" />
        <TimeUnit value={timeRemaining.hours} label="Hours" />
        <TimeUnit value={timeRemaining.minutes} label="Minutes" />
        <TimeUnit value={timeRemaining.seconds} label="Seconds" />
      </div>

      {/* Target Date */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Calendar className="h-4 w-4" />
        <span>
          Available on:{' '}
          <span className="font-medium text-white">
            {new Date(targetDate).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
          initial={{ width: '100%' }}
          animate={{ width: `${getProgressPercentage(timeRemaining.totalSeconds, targetDate)}%` }}
          transition={{ duration: 1 }}
        />
      </div>
    </div>
  )
}

// Time unit component
function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 p-3">
      <motion.div
        key={value}
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-2xl font-bold text-white"
      >
        {value.toString().padStart(2, '0')}
      </motion.div>
      <div className="mt-1 text-xs text-gray-400">{label}</div>
    </div>
  )
}

// Calculate time remaining
function calculateTimeRemaining(targetDate: string): TimeRemaining {
  const target = new Date(targetDate).getTime()
  const now = new Date().getTime()
  const difference = target - now

  if (difference <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: true,
    }
  }

  const totalSeconds = Math.floor(difference / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    isExpired: false,
  }
}

// Calculate progress percentage (for visual effect)
function getProgressPercentage(secondsRemaining: number, targetDate: string): number {
  // Assume cooldown started from now() - totalCooldown
  const target = new Date(targetDate).getTime()
  const now = new Date().getTime()
  const difference = target - now

  if (difference <= 0) return 0

  // Estimate total cooldown (could be 7, 30, or 90 days)
  const totalCooldown = difference + (now - (target - difference))
  const elapsed = now - (target - difference)
  const percentage = Math.max(0, Math.min(100, (elapsed / totalCooldown) * 100))

  return 100 - percentage // Invert to show remaining
}
