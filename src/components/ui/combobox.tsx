'use client'

/**
 * Combobox — searchable single-select dropdown.
 *
 * Built on:
 *   - @radix-ui/react-popover  (panel positioning, portaling, click-outside)
 *   - cmdk                      (search filter, keyboard nav, value matching)
 *
 * The trigger LOOKS like an input. Click it: panel opens, the trigger
 * input gains focus, the seller can type to filter. When the panel is
 * closed, the trigger shows the selected option's label (or placeholder).
 *
 * Usage:
 *   <Combobox
 *     value={value}
 *     onChange={setValue}
 *     options={[{ value: 'a', label: 'Apple' }, ...]}
 *     placeholder="Choose..."
 *   />
 *
 * Options are sorted alphabetically by label automatically.
 */

import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  icon_url?: string | null
  /** Optional secondary search keywords */
  keywords?: string[]
}

export interface ComboboxProps {
  value: string
  onChange: (v: string) => void
  options: ComboboxOption[]
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  /** Aria label when no visible label is paired */
  ariaLabel?: string
  /** Skip the auto alphabetical sort (default sorted A→Z) */
  unsorted?: boolean
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  emptyText = 'No matches.',
  disabled,
  className,
  ariaLabel,
  unsorted,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const triggerRef = React.useRef<HTMLDivElement | null>(null)

  // Alphabetical sort unless caller opts out.
  const sortedOptions = React.useMemo(() => {
    if (unsorted) return options
    return [...options].sort((a, b) => a.label.localeCompare(b.label))
  }, [options, unsorted])

  const selected = sortedOptions.find((o) => o.value === value) ?? null

  // When the panel closes, clear the query so next open starts fresh.
  React.useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <div
          ref={triggerRef}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (disabled) return
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          className={cn(
            // R12 — rounded-none + transparent so the trigger matches the rest of the
            // input chrome; border defines the box.
            'flex h-10 w-full cursor-pointer items-center justify-between rounded-none border bg-transparent px-3 text-sm transition-colors',
            'border-border-default text-text-primary',
            'hover:border-border-strong',
            open && 'border-lime ring-2 ring-lime-tint-bg',
            disabled && 'cursor-not-allowed opacity-50',
            className
          )}
        >
          <span className={cn('truncate', !selected && 'text-text-tertiary')}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-text-tertiary transition-transform',
              open && 'rotate-180'
            )}
          />
        </div>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          // Match the trigger's width so the panel is the same size as the box
          // above it. Radix exposes the trigger width via a CSS var.
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          className={cn(
            'z-50 overflow-hidden rounded-xl border border-border-default bg-bg-overlay shadow-elevated',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
          // Don't refocus the trigger on close — the typed query state
          // already conveys what the seller did.
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <Command
            // cmdk handles fuzzy filtering when we give it a value to test
            // against; we provide a custom filter that respects keywords too.
            shouldFilter
            filter={(itemValue, search, keywords) => {
              const q = search.trim().toLowerCase()
              if (!q) return 1
              const hay = (itemValue + ' ' + (keywords?.join(' ') ?? '')).toLowerCase()
              return hay.includes(q) ? 1 : 0
            }}
            className="flex w-full flex-col"
          >
            <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder={selected?.label ? `Search… (currently: ${selected.label})` : 'Search…'}
                autoFocus
                className="h-7 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
            <CommandList className="max-h-72 overflow-y-auto p-1">
              <CommandEmpty className="px-3 py-2 text-xs text-text-tertiary">
                {emptyText}
              </CommandEmpty>
              <CommandGroup>
                {sortedOptions.map((o) => {
                  const isChecked = o.value === value
                  return (
                    <CommandItem
                      key={o.value}
                      value={o.label}
                      // Provide the slug etc as a searchable keyword set.
                      keywords={[o.value, ...(o.keywords ?? [])]}
                      onSelect={() => {
                        onChange(o.value)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none',
                        'text-text-secondary',
                        'data-[selected=true]:bg-state-hover data-[selected=true]:text-text-primary'
                      )}
                    >
                      {o.icon_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={o.icon_url}
                          alt=""
                          className="h-5 w-5 shrink-0 rounded object-cover"
                        />
                      )}
                      <span className="flex-1 truncate">{o.label}</span>
                      {isChecked && <Check className="h-3.5 w-3.5 text-lime-text" />}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
