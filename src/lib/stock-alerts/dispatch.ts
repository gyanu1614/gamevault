import 'server-only'
import { waitUntil } from '@vercel/functions'
import { SITE_URL } from '@/config/site'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getItemsPair, getValueCatalog } from '@/lib/value-listings/stock-server'
import { itemBuyHref } from '@/lib/value-listings/buy-state'
import { variantLabel } from '@/lib/value-listings/catalogs'
import { sendStockAlertEmail } from '@/lib/email/stock-alert'
import { itemHasVisibleOffer } from './visible-offer'

/**
 * Notify Me dispatch. The listings trigger marks alerts due when a listing of
 * the item goes live; this claims due alerts atomically (stock_alerts_claim_due,
 * so concurrent runs never double-send), emails each user once and releases a
 * claim whose email failed so the next run retries it.
 *
 * The trigger only knows a listing went live, not whether the site shows it, so
 * every claim is checked first (itemHasVisibleOffer). An item the site doesn't
 * show gets no email and the alert goes back to waiting: a store coming back from
 * Offline Mode or the next listing marks it due again.
 *
 * A trait alert names the trait ("Neon Fly Ride Parrot") and links to the pet
 * page with that trait picked; an any-trait alert links to the pet page.
 *
 * Runs right after every listing mutation that touches a value item
 * (revalidateListingSurfaces → scheduleStockAlertDispatch, after the response
 * via waitUntil) and from the daily cron as the backstop. Never throws.
 */
interface Claimed {
  id: string
  user_id: string
  game_id: string
  item_slug: string
  variant: string | null
}

interface GameInfo {
  names: Map<string, { name: string; imageUrl: string | null }>
  mutations: ReadonlyArray<{ slug: string; name: string }>
  categorySlug: string | null
}

export async function sendDueStockAlerts(limit = 50): Promise<{ sent: number; failed: number; waiting: number }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { sent: 0, failed: 0, waiting: 0 }
  const svc = createServiceRoleClient()
  const { data, error } = await (svc.rpc as unknown as (fn: string, args: object) => Promise<{ data: Claimed[] | null; error: { message: string } | null }>)(
    'stock_alerts_claim_due',
    { p_limit: limit },
  )
  if (error) throw new Error(`stock_alerts_claim_due: ${error.message}`)
  const claimed = data ?? []
  if (claimed.length === 0) return { sent: 0, failed: 0, waiting: 0 }

  const gameIds = [...new Set(claimed.map((c) => c.game_id))]
  const userIds = [...new Set(claimed.map((c) => c.user_id))]
  const [{ data: games, error: gErr }, { data: users, error: uErr }] = await Promise.all([
    svc.from('games').select('id, slug, name, image_url').in('id', gameIds),
    svc.from('profiles').select('id, email, username').in('id', userIds),
  ])
  if (gErr || uErr) {
    await release(claimed.map((c) => c.id))
    throw new Error(`stock alert lookups: ${(gErr ?? uErr)!.message}`)
  }
  const gameById = new Map((games ?? []).map((g: { id: string; slug: string; name: string; image_url: string | null }) => [g.id, g]))
  const userById = new Map((users ?? []).map((u: { id: string; email: string | null; username: string | null }) => [u.id, u]))

  // One catalogue + items page per game (cached reads).
  const perGame = new Map<string, GameInfo>()
  await Promise.all(
    [...gameById.values()].map(async (g) => {
      const [catalog, pair] = await Promise.all([getValueCatalog(g.slug), getItemsPair(g.slug)])
      perGame.set(g.id, {
        names: new Map((catalog?.items ?? []).map((i) => [i.slug, { name: i.name, imageUrl: i.imageUrl ?? null }])),
        mutations: catalog?.mutations ?? [],
        categorySlug: pair?.categorySlug ?? null,
      })
    }),
  )

  // One check per item and trait, however many buyers are waiting for it.
  const checks = new Map<string, Promise<boolean>>()
  const offerShows = (gameSlug: string, itemSlug: string, variant: string | null) => {
    const key = `${gameSlug}|${itemSlug}|${variant ?? ''}`
    let check = checks.get(key)
    if (!check) {
      check = itemHasVisibleOffer(gameSlug, itemSlug, variant)
      checks.set(key, check)
    }
    return check
  }

  let sent = 0
  const failedIds: string[] = []
  const waitingIds: string[] = []
  await Promise.all(
    claimed.map(async (c) => {
      const game = gameById.get(c.game_id)
      const user = userById.get(c.user_id)
      const info = perGame.get(c.game_id)
      const item = info?.names.get(c.item_slug)
      if (!game || !user?.email || !info?.categorySlug || !item) {
        // Nothing to send (no email on file, item gone): the alert is done.
        return
      }
      let shown: boolean
      try {
        shown = await offerShows(game.slug, c.item_slug, c.variant)
      } catch (e) {
        console.error('[stock-alerts] visibility check failed', c.id, e instanceof Error ? e.message : e)
        failedIds.push(c.id)
        return
      }
      if (!shown) {
        waitingIds.push(c.id)
        return
      }
      const trait = c.variant && c.variant !== 'default' ? variantLabel(game.slug, c.variant, info.mutations) : null
      try {
        await sendStockAlertEmail({
          to: user.email,
          name: user.username,
          itemName: trait ? `${trait} ${item.name}` : item.name,
          gameName: game.name,
          url: `${SITE_URL}${itemBuyHref({ gameSlug: game.slug, categorySlug: info.categorySlug, itemSlug: c.item_slug, variant: c.variant })}`,
          imageUrl: item.imageUrl ?? game.image_url,
        })
        sent += 1
      } catch (e) {
        console.error('[stock-alerts] email failed', c.id, e instanceof Error ? e.message : e)
        failedIds.push(c.id)
      }
    }),
  )
  if (failedIds.length > 0) await release(failedIds)
  if (waitingIds.length > 0) await backToWaiting(waitingIds)
  return { sent, failed: failedIds.length, waiting: waitingIds.length }
}

/** Put claimed alerts back in the queue (their email did not go out). */
async function release(ids: string[]) {
  const { error } = await createServiceRoleClient().from('stock_alerts').update({ notified_at: null }).in('id', ids)
  if (error) console.error('[stock-alerts] release failed', error.message)
}

/** Not due after all (the site doesn't show the item): the alert stays open and waits for the next trigger. */
async function backToWaiting(ids: string[]) {
  const { error } = await createServiceRoleClient().from('stock_alerts').update({ due_at: null, notified_at: null }).in('id', ids)
  if (error) console.error('[stock-alerts] back to waiting failed', error.message)
}

/** Send due alerts after the current response (Vercel waitUntil); never blocks or throws. */
export function scheduleStockAlertDispatch(): void {
  const run = sendDueStockAlerts().catch((e) => console.error('[stock-alerts] dispatch failed', e instanceof Error ? e.message : e))
  try {
    waitUntil(run)
  } catch {
    // Outside a request context (scripts, tests): the promise still runs.
  }
}
