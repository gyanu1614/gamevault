/**
 * The admin's headline numbers: ONE cached database call shared by the dashboard,
 * analytics, orders and disputes screens (admin_overview_stats, migration
 * 20261103131903). They used to run ~40 count queries and walk every order, 1,000
 * rows per request, on every visit.
 *
 * The numbers are the same for every staff member, so one cache entry serves them
 * all for 60 seconds. Callers MUST check the staff member first: the cached read
 * itself uses the service role, because unstable_cache cannot touch cookies.
 * A failed read throws and is not cached.
 *
 * Not a 'use server' module: nothing here is callable from the browser.
 */

import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { utcPeriods } from '@/lib/admin/periods'
import { timed } from '@/lib/admin/timing'
import {
  COLLECTED_ORDER_STATUSES,
  FINISHED_DISPUTE_STATUSES,
  IN_PROGRESS_ORDER_STATUSES,
  OPEN_DISPUTE_STATUSES,
} from '@/lib/admin/status-sets'

export const ADMIN_OVERVIEW_CACHE_SECONDS = 60

export interface AdminOverviewStats {
  orders: {
    total: number
    today: number
    week: number
    month: number
    prev_month: number
    in_progress: number
    completed: number
    disputed: number
    refunded: number
    guest: number
    revenue_total: number
    revenue_today: number
    revenue_month: number
    revenue_prev_month: number
    fees_total: number
    charged_total: number
    charged_month: number
    charged_prev_month: number
    avg_completed_value: number
    distinct_buyers: number
  }
  daily: { date: string; revenue: number; orders: number }[]
  profiles: { total: number; today: number; month: number; prev_month: number; sellers: number }
  listings: { total: number; active: number; month: number }
  promos: { usages: number; total_discount: number }
  disputes: {
    total: number
    open_all: number
    finished: number
    open: number
    under_review: number
    escalated: number
    awaiting_response: number
    today: number
    urgent_open: number
    resolved_week: number
  }
  applications: { pending: number; approved: number; approved_today: number; rejected: number }
  fraud: { open: number; high: number }
  pending_cancellations: number
  top_sellers: { username: string | null; total_sales: number | null; lifetime_earnings: number | null }[]
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

async function readOverview(dayKey: string): Promise<AdminOverviewStats> {
  const { todayStart, monthStart, prevMonthStart } = utcPeriods(new Date(`${dayKey}T00:00:00.000Z`))
  const { data, error } = await timed('admin_overview_stats', () => (createServiceRoleClient().rpc as any)('admin_overview_stats', {
    p_today: todayStart.toISOString(),
    // The rolling week starts from the day, so one cache entry serves all of it.
    p_week: new Date(todayStart.getTime() - WEEK_MS).toISOString(),
    p_month: monthStart.toISOString(),
    p_prev_month: prevMonthStart.toISOString(),
    p_collected: [...COLLECTED_ORDER_STATUSES],
    p_in_progress: [...IN_PROGRESS_ORDER_STATUSES],
    p_open_disputes: [...OPEN_DISPUTE_STATUSES],
    p_finished_disputes: [...FINISHED_DISPUTE_STATUSES],
  })) as any
  if (error) throw new Error(`admin_overview_stats: ${error.message}`)
  return data as AdminOverviewStats
}

/**
 * Call only after requireAdmin / requireRole / requirePermission. Today (UTC) is
 * part of the cache key: a new day never serves yesterday's "today".
 */
export function getAdminOverviewStats(now: Date = new Date()): Promise<AdminOverviewStats> {
  return unstable_cache(readOverview, ['admin-overview-stats-v1'], {
    revalidate: ADMIN_OVERVIEW_CACHE_SECONDS,
  })(now.toISOString().slice(0, 10))
}
