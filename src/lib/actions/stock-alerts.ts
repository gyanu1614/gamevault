'use server'

/**
 * Notify Me (owner, 2026-10-24): the signed-in visitor's in-stock alerts.
 * stock_alerts is service-role only (migration 20261025014756): the session
 * proves WHO the user is, then the service role writes rows scoped to that
 * user id. Inputs are slugs, validated before any write; the item (and the
 * trait, when one is given) must exist in the game's value catalogue.
 * Rate-limited per user. Async exports only (a 'use server' module).
 *
 * `variant` null = any trait of the item (the items grid); a variant key =
 * only that trait (the pet page's trait picker, migration 20261026233836).
 */
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { getValueCatalog } from '@/lib/value-listings/stock-server'
import { isKnownVariant } from '@/lib/value-listings/item-page'
import { scheduleStockAlertDispatch } from '@/lib/stock-alerts/dispatch'
import { stockAlertKey } from '@/lib/stock-alerts/key'

type Result = { ok: true } | { ok: false; error: string }

const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/
const VARIANT = /^[a-z0-9][a-z0-9-]{0,63}$/
const NOT_FOUND = 'That item could not be found.'

/** Slugs and the optional trait key, checked before anything else runs. */
function validInput(gameSlug: string, itemSlug: string, variant: string | null): boolean {
  return SLUG.test(gameSlug) && SLUG.test(itemSlug) && (variant === null || VARIANT.test(variant))
}
/** Open alerts one account may hold (stops a script filling the table). */
const MAX_OPEN_ALERTS = 200

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

async function resolveGame(gameSlug: string): Promise<string | null> {
  const svc = createServiceRoleClient()
  const { data, error } = await svc.from('games').select('id').eq('slug', gameSlug).eq('is_active', true).maybeSingle()
  if (error) throw new Error(`games: ${error.message}`)
  return (data as { id: string } | null)?.id ?? null
}

export async function setStockAlert(gameSlug: string, itemSlug: string, variant: string | null = null): Promise<Result> {
  if (!validInput(gameSlug, itemSlug, variant)) return { ok: false, error: NOT_FOUND }
  const userId = await sessionUserId()
  if (!userId) return { ok: false, error: 'Sign in to get an alert.' }

  const limit = await checkRateLimit('stockAlert', `user:${userId}`)
  if (limit.limited) return { ok: false, error: 'Too many changes. Try again in a minute.' }

  try {
    const [gameId, catalog] = await Promise.all([resolveGame(gameSlug), getValueCatalog(gameSlug)])
    if (!gameId || !catalog?.items.some((i) => i.slug === itemSlug)) return { ok: false, error: NOT_FOUND }
    if (variant !== null && !isKnownVariant(catalog, variant)) return { ok: false, error: NOT_FOUND }

    const svc = createServiceRoleClient()
    let liveQuery = svc.from('listings').select('id').eq('game_id', gameId).eq('value_item_slug', itemSlug).eq('status', 'active')
    if (variant !== null) liveQuery = liveQuery.eq('value_variant', variant)
    const [{ data: open, error: openErr }, { data: live, error: liveErr }] = await Promise.all([
      svc.from('stock_alerts').select('id').eq('user_id', userId).is('notified_at', null).limit(MAX_OPEN_ALERTS + 1),
      liveQuery.limit(1),
    ])
    if (openErr) throw new Error(`stock_alerts: ${openErr.message}`)
    if (liveErr) throw new Error(`listings: ${liveErr.message}`)
    if ((open?.length ?? 0) >= MAX_OPEN_ALERTS) return { ok: false, error: 'You have too many alerts. Remove a few first.' }

    // Already listed (the page was a moment old): due now, so the email goes out right away.
    const inStock = (live?.length ?? 0) > 0
    const now = new Date().toISOString()
    const { error } = await svc
      .from('stock_alerts')
      .upsert(
        { user_id: userId, game_id: gameId, item_slug: itemSlug, variant, created_at: now, notified_at: null, due_at: inStock ? now : null },
        { onConflict: 'user_id,game_id,item_slug,variant' },
      )
    if (error) throw new Error(`stock_alerts upsert: ${error.message}`)
    if (inStock) scheduleStockAlertDispatch()
    return { ok: true }
  } catch (e) {
    console.error('[stock-alerts] set failed', e instanceof Error ? e.message : e)
    return { ok: false, error: 'Could not set the alert. Try again.' }
  }
}

export async function clearStockAlert(gameSlug: string, itemSlug: string, variant: string | null = null): Promise<Result> {
  if (!validInput(gameSlug, itemSlug, variant)) return { ok: false, error: NOT_FOUND }
  const userId = await sessionUserId()
  if (!userId) return { ok: false, error: 'Sign in to manage alerts.' }

  const limit = await checkRateLimit('stockAlert', `user:${userId}`)
  if (limit.limited) return { ok: false, error: 'Too many changes. Try again in a minute.' }

  try {
    const gameId = await resolveGame(gameSlug)
    if (!gameId) return { ok: true }
    const scoped = createServiceRoleClient().from('stock_alerts').delete().eq('user_id', userId).eq('game_id', gameId).eq('item_slug', itemSlug)
    const { error } = await (variant === null ? scoped.is('variant', null) : scoped.eq('variant', variant))
    if (error) throw new Error(`stock_alerts delete: ${error.message}`)
    return { ok: true }
  } catch (e) {
    console.error('[stock-alerts] clear failed', e instanceof Error ? e.message : e)
    return { ok: false, error: 'Could not remove the alert. Try again.' }
  }
}

/** The visitor's open alerts for one game (stockAlertKey per alert), for the Notify Me buttons' state. */
export async function listMyStockAlerts(gameSlug: string): Promise<{ ok: true; slugs: string[] } | { ok: false }> {
  if (!SLUG.test(gameSlug)) return { ok: false }
  const userId = await sessionUserId()
  if (!userId) return { ok: true, slugs: [] }
  try {
    const gameId = await resolveGame(gameSlug)
    if (!gameId) return { ok: true, slugs: [] }
    const { data, error } = await createServiceRoleClient()
      .from('stock_alerts')
      .select('item_slug, variant')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .is('notified_at', null)
      .limit(MAX_OPEN_ALERTS)
    if (error) throw new Error(error.message)
    return { ok: true, slugs: ((data ?? []) as { item_slug: string; variant: string | null }[]).map((r) => stockAlertKey(r.item_slug, r.variant)) }
  } catch (e) {
    console.error('[stock-alerts] list failed', e instanceof Error ? e.message : e)
    return { ok: false }
  }
}
