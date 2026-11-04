/**
 * Pure formatting helpers + shared class strings for the seller detail screen
 * (SellerDetailClient and the section / dialog files beside it). No React here.
 */

import { balanceLabel as sharedBalanceLabel } from '@/lib/seller/format-amount'
import type { ChipTone } from '../../components/kit'

/** UTC-pinned so server and client format the identical string. */
export function fmtDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function relativeTime(iso: string | null | undefined, now: number | null): string {
  if (!iso || now == null) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const mins = Math.max(0, Math.round((now - then) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€' }

export function balanceLabel(balances: { currency: string; amount: number }[]): string {
  return sharedBalanceLabel(balances, CURRENCY_SYMBOL)
}

export function titleCase(s: string): string {
  return s
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

/** Generic status → badge tone. */
export function statusTone(status: string): ChipTone {
  switch (status) {
    case 'active':
    case 'completed':
    case 'approved':
    case 'sold':
      return 'success'
    case 'pending':
    case 'pending_approval':
    case 'changes_requested':
    case 'processing':
    case 'paid':
    case 'delivering':
    case 'delivered':
    case 'paused':
      return 'warning'
    case 'rejected':
    case 'cancelled':
    case 'refunded':
    case 'disputed':
    case 'failed':
    case 'banned':
      return 'error'
    default:
      return 'neutral'
  }
}

/** Sub-heading inside a card. */
export const INNER_LABEL = 'mb-2 text-[13px] font-semibold text-text-secondary'

/** Rows inside a card, hairlines between. */
export const ROWS = 'divide-y divide-white/[0.06]'

export const FIELD_LABEL = 'mb-1.5 block text-[13px] font-medium text-text-secondary'

export const FLAG = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold'
