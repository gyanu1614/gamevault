import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { fetchValueListings, getItemsPair, getValueCatalog } from '@/lib/value-listings/stock-server'

/**
 * Notify Me's one rule: an item is "listed" only when its page would show an
 * offer (owner, 2026-11-04: emailed "Frost Fury Is Listed" while the only listing
 * was from a paused store, which the site hides). Same read as the item page,
 * including its re-check of the stored link, then the sellers no public page shows:
 * paused stores and test accounts.
 *
 * Those two are read fresh rather than from the cached getHiddenSellerIds: a store
 * un-paused in this same request must already count. A failed read throws, because
 * "could not check" must never read as "not listed".
 */
export async function itemHasVisibleOffer(gameSlug: string, itemSlug: string, variant: string | null): Promise<boolean> {
  const [pair, catalog] = await Promise.all([getItemsPair(gameSlug), getValueCatalog(gameSlug)])
  if (!pair) return false
  const rows = await fetchValueListings(pair, itemSlug, [], catalog)
  const sellers = [...new Set(rows.filter((r) => variant === null || r.value_variant === variant).map((r) => String(r.seller_id)))]
  if (sellers.length === 0) return false

  const svc = createServiceRoleClient()
  const [paused, test] = await Promise.all([
    svc.from('seller_presence').select('seller_id').in('seller_id', sellers).eq('store_paused', true),
    svc.from('public_profiles').select('id').in('id', sellers).eq('is_test', true),
  ])
  if (paused.error) throw new Error(`seller_presence: ${paused.error.message}`)
  if (test.error) throw new Error(`public_profiles: ${test.error.message}`)

  const hidden = new Set<string>([
    ...((paused.data ?? []) as Array<{ seller_id: string }>).map((p) => p.seller_id),
    ...((test.data ?? []) as Array<{ id: string }>).map((t) => t.id),
  ])
  return sellers.some((s) => !hidden.has(s))
}
