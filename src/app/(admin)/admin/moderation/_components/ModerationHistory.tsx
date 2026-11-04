'use client'

import type { ModerationHistoryRow } from '@/lib/actions/moderation'
import { ArrowRight, Tray } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useNow } from '@/hooks/use-now'
import {
  AdminEmpty,
  AdminLoadingRows,
  AdminPagination,
  StatusBadge,
  adminBtn,
  type ChipTone,
} from '../../components/kit'
import { ErrorPanel } from './ErrorPanel'
import { ListingThumb } from './ModerationThumbs'
import { money, relativeTime } from './moderation-format'

/** The History tab: error, loading, empty, or one panel of rows + pagination. */
export function ModerationHistory({
  isError,
  isPending,
  isFetching,
  errorMessage,
  onRetry,
  historyRows,
  q,
  onViewQueue,
  historyPage,
  historyTotalPages,
  historyTotal,
  historyPageSize,
  setHistoryPage,
}: {
  isError: boolean
  isPending: boolean
  isFetching: boolean
  errorMessage?: string
  onRetry: () => void
  historyRows: ModerationHistoryRow[]
  /** The trimmed, lower-cased search text. */
  q: string
  onViewQueue: () => void
  historyPage: number
  historyTotalPages: number
  historyTotal: number
  historyPageSize: number
  setHistoryPage: (page: number) => void
}) {
  return isError ? (
    <ErrorPanel message={errorMessage} onRetry={onRetry} retrying={isFetching} />
  ) : isPending ? (
    <AdminLoadingRows rows={6} />
  ) : historyRows.length === 0 ? (
    <AdminEmpty
      icon={Tray}
      title="No Decisions Here"
      hint={q ? 'No history rows match your search.' : 'Nothing recorded for this filter yet.'}
      action={
        <button type="button" onClick={onViewQueue} className={adminBtn.secondary}>
          View Queue
          <ArrowRight aria-hidden weight="bold" className="h-4 w-4" />
        </button>
      }
    />
  ) : (
    <div className="space-y-4">
      <div
        className={cn(
          'divide-y divide-white/[0.06] overflow-hidden rounded-lg bg-bg-raised',
          isFetching && 'opacity-60 transition-opacity',
        )}
      >
        {/* Column headers (desktop) */}
        <div className="hidden items-center gap-3 px-4 py-3 text-[12px] font-medium text-text-tertiary md:flex">
          <span className="w-11 shrink-0" />
          <span className="min-w-0 flex-1">Listing</span>
          <span className="w-[140px] shrink-0">Seller</span>
          <span className="w-[180px] shrink-0">Decided</span>
          <span className="w-[150px] shrink-0 text-right">Decision</span>
        </div>
        {historyRows.map((row) => (
          <HistoryRowCard key={`${row.id}-${row.decision}`} row={row} />
        ))}
      </div>
      <AdminPagination
        page={historyPage}
        totalPages={historyTotalPages}
        total={historyTotal}
        limit={historyPageSize}
        onPage={setHistoryPage}
        noun="decisions"
      />
    </div>
  )
}

// ─── History row ─────────────────────────────────────────────────────────────

const DECISION: Record<ModerationHistoryRow['decision'], { label: string; tone: ChipTone }> = {
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'error' },
  changes_requested: { label: 'Changes Requested', tone: 'warning' },
}

function HistoryRowCard({ row }: { row: ModerationHistoryRow }) {
  const now = useNow()
  const decision = DECISION[row.decision] ?? { label: row.decision, tone: 'neutral' as ChipTone }
  const decided = `by ${row.decidedBy || 'Unknown'}${row.decidedAt && now != null ? ` · ${relativeTime(row.decidedAt, now)}` : ''}`

  return (
    <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
      <ListingThumb listing={row} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[13.5px] font-semibold text-text-primary">{row.title}</p>
          <StatusBadge status={decision.label} tone={decision.tone} className="shrink-0 md:hidden" />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-text-tertiary">
          {row.price != null && (
            <span className="font-semibold tabular-nums text-text-secondary">{money(row.price)}</span>
          )}
          <span className="truncate">
            {row.game?.name}
            {row.category?.name ? ` · ${row.category.name}` : ''}
          </span>
          <span className="truncate md:hidden">
            {row.seller || '—'} · {decided}
          </span>
          {row.reason && (
            <span className="max-w-full truncate italic md:max-w-[360px]" title={row.reason}>
              “{row.reason}”
            </span>
          )}
        </div>
      </div>

      <p className="hidden w-[140px] shrink-0 truncate text-[13px] font-medium text-text-secondary md:block">
        {row.seller || '—'}
      </p>
      <p className="hidden w-[180px] shrink-0 truncate text-[12.5px] text-text-tertiary md:block">{decided}</p>
      <div className="hidden w-[150px] shrink-0 justify-end md:flex">
        <StatusBadge status={decision.label} tone={decision.tone} />
      </div>
    </div>
  )
}
