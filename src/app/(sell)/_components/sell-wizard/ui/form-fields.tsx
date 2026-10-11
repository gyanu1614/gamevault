'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
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
    // !mt-1.5 (6px): FieldRow spaces children with space-y-2, a sibling
    // selector that outranks a plain mt-*, so without `!` the gap stayed 8px.
    <div className={cn('!mt-1.5 flex items-start gap-1.5 text-left', className)}>
      <InfoOutlinedIcon
        aria-hidden
        sx={{ width: 13, height: 13, color: 'var(--color-text-tertiary)', mt: '2.5px', flexShrink: 0 }}
      />
      {/* `capitalize`: tips read in Title Case (owner, 2026-10-10), including
          the admin-written attribute help text, so no copy needs retyping. */}
      <p className="text-[12px] capitalize leading-[18px] text-text-tertiary">{children}</p>
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
