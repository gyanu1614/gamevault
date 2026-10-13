'use client'

import * as React from 'react'
import { CommandGroup, CommandItem, CommandList } from 'cmdk'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { filterOptions, indexOptions } from './combobox-filter'
import { SIZES } from './combobox-sizes'
import type { ComboboxOption } from './combobox'

/** The filtered, capped rows (inside a cmdk Command, which owns the keyboard). */
export function OptionList({
  listboxId,
  options,
  query,
  value,
  emptyText,
  size,
  rowIconClassName,
  onChoose,
  className,
}: {
  listboxId: string
  options: ComboboxOption[]
  query: string
  value: string
  emptyText: string
  size: 'md' | 'lg'
  rowIconClassName: string
  onChoose: (v: string) => void
  className?: string
}) {
  const s = SIZES[size]
  const index = React.useMemo(() => indexOptions(options), [options])
  const deferred = React.useDeferredValue(query)
  const { items, more } = React.useMemo(() => filterOptions(index, deferred), [index, deferred])
  return (
    <CommandList id={listboxId} role="listbox" className={cn('overflow-y-auto overscroll-contain', s.list, className)}>
      {items.length === 0 && <p className="px-3 py-2 text-xs text-text-tertiary">{emptyText}</p>}
      <CommandGroup>
        {items.map((o) => {
          const isChecked = o.value === value
          return (
            <CommandItem
              key={o.value}
              // The value, not the label: two options may share a label.
              value={o.value}
              onSelect={() => onChoose(o.value)}
              className={cn(
                'flex w-full cursor-pointer items-center outline-none text-text-secondary',
                'data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-text-primary',
                s.row,
                isChecked && 'text-text-primary',
              )}
            >
              {o.icon_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.icon_url} alt={o.label} aria-hidden loading="lazy" className={cn('shrink-0 object-cover', rowIconClassName)} />
              )}
              <span className="flex-1 truncate">{o.label}</span>
              {isChecked && <Check className={cn('text-lime-text', s.check)} />}
            </CommandItem>
          )
        })}
      </CommandGroup>
      {more > 0 && (
        <p className="px-3 py-2.5 text-[12.5px] text-text-tertiary">
          {more.toLocaleString('en-US')} more. Keep typing to narrow it down.
        </p>
      )}
    </CommandList>
  )
}

