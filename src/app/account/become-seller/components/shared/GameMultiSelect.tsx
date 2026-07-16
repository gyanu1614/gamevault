/**
 * GameMultiSelect — searchable multi-select over the DB games list.
 *
 * Extends the ui/combobox pattern (radix popover + cmdk) with checkbox rows,
 * removable selected chips, and game artwork/emoji icons. Values are the
 * real game UUIDs from the games table.
 */

'use client'

import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk'
import { Check, ChevronDown, Search, X, Gamepad2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WizardGame } from '../../types'

interface GameMultiSelectProps {
  games: WizardGame[]
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  invalid?: boolean
}

export default function GameMultiSelect({
  games,
  selected,
  onChange,
  placeholder = 'Search And Select Games…',
  invalid,
}: GameMultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  React.useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id))
    else onChange([...selected, id])
  }

  const selectedGames = games.filter((g) => selected.includes(g.id))

  return (
    <div>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <div
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-label="Select the games you will sell"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault()
                setOpen(true)
              }
            }}
            className={cn(
              'flex h-10 w-full cursor-pointer items-center justify-between rounded-md border bg-transparent px-3 text-sm transition-colors',
              'border-border-default text-text-primary hover:border-border-strong',
              open && 'border-lime-tint-border ring-1 ring-lime/30',
              invalid && !open && 'border-error ring-2 ring-error-bg'
            )}
          >
            <span className={cn('truncate', selected.length === 0 && 'text-text-tertiary')}>
              {selected.length === 0
                ? placeholder
                : `${selected.length} ${selected.length === 1 ? 'Game' : 'Games'} Selected`}
            </span>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-text-tertiary transition-transform', open && 'rotate-180')}
            />
          </div>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            style={{ width: 'var(--radix-popover-trigger-width)' }}
            className={cn(
              'z-50 overflow-hidden rounded-lg border border-border-subtle shadow-elevated',
              'bg-[rgba(12,12,16,0.92)] backdrop-blur-2xl backdrop-saturate-150',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
            )}
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
              <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                <CommandInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search games…"
                  autoFocus
                  className="h-6 flex-1 border-0 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:outline-none focus-visible:outline-none focus-visible:shadow-none focus-visible:[box-shadow:none]"
                />
              </div>
              <CommandList className="max-h-64 overflow-y-auto p-1">
                <CommandEmpty className="px-3 py-2 text-xs text-text-tertiary">
                  No games found — use the Other field below.
                </CommandEmpty>
                <CommandGroup>
                  {games.map((game) => {
                    const isChecked = selected.includes(game.id)
                    return (
                      <CommandItem
                        key={game.id}
                        value={game.name}
                        keywords={[game.slug]}
                        onSelect={() => toggle(game.id)}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none',
                          'text-text-secondary',
                          'data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-text-primary'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                            isChecked ? 'border-lime bg-lime' : 'border-white/30 bg-white/5'
                          )}
                        >
                          {isChecked && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
                        </span>
                        {game.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={game.image_url} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
                        ) : game.emoji ? (
                          <span className="w-5 shrink-0 text-center text-sm">{game.emoji}</span>
                        ) : (
                          <Gamepad2 className="h-4 w-4 shrink-0 text-text-tertiary" />
                        )}
                        <span className="flex-1 truncate">{game.name}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Selected chips */}
      {selectedGames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedGames.map((game) => (
            <span
              key={game.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-overlay py-1 pl-2 pr-1 text-xs text-text-secondary"
            >
              {game.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={game.image_url} alt="" className="h-3.5 w-3.5 rounded-sm object-cover" />
              ) : game.emoji ? (
                <span className="text-[11px] leading-none">{game.emoji}</span>
              ) : null}
              <span className="max-w-[140px] truncate text-white">{game.name}</span>
              <button
                type="button"
                onClick={() => toggle(game.id)}
                aria-label={`Remove ${game.name}`}
                className="rounded p-0.5 text-text-tertiary transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
