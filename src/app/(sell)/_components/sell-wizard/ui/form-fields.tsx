'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded'
import { inputCls } from '@/app/(sell)/_components/sell-wizard/styles'

// ─── FieldRow — input + caption + hint vertical stack ───────────────────────

/**
 * FieldRow is the canonical wrapper for "one input with bits below it".
 * Matches the spacing the shadcn FormItem provides (space-y-2) so that when
 * we later swap in react-hook-form via shadcn Form, the visual rhythm
 * doesn't change. Used inside Step3 sub-cards.
 */
export function FieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-2', className)}>{children}</div>
}

/**
 * AutoGrowTextarea — starts at three lines and grows with the text.
 *
 * The old box was a fixed 176px on desktop even when empty, which made a
 * one-line field look like the main event of the page. Now the resting
 * height matches a short answer, a long one gets the room it needs, and
 * past MAX_HEIGHT it scrolls instead of pushing the form off-screen.
 */
export const AUTOGROW_MAX_HEIGHT = 320

export function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  maxLength,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  ariaLabel: string
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Collapse, then size to content. +2 for the 1px borders, because
    // scrollHeight excludes them and the box is border-box.
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, AUTOGROW_MAX_HEIGHT)}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      aria-label={ariaLabel}
      rows={3}
      className={cn(inputCls, 'h-auto min-h-[88px] resize-none overflow-y-auto py-2.5 leading-relaxed sm:h-auto')}
    />
  )
}

/**
 * TipBox — guidance under a field: a small muted info icon and one line
 * of text, left-aligned, directly under the input. No box and no colour —
 * a tinted panel made every tip compete with the fields for attention.
 * (Distinct from FieldHint, which stays for coloured status text such as
 * the stock warning and the discount confirmation.)
 */
export function TipBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    // !mt-2.5 (10px): room under the field (owner, 2026-10-12: cramped).
    // FieldRow spaces children with space-y-2, a sibling selector that
    // outranks a plain mt-*, hence the `!`.
    <div className={cn('!mt-2.5 flex items-start gap-1.5 text-left', className)}>
      <InfoOutlinedIcon
        aria-hidden
        sx={{ width: 12, height: 12, color: 'var(--color-text-tertiary)', mt: '2px', flexShrink: 0 }}
      />
      {/* Sentence case, smaller (owner, 2026-10-12): Title Case is for
          labels and search, never for a tip sentence. */}
      <p className="text-[11.5px] leading-[17px] text-text-tertiary">{children}</p>
    </div>
  )
}

export function FieldHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        // Plain text, not a pill. With no card or section borders left,
        // a bordered inset box around every helper line became the
        // heaviest thing on the page — louder than the fields it was
        // meant to support.
        'mt-2 text-[12px] leading-snug text-text-tertiary',
        className,
      )}
    >
      {children}
    </p>
  )
}

/**
 * FieldError — red message shown beneath a touched-but-empty required field.
 * Mirrors FieldHint's shape so the layout doesn't jump when error replaces hint.
 */
/**
 * One line under a field that suggests a change, with one button
 * ("Your title says FR. Switch to Fly Ride?" [Switch]). Never blocks, never
 * changes the field by itself.
 */
export function FieldHintLine({ text, actionLabel, onAction }: { text: string; actionLabel: string; onAction: () => void }) {
  return (
    <div role="status" className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-left">
      <SwapHorizRoundedIcon aria-hidden sx={{ width: 14, height: 14, color: 'var(--color-warning)', flexShrink: 0 }} />
      <p className="text-[12px] leading-[17px] text-text-secondary">{text}</p>
      <button
        type="button"
        onClick={onAction}
        className="min-h-[26px] rounded-[5px] border border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)] bg-warning-bg px-2.5 text-[12px] font-semibold text-warning hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {actionLabel}
      </button>
    </div>
  )
}

export function FieldError({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        'rounded-md border border-[color-mix(in_srgb,var(--color-error)_40%,transparent)] bg-error-bg px-2.5 py-1.5 text-xs leading-snug text-error',
        className,
      )}
    >
      {children}
    </p>
  )
}
