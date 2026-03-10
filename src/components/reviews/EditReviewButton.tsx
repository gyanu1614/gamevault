/**
 * Edit Review Button Component
 *
 * Conditional button that appears for review authors
 * - Only shows if user is the reviewer
 * - Only within 30-day edit window
 * - Only if 24 hours passed since last edit
 * - Shows disabled state with tooltip if conditions not met
 */

'use client'

import React from 'react'
import { Edit2, Clock, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { differenceInDays, differenceInHours, formatDistanceToNow } from 'date-fns'

interface EditReviewButtonProps {
  reviewId: string
  reviewerId: string
  currentUserId?: string
  createdAt: string
  lastEditedAt?: string | null
  onClick: () => void
  className?: string
}

export default function EditReviewButton({
  reviewId,
  reviewerId,
  currentUserId,
  createdAt,
  lastEditedAt,
  onClick,
  className
}: EditReviewButtonProps) {
  // Check if user is the reviewer
  const isReviewer = currentUserId === reviewerId

  if (!isReviewer) {
    return null
  }

  // Calculate time constraints
  const createdDate = new Date(createdAt)
  const lastEditDate = lastEditedAt ? new Date(lastEditedAt) : null
  const now = new Date()

  const daysSinceCreated = differenceInDays(now, createdDate)
  const hoursSinceLastEdit = lastEditDate ? differenceInHours(now, lastEditDate) : null

  // Check constraints
  const isWithin30Days = daysSinceCreated <= 30
  const is24HoursPassed = hoursSinceLastEdit === null || hoursSinceLastEdit >= 24

  const canEdit = isWithin30Days && is24HoursPassed

  // Determine disabled reason
  let disabledReason = ''
  if (!isWithin30Days) {
    disabledReason = '30-day edit window expired'
  } else if (!is24HoursPassed && hoursSinceLastEdit !== null) {
    const hoursRemaining = 24 - hoursSinceLastEdit
    disabledReason = `Can edit again in ${hoursRemaining} ${hoursRemaining === 1 ? 'hour' : 'hours'}`
  }

  return (
    <div className="relative group">
      <button
        onClick={canEdit ? onClick : undefined}
        disabled={!canEdit}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
          canEdit
            ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 active:scale-95'
            : 'text-gray-600 cursor-not-allowed',
          className
        )}
        title={canEdit ? 'Edit review' : disabledReason}
      >
        {canEdit ? (
          <>
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </>
        ) : !isWithin30Days ? (
          <>
            <Lock className="w-3.5 h-3.5" />
            <span>Locked</span>
          </>
        ) : (
          <>
            <Clock className="w-3.5 h-3.5" />
            <span>Wait</span>
          </>
        )}
      </button>

      {/* Tooltip on hover for disabled state */}
      {!canEdit && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-white/10 rounded-lg text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
          {disabledReason}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900" />
        </div>
      )}

      {/* Edit window info for available edits */}
      {canEdit && daysSinceCreated > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-white/10 rounded-lg text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
          {30 - daysSinceCreated} {30 - daysSinceCreated === 1 ? 'day' : 'days'} left to edit
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}
