'use client'

/**
 * The editor's actions: status, save state, Preview, Save Draft / Publish
 * (or Unpublish / Update for a live post).
 *
 * Phones: a full-width bar on the bottom edge, like the buy bar (BuyBar.tsx,
 * proven on a real iPhone 2026-10-12): portalled to <body>, `fixed bottom-0`,
 * solid fill down through the home-indicator area, no transform — iOS 26
 * Safari tints its floating toolbar to match only such a bar, and a floating
 * card let the post show under and below it (owner, 2026-10-13). A spacer
 * keeps it off the end of the page.
 * Desktop (sm+): the same box floating bottom-right, as before.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleNotch } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { adminBtn, StatusBadge, type ChipTone } from '../../components/kit'
import type { BlogStatus } from '@/lib/actions/admin-blog'

const STATUS_TONE: Record<BlogStatus, ChipTone> = { draft: 'warning', published: 'success', archived: 'neutral' }
const STATUS_LABEL: Record<BlogStatus, string> = { draft: 'Draft', published: 'Live', archived: 'Archived' }
/** Phones: buttons share the row; desktop: natural width. */
const grow = 'flex-1 sm:flex-none'

export function ActionBar({
  status,
  stateText,
  error,
  saving,
  dirty,
  blocked,
  blockedText,
  canSaveDraft,
  onPreview,
  onSave,
}: {
  status: BlogStatus
  stateText: string
  error: string | null
  saving: boolean
  dirty: boolean
  blocked: boolean
  blockedText?: string
  canSaveDraft: boolean
  onPreview: () => void
  onSave: (next: BlogStatus) => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const live = status === 'published'

  const bar = (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#1D1E23] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_32px_-16px_rgba(0,0,0,0.7)]',
        'sm:inset-x-auto sm:bottom-4 sm:right-6 sm:rounded-lg sm:border sm:border-white/[0.06] sm:bg-bg-overlay-2 sm:p-2 sm:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)] lg:right-8',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={STATUS_LABEL[status]} tone={STATUS_TONE[status]} className="px-2.5 py-1 text-[12px]" />
        {/* Desktop shows the save state; phones only an error, on its own line. */}
        <span
          role="status"
          aria-live="polite"
          className={cn('px-1 text-[12.5px] sm:mr-2 sm:inline', error ? 'order-first basis-full text-error sm:order-none sm:basis-auto' : 'hidden text-text-tertiary')}
        >
          {error ?? stateText}
        </span>
        <button type="button" onClick={onPreview} className={cn(adminBtn.secondary, grow)}>Preview</button>
        {live ? (
          <>
            <button type="button" disabled={saving} onClick={() => onSave('draft')} className={cn(adminBtn.secondary, grow)}>Unpublish</button>
            <button type="button" disabled={saving || blocked || !dirty} onClick={() => onSave('published')} className={cn(adminBtn.primary, grow)}>
              {saving && <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />}
              Update
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={saving || !canSaveDraft} onClick={() => onSave('draft')} className={cn(adminBtn.secondary, grow)}>
              Save Draft
            </button>
            <button
              type="button"
              disabled={saving || blocked}
              title={blocked ? blockedText : undefined}
              onClick={() => onSave('published')}
              className={cn(adminBtn.primary, grow)}
            >
              {saving && <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />}
              Publish
            </button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Room for the bar under the last block, so it never covers it. */}
      <div aria-hidden className="h-[calc(88px+env(safe-area-inset-bottom))] sm:h-20" />
      {mounted && createPortal(bar, document.body)}
    </>
  )
}
