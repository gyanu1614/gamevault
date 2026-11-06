/**
 * The wallet's one feed: every movement of a person's money, newest first, by day. It
 * replaces three tables that repeated the Orders pages. Built in the browser from the
 * lists the wallet already reads, so it adds no database call of its own.
 */
import type { WithdrawalRequest } from '@/lib/actions/withdrawals'

export type ActivityFilter = 'all' | 'sales' | 'withdrawals' | 'purchases'
export type ActivityKind = 'sale' | 'purchase' | 'withdrawal'

export interface ActivityRow {
  id: string
  kind: ActivityKind
  at: string
  title: string
  sub: string
  /** Signed: money in is positive. */
  amount: number
  /** It never moved, or moved back: a refund, a declined withdrawal. */
  voided: boolean
  status: string
  href: string | null
  imageUrl: string | null
  /** Lower-cased words the search box looks through. */
  haystack: string
  request?: WithdrawalRequest
}

export interface SaleInput {
  id: string
  orderId: string
  orderNumber?: string
  buyerUsername?: string
  netAmount: number
  status: string
  createdAt: string
  listingTitle: string
  gameName?: string
  gameImageUrl?: string | null
  listingImageUrl?: string | null
}

export interface PurchaseInput {
  id: string
  orderId: string
  orderNumber?: string
  amount: number
  status: string
  createdAt: string
  title: string
  gameName?: string
  gameImageUrl?: string | null
  listingImageUrl?: string | null
}

const VOID_ORDER = new Set(['refunded', 'cancelled', 'failed'])
const VOID_WITHDRAWAL = new Set(['rejected', 'cancelled', 'failed'])

const joined = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(' · ')
const words = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(' ').toLowerCase()

export function toActivity(input: { sales?: SaleInput[]; purchases?: PurchaseInput[]; requests?: WithdrawalRequest[] }): ActivityRow[] {
  const sales: ActivityRow[] = (input.sales ?? []).map((s) => ({
    id: `sale:${s.id}`,
    kind: 'sale',
    at: s.createdAt,
    title: s.listingTitle,
    sub: joined('Sale', s.gameName, s.buyerUsername),
    amount: Number(s.netAmount) || 0,
    voided: VOID_ORDER.has(s.status),
    status: s.status,
    href: `/account/orders/${s.orderId}`,
    imageUrl: s.listingImageUrl || s.gameImageUrl || null,
    haystack: words(s.listingTitle, s.gameName, s.buyerUsername, s.orderNumber, 'sale'),
  }))
  const purchases: ActivityRow[] = (input.purchases ?? []).map((p) => ({
    id: `purchase:${p.id}`,
    kind: 'purchase',
    at: p.createdAt,
    title: p.title,
    sub: joined('Purchase', p.gameName),
    amount: -(Number(p.amount) || 0),
    voided: VOID_ORDER.has(p.status),
    status: p.status,
    href: `/account/orders/${p.orderId}`,
    imageUrl: p.listingImageUrl || p.gameImageUrl || null,
    haystack: words(p.title, p.gameName, p.orderNumber, 'purchase'),
  }))
  const requests: ActivityRow[] = (input.requests ?? []).map((r) => {
    const name = r.method?.display_name ?? r.method_name
    return {
      id: `withdrawal:${r.id}`,
      kind: 'withdrawal',
      at: r.created_at,
      title: `Withdrawal To ${name}`,
      sub: `You receive $${Number(r.net_amount).toFixed(2)}`,
      amount: -(Number(r.amount) || 0),
      voided: VOID_WITHDRAWAL.has(r.status),
      status: r.status,
      href: null,
      imageUrl: null,
      haystack: words(name, r.method_name, 'withdrawal payout'),
      request: r,
    }
  })
  return [...sales, ...purchases, ...requests].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id))
}

const FILTER_KIND: Record<Exclude<ActivityFilter, 'all'>, ActivityKind> = { sales: 'sale', withdrawals: 'withdrawal', purchases: 'purchase' }

export function filterActivity(rows: readonly ActivityRow[], filter: ActivityFilter, query: string): ActivityRow[] {
  const q = query.trim().toLowerCase()
  return rows.filter((r) => (filter === 'all' || r.kind === FILTER_KIND[filter]) && (!q || r.haystack.includes(q)))
}

/** $ with its sign, as a bank statement writes it. */
export function signedMoney(amount: number): string {
  return `${amount < 0 ? '−' : '+'}$${Math.abs(amount).toFixed(2)}`
}

export interface ActivityDay {
  key: string
  label: string
  rows: ActivityRow[]
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Runs of one day, in the viewer's own time zone. Rows are already newest first. */
export function groupByDay(rows: readonly ActivityRow[], now: Date): ActivityDay[] {
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const days: ActivityDay[] = []
  for (const row of rows) {
    const d = new Date(row.at)
    const key = dayKey(d)
    let day = days[days.length - 1]
    if (!day || day.key !== key) {
      const label =
        key === today
          ? 'Today'
          : key === yesterday
            ? 'Yesterday'
            : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
      day = { key, label, rows: [] }
      days.push(day)
    }
    day.rows.push(row)
  }
  return days
}
