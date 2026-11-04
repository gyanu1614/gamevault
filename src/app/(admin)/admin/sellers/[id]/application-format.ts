import type { ChipTone } from '../../components/kit'

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function fmtDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function fmtDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  return `${d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

/** 'top-up' / 'game_coins' → 'Top Up' / 'Game Coins' (Title Case). */
export function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export function isImageFile(name: string | null | undefined): boolean {
  return !!name && /\.(png|jpe?g|webp|gif|avif)$/i.test(name)
}

export const STATUS_TONE: Record<string, ChipTone> = {
  pending: 'warning',
  under_review: 'warning',
  info_requested: 'info',
  approved: 'success',
  rejected: 'error',
  withdrawn: 'neutral',
}

export const FIELD_LABEL = 'mb-1.5 block text-[13px] font-medium text-text-secondary'

/** Approved → success, Declined/rejected/failed → error, anything else → warning. */
export function diditTone(status: string): ChipTone {
  const s = status.toLowerCase()
  if (s.includes('approved')) return 'success'
  if (s.includes('declined') || s.includes('rejected') || s.includes('failed')) return 'error'
  return 'warning'
}
