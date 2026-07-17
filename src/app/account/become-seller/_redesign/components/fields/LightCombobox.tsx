/**
 * LightCombobox — searchable single-select for the light seller application.
 *
 * Same radix-popover + cmdk machinery as the site-wide Combobox, but painted for
 * the Forest Ledger world: ivory/paper surfaces, ink text, a green focus ring,
 * and a lime check on the selected row. Kept local to the redesign so the dark
 * site combobox stays untouched.
 */

'use client'

import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk'
import { Check, ChevronDown, Search } from 'lucide-react'
import { PALETTE } from '../../theme'
import { inputBaseClass, inputBaseStyle } from './styles'

export interface LightComboOption {
  value: string
  label: string
  keywords?: string[]
}

interface LightComboboxProps {
  value: string
  onChange: (v: string) => void
  options: LightComboOption[]
  placeholder?: string
  emptyText?: string
  ariaLabel?: string
  /** Skip the auto alphabetical sort (default sorted A→Z). */
  unsorted?: boolean
  invalid?: boolean
  disabled?: boolean
  className?: string
}

export default function LightCombobox({
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  emptyText = 'No matches.',
  ariaLabel,
  unsorted,
  invalid,
  disabled,
  className,
}: LightComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const listboxId = React.useId()

  const sortedOptions = React.useMemo(() => {
    if (unsorted) return options
    return [...options].sort((a, b) => a.label.localeCompare(b.label))
  }, [options, unsorted])

  const selected = sortedOptions.find((o) => o.value === value) ?? null

  React.useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <div
          role="combobox"
          aria-label={ariaLabel}
          aria-controls={listboxId}
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (disabled) return
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          className={
            inputBaseClass +
            ' flex cursor-pointer items-center justify-between' +
            (open ? ' !border-[color:var(--sa-forest-2)] ring-2 ring-[color:var(--sa-forest-2)]/15' : '') +
            (invalid && !open ? ' !border-[#B4462F]' : '') +
            (disabled ? ' cursor-not-allowed opacity-50' : '') +
            (className ? ` ${className}` : '')
          }
          style={inputBaseStyle}
        >
          <span
            className="truncate"
            style={{ color: selected ? PALETTE.ink : `${PALETTE.ink2}99` }}
          >
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown
            className={'h-4 w-4 shrink-0 transition-transform' + (open ? ' rotate-180' : '')}
            style={{ color: PALETTE.ink2 }}
          />
        </div>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          style={{ width: 'var(--radix-popover-trigger-width)', backgroundColor: PALETTE.paper, borderColor: PALETTE.line }}
          className={
            'z-50 overflow-hidden rounded-lg border shadow-xl ' +
            'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          }
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <Command
            shouldFilter
            filter={(itemValue, search, keywords) => {
              const q = search.trim().toLowerCase()
              if (!q) return 1
              const hay = (itemValue + ' ' + (keywords?.join(' ') ?? '')).toLowerCase()
              return hay.includes(q) ? 1 : 0
            }}
            className="flex w-full flex-col"
          >
            <div
              className="flex items-center gap-2 border-b px-3 py-2"
              style={{ borderColor: PALETTE.line }}
            >
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: PALETTE.ink2 }} />
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder="Search…"
                autoFocus
                className="h-6 flex-1 border-0 bg-transparent text-sm outline-none focus:outline-none focus-visible:outline-none focus-visible:shadow-none focus-visible:[box-shadow:none]"
                style={{ color: PALETTE.ink }}
              />
            </div>
            <CommandList id={listboxId} className="max-h-72 overflow-y-auto p-1">
              <CommandEmpty className="px-3 py-2 text-xs" style={{ color: PALETTE.ink2 }}>
                {emptyText}
              </CommandEmpty>
              <CommandGroup>
                {sortedOptions.map((o) => {
                  const isChecked = o.value === value
                  return (
                    <CommandItem
                      key={o.value}
                      value={o.label}
                      keywords={[o.value, ...(o.keywords ?? [])]}
                      onSelect={() => {
                        onChange(o.value)
                        setOpen(false)
                      }}
                      className={
                        'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none ' +
                        'data-[selected=true]:bg-[color:var(--sa-forest)]/[0.06]'
                      }
                      style={{ color: PALETTE.ink }}
                    >
                      <span className="flex-1 truncate">{o.label}</span>
                      {isChecked && (
                        <Check className="h-3.5 w-3.5" style={{ color: PALETTE.forest2 }} />
                      )}
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
