'use server'

/**
 * Admin review actions for trend-radar games (/admin/games → Pending).
 * Thin: auth + service client + revalidation (+ the SEO change log on approve);
 * the state machine lives in
 * lib/trend-radar/review.ts where the guard test exercises it directly.
 */
import { submitGameIfLive } from '@/lib/seo/indexnow'
import { revalidatePath, revalidateTag } from 'next/cache'
import { SITE_URL } from '@/config/site'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { GAME_DIRECTORY_TAG } from '@/lib/marketplace/gameDirectoryCache'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { approveGame, loadReview, loadReviewCounts, rejectGame, snoozeGame, type ReviewData } from '@/lib/trend-radar/review'

export type { ReviewData }

export async function fetchTrendReview(gameId: string): Promise<ReviewData | null> {
  await requireAdmin()
  return loadReview(createServiceRoleClient(), gameId)
}

export async function fetchTrendReviewCounts(): Promise<{ pending: number; declining: number }> {
  await requireAdmin()
  return loadReviewCounts(createServiceRoleClient())
}

export async function approveTrendGame(gameId: string) {
  await requireAdmin()
  const service = createServiceRoleClient()
  const res = await approveGame(service, gameId, {
    webhookUrl: process.env.DISCORD_TREND_RADAR_WEBHOOK_URL ?? null,
    siteUrl: SITE_URL,
  })
  if (res.ok) {
    revalidatePath('/admin/games')
    revalidatePath(`/${res.slug}`)
    // Footer game directory renders on every route (unstable_cache).
    revalidateTag(GAME_DIRECTORY_TAG)
    // The game just went live: log its indexable pages to the SEO change log
    // (IndexNow via /api/cron/seo-indexnow) — the same verdicts as the pages'
    // robots meta. Approving used to ping nothing.
    await submitGameIfLive(service, gameId)
  }
  return res
}

export async function rejectTrendGame(gameId: string, note: string) {
  await requireAdmin()
  const res = await rejectGame(createServiceRoleClient(), gameId, note)
  if (res.ok) revalidatePath('/admin/games')
  return res
}

export async function snoozeTrendGame(gameId: string) {
  await requireAdmin()
  const res = await snoozeGame(createServiceRoleClient(), gameId, { days: 7 })
  if (res.ok) revalidatePath('/admin/games')
  return res
}
