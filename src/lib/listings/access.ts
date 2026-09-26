/**
 * "May this account sell?" — the app-side reading of the database's
 * `sell_access_kind(uuid)` (migration 20260925204757). One answer for the
 * middleware, the publish / edit actions, the image upload and the DB
 * trigger + RLS, so none of them can drift from the others.
 *
 *   seller          role = 'seller' and seller_status = 'active'
 *   seller_blocked  role = 'seller' but restricted / banned
 *   admin           active admin / super_admin (parity with the INSERT policy)
 *   applicant       no seller role, application pending / under review /
 *                   info requested — may build DRAFTS only (GRO-08)
 *   none            everyone else
 *
 * A JWT caller is pinned to its own id inside the function; the id passed
 * here only matters for the service role.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type SellAccessKind = 'seller' | 'seller_blocked' | 'admin' | 'applicant' | 'none'

type Client = Pick<SupabaseClient<any, any, any, any, any>, 'rpc'>

export const SELL_ACCESS_DENIED = 'Only approved, active sellers can publish listings.'
export const SELL_ACCESS_BLOCKED = 'Your seller account is restricted — listings cannot be created or published right now.'

export async function sellAccessKind(supabase: Client, userId: string): Promise<SellAccessKind> {
  const { data, error } = await supabase.rpc('sell_access_kind', { p_user: userId })
  if (error) throw new Error(`sell_access_kind: ${error.message}`)
  const kind = data as string | null
  return (['seller', 'seller_blocked', 'admin', 'applicant', 'none'] as const).includes(kind as SellAccessKind)
    ? (kind as SellAccessKind)
    : 'none'
}

/** May publish / activate / edit listings (ACC-01, AUTH-009, BUG-16). */
export function canPublish(kind: SellAccessKind): boolean {
  return kind === 'seller' || kind === 'admin'
}

/** May use the sell surfaces at all: the wizard, image uploads, drafts (ACC-07/08, GRO-08). */
export function canUseSellSurface(kind: SellAccessKind): boolean {
  return canPublish(kind) || kind === 'applicant'
}

/** Error string when the account may not publish, else null. */
export function publishDenialMessage(kind: SellAccessKind): string | null {
  if (canPublish(kind)) return null
  return kind === 'seller_blocked' ? SELL_ACCESS_BLOCKED : SELL_ACCESS_DENIED
}

/**
 * AUTH-009 / ACC-01 — the gate every publish AND edit path runs first.
 * Returns an error string or null.
 */
export async function publishDenialFor(supabase: Client, userId: string): Promise<string | null> {
  return publishDenialMessage(await sellAccessKind(supabase, userId))
}
