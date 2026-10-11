'use client'

/**
 * Combobox — searchable single-select dropdown.
 *
 * Built on:
 *   - @radix-ui/react-popover  (panel positioning, portaling, click-outside)
 *   - cmdk                      (search filter, keyboard nav, value matching)
 *   - vaul                      (`sheetOnTouch`: a bottom sheet on touch screens)
 *
 * The trigger LOOKS like an input. Click it: the panel opens with a search
 * box; type to filter. When closed, the trigger shows the selected option's
 * label (or the placeholder). Options are sorted A→Z unless `unsorted`.
 *
 *   <Combobox value={value} onChange={setValue} options={[{ value: 'a', label: 'Apple' }]} />
 *
 * `size="lg"` is the roomy form variant (the sell wizard): a 52px trigger,
 * 36px option art and 52px rows, so game logos read at a glance. `md`
 * (default) is unchanged for every other caller.
 */

import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk'
import { Drawer } from 'vaul'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCoarsePointer } from '@/hooks/use-coarse-pointer'

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
  /** Invalid state — paints the trigger border + ring red */
  invalid?: boolean
  /** Called when the trigger loses focus — let parents track touched state */
  onBlur?: () => void
  /**
   * `lime` (default) — house accent on open + a translucent glass panel;
   * every existing caller uses it. `neutral` — for form surfaces (the sell
   * wizard): a plain light border on open and a panel in the card grey.
   */
  tone?: 'lime' | 'neutral'
  /** Show the selected option's icon in the closed trigger (default off). */
  iconInTrigger?: boolean
  /** Classes for option icons (default: 20px square; 36px at size lg). Flags pass a 4:3 box. */
  iconClassName?: string
  /** `md` (default) or the roomy `lg` form variant. */
  size?: 'md' | 'lg'
  /** On touch screens, open as a bottom sheet instead of a popover. */
  sheetOnTouch?: boolean
  /** Sheet heading (touch) — defaults to the aria label. */
  sheetTitle?: string
}

const SIZES = {
  md: {
    trigger: 'h-10 rounded-md border bg-transparent px-3 text-sm',
    triggerGap: 'gap-2',
    triggerIcon: 'h-5 w-5 rounded',
    search: 'gap-2 px-3 py-2',
    searchIcon: 'h-3.5 w-3.5',
    input: 'h-6 text-sm',
    list: 'max-h-72 p-1',
    row: 'gap-2 rounded-md px-2 py-2 text-sm',
    rowIcon: 'h-5 w-5 rounded',
    check: 'h-3.5 w-3.5',
    panel: 'rounded-lg border shadow-elevated',
  },
  lg: {
    trigger:
      'h-12 rounded-[11px] border border-white/[0.07] bg-white/[0.035] px-3.5 text-base font-medium hover:border-white/[0.13] sm:h-[52px] sm:text-[15px]',
    triggerGap: 'gap-3',
    triggerIcon: 'h-8 w-8 rounded-lg',
    search: 'gap-2.5 px-4 py-3.5',
    searchIcon: 'h-4 w-4',
    input: 'h-6 text-base sm:text-[15px]',
    list: 'max-h-[22rem] p-1.5',
    row: 'gap-3 rounded-[10px] px-2.5 py-2 text-[14.5px] font-medium min-h-[52px]',
    rowIcon: 'h-9 w-9 rounded-[9px]',
    check: 'h-4 w-4',
    panel: 'rounded-2xl border border-white/[0.06] bg-[#1F2025] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]',
  },
} as const

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
  invalid,
  onBlur,
  tone = 'lime',
  iconInTrigger = false,
  iconClassName,
  size = 'md',
  sheetOnTouch = false,
  sheetTitle,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  // Phones: open on the list, not the keyboard (see useCoarsePointer).
  const coarse = useCoarsePointer()
  const asSheet = sheetOnTouch && coarse
  const s = SIZES[size]
  const rowIcon = iconClassName ?? s.rowIcon
  const triggerIcon = iconClassName ?? s.triggerIcon

  const sortedOptions = React.useMemo(
    () => (unsorted ? options : [...options].sort((a, b) => a.label.localeCompare(b.label))),
    [options, unsorted],
  )
  const selected = sortedOptions.find((o) => o.value === value) ?? null

  // Stable id linking this combobox to the listbox panel it controls.
  const listboxId = React.useId()

  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const trigger = (
    <div
      role="combobox"
      aria-controls={listboxId}
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-invalid={invalid || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={asSheet && !disabled ? () => setOpen(true) : undefined}
      onBlur={(e) => {
        // Don't fire onBlur when focus moves into the popover panel
        if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return
        onBlur?.()
      }}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault()
          setOpen(true)
        }
      }}
      className={cn(
        'flex w-full cursor-pointer items-center justify-between transition-colors',
        s.trigger,
        size === 'md' && 'border-border-default text-text-primary hover:border-border-strong',
        size === 'lg' && 'text-text-primary',
        open && (tone === 'neutral' ? 'border-text-secondary' : 'border-lime-tint-border'),
        // Invalid (touched + empty) — overrides default border/ring.
        invalid && !open && 'border-error ring-2 ring-error-bg',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span className={cn('flex min-w-0 items-center', s.triggerGap)}>
        {iconInTrigger && selected?.icon_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.icon_url} alt={selected.label} aria-hidden className={cn('shrink-0 object-cover', triggerIcon)} />
        )}
        <span className={cn('truncate', !selected && 'font-normal text-text-tertiary')}>{selected?.label ?? placeholder}</span>
      </span>
      <ChevronDown className={cn('h-4 w-4 shrink-0 text-text-tertiary transition-transform', open && 'rotate-180')} />
    </div>
  )

  const panel = (
    <ComboboxPanel
      listboxId={listboxId}
      options={sortedOptions}
      value={value}
      emptyText={emptyText}
      autoFocusSearch={!coarse}
      size={size}
      rowIconClassName={rowIcon}
      onChoose={choose}
    />
  )

  if (asSheet) {
    return (
      <>
        {trigger}
        <Drawer.Root open={open} onOpenChange={setOpen} repositionInputs={false}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70" />
            <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-[520px] flex-col rounded-t-2xl bg-[#1F2025] pb-[env(safe-area-inset-bottom)] text-text-primary shadow-elevated outline-none">
              <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/15" />
              <Drawer.Title className="px-5 pb-1 pt-3 text-[17px] font-semibold tracking-tight">
                {sheetTitle ?? ariaLabel ?? placeholder}
              </Drawer.Title>
              <Drawer.Description className="sr-only">Search and choose one option.</Drawer.Description>
              <div className="flex min-h-0 flex-1 flex-col">{panel}</div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </>
    )
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          // Match the trigger's width so the panel is the same size as the box above it.
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          className={cn(
            'z-50 overflow-hidden',
            s.panel,
            size === 'md' &&
              (tone === 'neutral'
                ? 'border-border-default bg-bg-overlay'
                : 'border-border-subtle bg-[rgba(12,12,16,0.92)] backdrop-blur-2xl backdrop-saturate-150'),
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
          // Don't refocus the trigger on close.
          onCloseAutoFocus={(e) => e.preventDefault()}
          // Touch: keep focus off the search box so the keyboard stays down.
          onOpenAutoFocus={(e) => {
            if (coarse) e.preventDefault()
          }}
        >
          {panel}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** The search box and option list, shared by the popover and the touch sheet. */
function ComboboxPanel({
  listboxId,
  options,
  value,
  emptyText,
  autoFocusSearch,
  size,
  rowIconClassName,
  onChoose,
}: {
  listboxId: string
  options: ComboboxOption[]
  value: string
  emptyText: string
  autoFocusSearch: boolean
  size: 'md' | 'lg'
  rowIconClassName: string
  onChoose: (v: string) => void
}) {
  const s = SIZES[size]
  // Mounted per open, so each open starts with an empty search.
  const [query, setQuery] = React.useState('')
  return (
    <Command
      shouldFilter
      // Substring match over the label plus keywords (the value and any extras).
      filter={(itemValue, search, keywords) => {
        const q = search.trim().toLowerCase()
        if (!q) return 1
        const hay = (itemValue + ' ' + (keywords?.join(' ') ?? '')).toLowerCase()
        return hay.includes(q) ? 1 : 0
      }}
      className="flex min-h-0 w-full flex-1 flex-col"
    >
      <div className={cn('flex items-center border-b border-border-subtle', s.search)}>
        <Search className={cn('shrink-0 text-text-tertiary', s.searchIcon)} />
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search…"
          autoFocus={autoFocusSearch}
          className={cn(
            'flex-1 border-0 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none focus:outline-none focus-visible:outline-none focus-visible:shadow-none focus-visible:[box-shadow:none]',
            s.input,
          )}
        />
      </div>
      <CommandList id={listboxId} role="listbox" className={cn('overflow-y-auto overscroll-contain', s.list)}>
        <CommandEmpty className="px-3 py-2 text-xs text-text-tertiary">{emptyText}</CommandEmpty>
        <CommandGroup>
          {options.map((o) => {
            const isChecked = o.value === value
            return (
              <CommandItem
                key={o.value}
                value={o.label}
                keywords={[o.value, ...(o.keywords ?? [])]}
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
      </CommandList>
    </Command>
  )
}
