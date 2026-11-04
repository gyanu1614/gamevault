'use client'

import { ArrowsClockwise, CircleNotch, Warning } from '@phosphor-icons/react'
import { AdminEmpty, adminBtn } from '../../components/kit'

export function ErrorPanel({
  message,
  onRetry,
  retrying,
}: {
  message?: string
  onRetry: () => void
  retrying: boolean
}) {
  return (
    <AdminEmpty
      icon={Warning}
      tone="warning"
      title="Couldn't Load the Queue"
      hint={message || 'Something went wrong fetching moderation data.'}
      action={
        <button type="button" onClick={onRetry} disabled={retrying} className={adminBtn.secondary}>
          {retrying ? (
            <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowsClockwise aria-hidden weight="bold" className="h-4 w-4" />
          )}
          Retry
        </button>
      }
    />
  )
}
