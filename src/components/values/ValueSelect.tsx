'use client'

import type { ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VALUE_FIELD, VALUE_PANEL } from './styles'

/**
 * Single-choice dropdown for hub toolbars (sort, mutation, category…) on the
 * shared Radix Select (keyboard, typeahead, Escape, portal) with the hub's
 * fill-only trigger and outline-free panel.
 */
export function ValueSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  icon,
  className = '',
}: {
  value: T
  onChange: (v: T) => void
  options: ReadonlyArray<{ value: T; label: string; leading?: ReactNode }>
  label: string
  icon?: ReactNode
  className?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger
        aria-label={label}
        className={`h-12 gap-2 px-3.5 text-body-sm data-[state=open]:ring-2 data-[state=open]:ring-focus-soft ${VALUE_FIELD} ${className}`}
      >
        {/* The shared trigger clamps its direct <span> children with
            `[&>span]:line-clamp-1`, which makes them `display:-webkit-box`
            (vertical) — the icon then stacks above the value. `!flex` keeps
            icon + value on one row; the value itself truncates. */}
        <span className="!flex min-w-0 flex-1 items-center gap-2 text-left">
          {icon && <span className="flex shrink-0 text-text-tertiary">{icon}</span>}
          <SelectValue className="min-w-0 truncate" />
        </span>
      </SelectTrigger>
      <SelectContent className={`p-0 ${VALUE_PANEL}`}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-body-sm">
            <span className="flex items-center gap-2">
              {o.leading}
              {o.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
