'use server'

/**
 * Admin Values tab (game detail → Values): one hub game's items, counts and
 * catalogue runs (read model src/lib/values/admin-values.ts), and the Eldorado
 * names review: confirm / reject / link (src/lib/values/market-names.ts).
 */
import { requireRole } from '@/lib/actions/admin-permissions'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { ADMIN_VALUES_VIEWS, isAdminValuesGame, loadAdminValues, type AdminValuesPage, type AdminValuesView } from '@/lib/values/admin-values'
import { decideMarketName, loadMarketNameReview, type MarketNameDecision, type MarketNameRow } from '@/lib/values/market-names'

const ROLES = ['admin', 'super_admin'] as const

export async function getAdminValues(
  gameSlug: string,
  opts: { view: AdminValuesView; q: string; page: number },
): Promise<{ ok: true; data: AdminValuesPage } | { ok: false; error: string }> {
  await requireRole([...ROLES])
  if (!isAdminValuesGame(gameSlug)) return { ok: false, error: 'This game has no values hub.' }
  const view = ADMIN_VALUES_VIEWS.includes(opts.view) ? opts.view : 'all'
  try {
    const data = await loadAdminValues(createServiceRoleClient() as any, gameSlug, { view, q: String(opts.q ?? '').slice(0, 80), page: Number(opts.page) || 1 })
    return { ok: true, data }
  } catch (e) {
    console.error('[admin-values]', (e as Error).message)
    return { ok: false, error: (e as Error).message }
  }
}

// ── Eldorado names (the match log, public.market_name_matches) ─────────────

export async function getMarketNameReview(gameSlug: string): Promise<{ ok: true; data: MarketNameRow[] } | { ok: false; error: string }> {
  await requireRole([...ROLES])
  if (!isAdminValuesGame(gameSlug)) return { ok: false, error: 'This game has no values hub.' }
  try {
    return { ok: true, data: await loadMarketNameReview(createServiceRoleClient() as any, gameSlug) }
  } catch (e) {
    console.error('[admin-values] market names', (e as Error).message)
    return { ok: false, error: (e as Error).message }
  }
}

/** Confirm an automatic match, reject a name, or link it to an item. Applies from the next daily price run. */
export async function decideMarketNameAction(
  gameSlug: string,
  marketName: string,
  decision: MarketNameDecision,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireRole([...ROLES])
  if (!isAdminValuesGame(gameSlug)) return { ok: false, error: 'This game has no values hub.' }
  const name = String(marketName ?? '').slice(0, 300)
  const clean: MarketNameDecision =
    decision?.kind === 'link' ? { kind: 'link', itemSlug: String(decision.itemSlug ?? '').slice(0, 200) } : decision?.kind === 'reject' ? { kind: 'reject' } : { kind: 'confirm' }
  try {
    await decideMarketName(createServiceRoleClient() as any, gameSlug, name, clean, admin.userId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
