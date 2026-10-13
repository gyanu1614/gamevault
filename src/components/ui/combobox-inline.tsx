'use client'

import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Command, CommandInput } from 'cmdk'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OptionList } from './combobox-list'
import { SIZES } from './combobox-sizes'
import type { ComboboxOption } from './combobox'

/**
 * The search-in-the-field variant: the box turns into the search input when
 * opened and the list hangs off its bottom edge (shared border, square inner
 * corners, no gap). cmdk wraps both, so ↑/↓/Enter in the box drive the list.
 */
export function InlineCombobox({
  open,
  setOpen,
  options,
  selected,
  value,
  onChoose,
  placeholder,
  emptyText,
  ariaLabel,
  listboxId,
  invalid,
  disabled,
  onBlur,
  iconInTrigger,
  triggerIcon,
  rowIcon,
  size,
  className,
}: {
  open: boolean
  setOpen: (o: boolean) => void
  options: ComboboxOption[]
  selected: ComboboxOption | null
  value: string
  onChoose: (v: string) => void
  placeholder: string
  emptyText: string
  ariaLabel?: string
  listboxId: string
  invalid?: boolean
  disabled?: boolean
  onBlur?: () => void
  iconInTrigger: boolean
  triggerIcon: string
  rowIcon: string
  size: 'md' | 'lg'
  className?: string
}) {
  const s = SIZES[size]
  const [query, setQuery] = React.useState('')
  const boxRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const openList = () => {
    if (disabled || open) return
    setQuery('')
    setOpen(true)
    // Focus after the input mounts in place of the label.
    requestAnimationFrame(() => inputRef.current?.focus())
  }
  const close = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover.Root open={open} onOpenChange={(o) => (o ? openList() : close())}>
      <Command shouldFilter={false} loop className="relative w-full">
        <Popover.Anchor asChild>
          <div
            ref={boxRef}
            role={open ? undefined : 'combobox'}
            aria-controls={listboxId}
            aria-label={open ? undefined : ariaLabel}
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            tabIndex={disabled || open ? -1 : 0}
            onClick={openList}
            onKeyDown={(e) => {
              if (open || disabled) return
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault()
                openList()
              } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
                // Typing on the closed field starts the search with that key.
                e.preventDefault()
                openList()
                setQuery(e.key)
              }
            }}
            onBlur={(e) => {
              if (open) return
              if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return
              onBlur?.()
            }}
            className={cn(
              'flex w-full cursor-text items-center justify-between gap-2 transition-colors',
              s.trigger,
              size === 'md' && 'border-border-default text-text-primary hover:border-border-strong',
              size === 'lg' && 'text-text-primary',
              open && 'rounded-b-none border-white/[0.16] bg-[#1F2025] hover:border-white/[0.16]',
              invalid && !open && 'border-error ring-2 ring-error-bg',
              disabled && 'cursor-not-allowed opacity-50',
              className,
            )}
          >
            <span className={cn('flex min-w-0 flex-1 items-center', s.triggerGap)}>
              {iconInTrigger && selected?.icon_url && !open && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.icon_url} alt="" aria-hidden className={cn('shrink-0 object-cover', triggerIcon)} />
              )}
              {open ? (
                <CommandInput
                  ref={inputRef}
                  value={query}
                  onValueChange={setQuery}
                  aria-label={ariaLabel}
                  aria-controls={listboxId}
                  placeholder={selected?.label ?? placeholder}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      close()
                      boxRef.current?.focus()
                    }
                  }}
                  onBlur={() => onBlur?.()}
                  className={cn(
                    'min-w-0 flex-1 border-0 bg-transparent p-0 font-medium text-text-primary placeholder:font-normal placeholder:text-text-tertiary outline-none focus:outline-none focus-visible:outline-none focus-visible:[box-shadow:none]',
                    s.input,
                  )}
                />
              ) : (
                <span className={cn('truncate', !selected && 'font-normal text-text-tertiary')}>{selected?.label ?? placeholder}</span>
              )}
            </span>
            {open ? (
              <Search aria-hidden className="h-4 w-4 shrink-0 text-text-tertiary" />
            ) : (
              <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-text-tertiary" />
            )}
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            side="bottom"
            sideOffset={-1}
            avoidCollisions={false}
            style={{ width: 'var(--radix-popover-trigger-width)' }}
            className={cn(
              'z-50 overflow-hidden rounded-b-xl rounded-t-none border border-t-0 border-white/[0.16] bg-[#1F2025]',
              'shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            )}
            // Focus stays in the field; clicks on the field don't close it.
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (boxRef.current?.contains(e.target as Node)) e.preventDefault()
            }}
          >
            <div aria-hidden className="mx-3 h-px bg-white/[0.07]" />
            <OptionList
              listboxId={listboxId}
              options={options}
              query={query}
              value={value}
              emptyText={emptyText}
              size={size}
              rowIconClassName={rowIcon}
              onChoose={(v) => {
                onChoose(v)
                setQuery('')
                boxRef.current?.focus()
              }}
              className="max-h-[min(22rem,var(--radix-popover-content-available-height))]"
            />
          </Popover.Content>
        </Popover.Portal>
      </Command>
    </Popover.Root>
  )
}
