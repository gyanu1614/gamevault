/**
 * Review state machine for trend-radar games. Called by the admin server
 * actions (which add requireAdmin + revalidation) and by the guard test.
 *
 *   pending   --approve--> approved (is_active = true, Discord alert → live)
 *   pending   --reject---> rejected (note; no re-alert for rejectSuppressDays)
 *   pending   --snooze---> pending  (review_snoozed_until = now + 7d)
 *   declining --approve--> approved (note cleared)
 *   declining --reject---> rejected
 *   rejected  --approve--> approved (owner can revive)
 *
 * Reject/snooze are refused on an approved game: taking a live game down is
 * the existing "Active" toggle's job, not a review button's.
 */
import { liveFollowupPayload, markLive, patchWebhookMessage, postWebhook, trendAlertPayload } from './discord'
import type { TaxonomyDraft } from './fandom'
import { RADAR_CATEGORY_SLUGS } from './slug'
import { DAYS, type Db } from './store'

export const REVIEWABLE = ['pending', 'declining'] as const
export const APPROVABLE = ['pending', 'declining', 'rejected'] as const

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface ReviewGame {
  id: string
  slug: string
  name: string
  is_active: boolean | null
  review_status: string
  review_note: string | null
  review_snoozed_until: string | null
  trend_detected_at: string | null
  trend_peak_playing: number | null
  image_url: string | null
  source: string | null
}

export interface ReviewEvent {
  id: string
  signal: string
  value: number
  flags: Record<string, any>
  created_at: string
  discord_message_id: string | null
}

export interface ReviewData {
  game: ReviewGame
  externalId: string | null
  events: ReviewEvent[]
  draft: TaxonomyDraft | null
  prepare: Record<string, unknown> | null
  metrics: { captured_at: string; playing: number }[]
  categories: string[]
}

export async function loadReview(db: Db, gameId: string, now: Date = new Date()): Promise<ReviewData | null> {
  const { data: game, error } = await db
    .from('games')
    .select('id, slug, name, is_active, review_status, review_note, review_snoozed_until, trend_detected_at, trend_peak_playing, image_url, source')
    .eq('id', gameId)
    .maybeSingle()
  if (error) throw new Error(`games read failed: ${error.message}`)
  if (!game) return null

  const [{ data: ext }, { data: events }, { data: cats }] = await Promise.all([
    db.from('game_external_ids').select('external_id').eq('game_id', gameId).eq('platform', 'roblox').maybeSingle(),
    db.from('trend_events').select('id, signal, value, flags, draft, created_at, discord_message_id').eq('game_id', gameId).order('created_at', { ascending: true }),
    db.from('game_categories').select('is_enabled, global_category:global_categories!game_categories_global_category_id_fkey(slug)').eq('game_id', gameId),
  ])
  const externalId = (ext as any)?.external_id ?? null
  const evs = ((events ?? []) as any[])
  const withDraft = evs.find((e) => e.draft)
  const withPrepare = [...evs].reverse().find((e) => e.flags?.prepare)

  let metrics: { captured_at: string; playing: number }[] = []
  if (externalId) {
    const { data: m } = await db
      .from('game_metrics')
      .select('captured_at, playing')
      .eq('platform', 'roblox')
      .eq('external_id', externalId)
      .gte('captured_at', new Date(now.getTime() - 7 * DAYS).toISOString())
      .lte('captured_at', now.toISOString())
      .order('captured_at', { ascending: true })
    metrics = ((m ?? []) as any[]).map((r) => ({ captured_at: r.captured_at, playing: r.playing }))
  }

  return {
    game: game as ReviewGame,
    externalId,
    events: evs.map(({ draft: _d, ...e }) => e as ReviewEvent),
    draft: (withDraft?.draft as TaxonomyDraft) ?? null,
    prepare: (withPrepare?.flags?.prepare as Record<string, unknown>) ?? null,
    metrics,
    categories: ((cats ?? []) as any[]).map((c) => c.global_category?.slug).filter(Boolean),
  }
}

export interface ReviewOpts {
  now?: Date
  webhookUrl?: string | null
  siteUrl?: string
  fetchImpl?: FetchLike
}

export type ReviewResult =
  | { ok: true; slug: string; liveUrl?: string; discord?: 'updated' | 'skipped' | 'failed' }
  | { ok: false; error: string }

async function current(db: Db, gameId: string): Promise<ReviewGame | null> {
  const { data, error } = await db
    .from('games')
    .select('id, slug, name, is_active, review_status, review_note, review_snoozed_until, trend_detected_at, trend_peak_playing, image_url, source')
    .eq('id', gameId)
    .maybeSingle()
  if (error) throw new Error(`games read failed: ${error.message}`)
  return (data as ReviewGame) ?? null
}

export async function approveGame(db: Db, gameId: string, opts: ReviewOpts = {}): Promise<ReviewResult> {
  const { now = new Date(), webhookUrl = null, siteUrl = '', fetchImpl } = opts
  const game = await current(db, gameId)
  if (!game) return { ok: false, error: 'Game not found' }
  if (!(APPROVABLE as readonly string[]).includes(game.review_status)) {
    return { ok: false, error: `Cannot approve a game that is ${game.review_status}` }
  }

  const { error } = await db
    .from('games')
    .update({ is_active: true, review_status: 'approved', review_note: null, review_snoozed_until: null })
    .eq('id', gameId)
    .in('review_status', [...APPROVABLE])
  if (error) return { ok: false, error: error.message }

  const liveUrl = `${siteUrl}/${game.slug}`
  let discord: 'updated' | 'skipped' | 'failed' = 'skipped'
  if (webhookUrl) {
    const { data: ev } = await db
      .from('trend_events')
      .select('id, signal, value, flags, discord_message_id')
      .eq('game_id', gameId)
      .not('discord_message_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    const messageId = (ev as any)?.discord_message_id as string | undefined
    if (messageId && messageId !== 'sent') {
      const flags = ((ev as any).flags ?? {}) as Record<string, any>
      const rebuilt = trendAlertPayload({
        name: game.name,
        slug: game.slug,
        universeId: 0,
        playingNow: Number(flags.playingNow ?? game.trend_peak_playing ?? 0),
        playing48hAgo: flags.playing48hAgo ? Number(flags.playing48hAgo) : null,
        signals: [(ev as any).signal],
        rank: (ev as any).signal === 'top30_entry' ? Number((ev as any).value) : null,
        adminUrl: `${siteUrl}/admin/games?status=pending#${game.slug}`,
        robloxUrl: flags.rootPlaceId ? `https://www.roblox.com/games/${flags.rootPlaceId}` : 'https://www.roblox.com',
        iconUrl: game.image_url,
        categories: [...RADAR_CATEGORY_SLUGS],
        wikiFound: Boolean(flags.prepare?.wiki),
        flags,
      })
      const patched = await patchWebhookMessage(webhookUrl, messageId, markLive(rebuilt, liveUrl), { fetchImpl })
      const followed = await postWebhook(webhookUrl, liveFollowupPayload(game.name, liveUrl), { fetchImpl })
      discord = patched && followed.ok ? 'updated' : 'failed'
    } else {
      const followed = await postWebhook(webhookUrl, liveFollowupPayload(game.name, liveUrl), { fetchImpl })
      discord = followed.ok ? 'updated' : 'failed'
    }
  }

  void now
  return { ok: true, slug: game.slug, liveUrl, discord }
}

export async function rejectGame(db: Db, gameId: string, note: string, opts: ReviewOpts = {}): Promise<ReviewResult> {
  const game = await current(db, gameId)
  if (!game) return { ok: false, error: 'Game not found' }
  if (!(REVIEWABLE as readonly string[]).includes(game.review_status)) {
    return { ok: false, error: `Cannot reject a game that is ${game.review_status}` }
  }
  const trimmed = note.trim()
  if (!trimmed) return { ok: false, error: 'A note is required to reject' }
  const { error } = await db
    .from('games')
    .update({ is_active: false, review_status: 'rejected', review_note: trimmed.slice(0, 500), review_snoozed_until: null })
    .eq('id', gameId)
    .in('review_status', [...REVIEWABLE])
  if (error) return { ok: false, error: error.message }
  void opts
  return { ok: true, slug: game.slug }
}

export async function snoozeGame(db: Db, gameId: string, opts: ReviewOpts & { days?: number } = {}): Promise<ReviewResult> {
  const { now = new Date(), days = 7 } = opts
  const game = await current(db, gameId)
  if (!game) return { ok: false, error: 'Game not found' }
  if (!(REVIEWABLE as readonly string[]).includes(game.review_status)) {
    return { ok: false, error: `Cannot snooze a game that is ${game.review_status}` }
  }
  const until = new Date(now.getTime() + days * DAYS).toISOString()
  const { error } = await db
    .from('games')
    .update({ review_snoozed_until: until })
    .eq('id', gameId)
    .in('review_status', [...REVIEWABLE])
  if (error) return { ok: false, error: error.message }
  return { ok: true, slug: game.slug }
}

export async function loadReviewCounts(db: Db): Promise<{ pending: number; declining: number }> {
  const [{ count: pending }, { count: declining }] = await Promise.all([
    db.from('games').select('id', { count: 'exact' }).eq('review_status', 'pending').limit(1),
    db.from('games').select('id', { count: 'exact' }).eq('review_status', 'declining').limit(1),
  ])
  return { pending: pending ?? 0, declining: declining ?? 0 }
}
