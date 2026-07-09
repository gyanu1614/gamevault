'use client'

/**
 * PriceField — inline table price editor.
 *
 * [ $  0.0022  /M ] [✓]
 *
 * Click the value → select-all → type a new price. The trailing tick is
 * muted grey while the value matches the saved price; once dirty it
 * lights up lime (icon only — per the design rule: no green fills or
 * borders, only the green tick) and clicking it commits via `onSave`.
 * While `onSave` is pending the tick swaps for a spinner. Enter saves,
 * Escape reverts. Focus ring is a lighter grey border — deliberately
 * not lime.
 */

import * as React from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PriceFieldProps {
  /** Saved price (source of truth, e.g. from the DB row). */
  value: number
  /** Unit label rendered as "/{unit}" inside the control. */
  unit?: string
  /** Commit handler. Async — the tick shows a spinner until it settles. */
  onSave?: (next: number) => void | Promise<void>
  disabled?: boolean
  className?: string
}

export function PriceField({ value, unit = 'Unit', onSave, disabled, className }: PriceFieldProps) {
  const [raw, setRaw] = React.useState(String(value))
  const [saving, setSaving] = React.useState(false)

  // Re-sync when the saved value changes underneath us (refetch, bulk
  // edit) — but never while the user is mid-save.
  React.useEffect(() => {
    if (!saving) setRaw(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const parsed = Number.parseFloat(raw)
  const valid = Number.isFinite(parsed) && parsed > 0
  const dirty = valid && parsed !== value

  const commit = async () => {
    if (!dirty || saving || !onSave) return
    try {
      setSaving(true)
      await onSave(parsed)
    } finally {
      setSaving(false)
    }
  }
  const revert = () => setRaw(String(value))

  return (
    <span
      className={cn(
        // Fixed width so every row's control matches ("5" and "1199.99"
        // render identically); the value group centers inside it.
        'inline-flex h-10 w-[170px] items-stretch overflow-hidden rounded-md border border-white/[0.08] bg-[#12151e] transition-colors',
        // Selected/focused = lighter grey border. No lime, no ring.
        'focus-within:border-white/[0.28]',
        disabled && 'opacity-50',
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center justify-center gap-1 px-2">
        <span className="select-none text-[12.5px] font-semibold text-text-tertiary">$</span>
        <input
          value={raw}
          disabled={disabled || saving}
          onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ''))}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit()
            if (e.key === 'Escape') revert()
          }}
          // Content-hugging (so "$ 5 /Unit" reads as one centered token,
          // no dead gap on short values) but clamped so long values can't
          // push the suffix/tick out of the box.
          size={Math.min(Math.max(raw.length, 1), 9)}
          aria-label="Price per unit"
          className={cn(
            'w-auto bg-transparent text-right text-[13.5px] font-bold tabular-nums text-text-primary',
            // Kill BOTH the outline and the global :focus-visible lime
            // box-shadow ring (globals.css) — the control's border is the
            // only focus cue here.
            'outline-none focus:outline-none focus-visible:shadow-none',
            // Subtle grey select-all highlight — not the browser default blue/green.
            'selection:bg-white/[0.18] selection:text-white',
          )}
        />
        <span className="max-w-[72px] select-none truncate whitespace-nowrap text-[12px] font-medium text-text-tertiary">
          /{unit}
        </span>
      </span>
      <button
        type="button"
        onClick={() => void commit()}
        disabled={disabled || saving || !dirty}
        aria-label={dirty ? 'Save price' : 'Price saved'}
        className={cn(
          'flex w-10 flex-none items-center justify-center border-l border-white/[0.08] transition-colors',
          dirty
            ? 'bg-white/[0.04] text-lime-text hover:bg-white/[0.09]'
            : 'cursor-default text-[#4a5266]',
        )}
      >
        {saving ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin text-lime-text" />
        ) : (
          <Check className="h-[18px] w-[18px]" strokeWidth={3} />
        )}
      </button>
    </span>
  )
}
