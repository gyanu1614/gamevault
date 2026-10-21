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
 * `searchInTrigger` (the sell form, 2026-10-12): no separate search bar —
 * the field itself becomes the search box (caret in place, the field name as
 * placeholder) and the list opens attached under it. Touch screens keep the
 * bottom sheet with its own search, so the keyboard never covers the list.
 *
 * Search runs outside cmdk (combobox-filter): one lower-cased index per
 * options list and at most RENDER_CAP rendered rows, so 800+ names open and
 * filter instantly.
 *
 *   <Combobox value={value} onChange={setValue} options={[{ value: 'a', label: 'Apple' }]} />
 *
 * `size="lg"` is the roomy form variant (the sell wizard): a 52px trigger,
 * 36px option art and 52px rows, so game logos read at a glance. `md`
 * (default) is unchanged for every other caller.
 */

import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Command, CommandInput } from 'cmdk'
import { Drawer } from 'vaul'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCoarsePointer } from '@/hooks/use-coarse-pointer'
import { SIZES } from './combobox-sizes'
import { OptionList } from './combobox-list'
import { InlineCombobox } from './combobox-inline'

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
  /** Type straight into the field; the list opens attached under it (desktop). */
  searchInTrigger?: boolean
  /**
   * Your own trigger instead of the field (e.g. a "Change" text link): it
   * gets the open wiring and the panel opens at least 280px wide.
   */
  renderTrigger?: (state: { open: boolean; selected: ComboboxOption | null }) => React.ReactElement
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
  invalid,
  onBlur,
  tone = 'lime',
  iconInTrigger = false,
  iconClassName,
  size = 'md',
  sheetOnTouch = false,
  sheetTitle,
  searchInTrigger = false,
  renderTrigger,
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

  if (searchInTrigger && !asSheet && !renderTrigger) {
    return (
      <InlineCombobox
        open={open}
        setOpen={setOpen}
        options={sortedOptions}
        selected={selected}
        value={value}
        onChoose={choose}
        placeholder={placeholder}
        emptyText={emptyText}
        ariaLabel={ariaLabel}
        listboxId={listboxId}
        invalid={invalid}
        disabled={disabled}
        onBlur={onBlur}
        iconInTrigger={iconInTrigger}
        triggerIcon={triggerIcon}
        rowIcon={rowIcon}
        size={size}
        className={className}
      />
    )
  }

  const trigger = renderTrigger ? (
    React.cloneElement(renderTrigger({ open, selected }) as React.ReactElement<Record<string, unknown>>, {
      'aria-haspopup': 'listbox',
      'aria-expanded': open,
      'aria-controls': listboxId,
      ...(asSheet && !disabled ? { onClick: () => setOpen(true) } : {}),
    })
  ) : (
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
          style={{ width: renderTrigger ? 'max(var(--radix-popover-trigger-width), 280px)' : 'var(--radix-popover-trigger-width)' }}
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
    <Command shouldFilter={false} className="flex min-h-0 w-full flex-1 flex-col">
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
      <OptionList
        listboxId={listboxId}
        options={options}
        query={query}
        value={value}
        emptyText={emptyText}
        size={size}
        rowIconClassName={rowIconClassName}
        onChoose={onChoose}
      />
    </Command>
  )
}
