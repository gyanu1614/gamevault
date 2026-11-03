'use client'

import type { ModerationHistorySlice } from '@/lib/actions/moderation'
import { ArrowRight, MagnifyingGlass, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import { FilterChip, FilterRow, adminFieldCls } from '../../components/kit'
import { HISTORY_SLICES, type Tab } from './moderation-format'

export interface StatCell {
  label: string
  value: React.ReactNode
  onClick: () => void
}

/** The five clickable numbers; each jumps to its tab / history slice. */
export function StatTiles({ cells }: { cells: StatCell[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/[0.07] md:grid-cols-5">
      {cells.map((cell, i) => (
        <button
          key={cell.label}
          type="button"
          onClick={cell.onClick}
          className={cn(
            'group min-w-0 bg-bg-raised px-4 py-4 text-left transition-colors hover:bg-bg-raised-hover sm:px-5',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus-ring',
            i === 0 && 'col-span-2 md:col-span-1',
          )}
        >
          <span className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-text-secondary">
            <span className="truncate">{cell.label}</span>
            <ArrowRight
              aria-hidden
              weight="bold"
              className="h-3.5 w-3.5 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
            />
          </span>
          <span className="mt-1 block truncate text-[24px] font-bold leading-tight tabular-nums text-text-primary">
            {cell.value}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Tabs + client-side search, then the history slice chips (history tab only). */
export function QueueToolbar({
  tab,
  setTab,
  pendingCount,
  awaitingCount,
  searchQuery,
  setSearchQuery,
  historySlice,
  setHistorySlice,
  setHistoryPage,
}: {
  tab: Tab
  setTab: (tab: Tab) => void
  pendingCount: number
  awaitingCount: number
  searchQuery: string
  setSearchQuery: (query: string) => void
  historySlice: ModerationHistorySlice
  setHistorySlice: (slice: ModerationHistorySlice) => void
  setHistoryPage: (page: number) => void
}) {
  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedTabs<Tab>
          tabs={[
            { id: 'pending', label: <>Pending <TabCount n={pendingCount} /></> },
            { id: 'awaiting', label: <>Awaiting Seller <TabCount n={awaitingCount} /></> },
            { id: 'history', label: 'History' },
          ]}
          value={tab}
          onChange={setTab}
          layoutId="moderation-tabs"
          ariaLabel="Moderation queue"
        />
        <div className="relative w-full lg:max-w-[320px]">
          <MagnifyingGlass
            aria-hidden
            weight="bold"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            aria-label="Search the queue"
            placeholder="Search title, seller, game…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(adminFieldCls, 'pl-10 pr-9')}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
            >
              <X aria-hidden weight="bold" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {tab === 'history' && (
        <FilterRow label="Show">
          {HISTORY_SLICES.map((s) => (
            <FilterChip
              key={s.key}
              selected={historySlice === s.key}
              onClick={() => {
                setHistorySlice(s.key)
                setHistoryPage(1)
              }}
            >
              {s.label}
            </FilterChip>
          ))}
        </FilterRow>
      )}
    </>
  )
}
