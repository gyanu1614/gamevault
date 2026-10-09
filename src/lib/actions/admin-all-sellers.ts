'use server'

/**
 * Admin → Sellers (/admin/all-sellers): every person on the seller journey,
 * not only the ones who finished it.
 *
 * Open signup (2026-10-08) made `profiles.role = 'seller'` the LAST step, so
 * a list keyed on role alone can never show the funnel. This loader unions:
 *   · every `seller_onboarding` row (someone who started /founding), and
 *   · every `profiles.role = 'seller'` (live sellers, including legacy ones
 *     who never had an onboarding row),
 * derives the funnel stage per person from the same inputs /founding uses
 * (`deriveStage`), and batches the stats (listings, completed sales +
 * payout, presence) by id. Paged on the server; filters and search are
 * applied before paging so the counts are exact.
 *
 * Wallet balance is per-seller RPC (`seller_available_balance`), so it is
 * fetched only for the page being shown.
 */
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireRole } from './admin-permissions'
import { deriveStage } from '@/lib/founding/onboarding'
import {
  SELLERS_PAGE_SIZE,
  type AllSellersFilters,
  type AllSellersResult,
  type SellerFunnel,
  type SellerListRow,
} from '@/lib/admin/all-sellers'

/** "Stalled" = started but not live and no step for 3 days. */
const STALL_MS = 3 * 24 * 60 * 60 * 1000

function latestIso(...values: (string | null | undefined)[]): string | null {
  let best: string | null = null
  for (const v of values) {
    if (v && (!best || new Date(v).getTime() > new Date(best).getTime())) best = v
  }
  return best
}

export async function getAllSellers(filters: AllSellersFilters = {}): Promise<AllSellersResult> {
  // Emails, Discord handles and money for every signup: admins only.
  await requireRole(['admin', 'super_admin'])
  const service = createServiceRoleClient() as any

  const [{ data: onboarding }, { data: sellers }] = await Promise.all([
    service
      .from('seller_onboarding')
      .select('user_id, country, sells, discord, is_adult_confirmed_at, store_name, completed_at, updated_at, created_at'),
    service
      .from('profiles')
      .select(
        'id, username, full_name, email, avatar_url, shop_name, shop_slug, seller_tier, seller_status, is_verified, founding_seller, is_test, created_at',
      )
      .eq('role', 'seller'),
  ])

  const onboardingById = new Map<string, any>()
  for (const o of onboarding ?? []) onboardingById.set(o.user_id, o)
  const sellerIds = new Set<string>((sellers ?? []).map((s: any) => s.id))

  // Profiles for people mid-signup who are not sellers yet.
  const pendingIds = [...onboardingById.keys()].filter((id) => !sellerIds.has(id))
  const { data: pendingProfiles } = pendingIds.length
    ? await service
        .from('profiles')
        .select(
          'id, username, full_name, email, avatar_url, shop_name, shop_slug, seller_tier, seller_status, is_verified, founding_seller, is_test, created_at',
        )
        .in('id', pendingIds)
    : { data: [] }

  const people: any[] = [...(sellers ?? []), ...(pendingProfiles ?? [])]
  const ids = people.map((p) => p.id)
  if (ids.length === 0) {
    return { rows: [], total: 0, page: 1, pageSize: SELLERS_PAGE_SIZE, funnel: emptyFunnel() }
  }

  const [{ data: agreements }, { data: listings }, { data: orders }, { data: presence }] = await Promise.all([
    service.from('seller_agreements').select('user_id, signed_at').in('user_id', ids).order('signed_at', { ascending: false }),
    service.from('listings').select('seller_id, status').in('seller_id', ids),
    service.from('orders').select('seller_id, seller_payout').in('seller_id', ids).eq('status', 'completed'),
    service.from('seller_presence').select('seller_id, last_active_at, last_seen_at').in('seller_id', ids),
  ])

  const agreementAt = new Map<string, string>()
  for (const a of agreements ?? []) if (!agreementAt.has(a.user_id)) agreementAt.set(a.user_id, a.signed_at)
  const activeListings = new Map<string, number>()
  const anyListing = new Set<string>()
  for (const l of listings ?? []) {
    anyListing.add(l.seller_id)
    if (l.status === 'active' || l.status === 'pending_approval') activeListings.set(l.seller_id, (activeListings.get(l.seller_id) ?? 0) + 1)
  }
  const sales = new Map<string, { n: number; sum: number }>()
  for (const o of orders ?? []) {
    const cur = sales.get(o.seller_id) ?? { n: 0, sum: 0 }
    cur.n += 1
    cur.sum += Number(o.seller_payout ?? 0)
    sales.set(o.seller_id, cur)
  }
  const presenceById = new Map<string, any>()
  for (const p of presence ?? []) presenceById.set(p.seller_id, p)

  const rows: SellerListRow[] = people.map((p) => {
    const o = onboardingById.get(p.id)
    const isSeller = sellerIds.has(p.id)
    const sells = Array.isArray(o?.sells) ? o.sells.map((s: any) => (typeof s === 'string' ? s : s?.slug ?? s?.name)).filter(Boolean) : []
    const details = Boolean(o?.country && o?.is_adult_confirmed_at && sells.length > 0)
    const store = Boolean(o?.store_name)
    const agreement = agreementAt.has(p.id)
    const stage = deriveStage({ signedIn: true, isSeller, details, store, agreement })
    const s = sales.get(p.id)
    const pr = presenceById.get(p.id)
    return {
      id: p.id,
      username: p.username ?? null,
      full_name: p.full_name ?? null,
      email: p.email ?? null,
      avatar_url: p.avatar_url ?? null,
      shop_name: p.shop_name ?? o?.store_name ?? null,
      shop_slug: p.shop_slug ?? null,
      seller_tier: p.seller_tier ?? null,
      seller_status: p.seller_status ?? null,
      is_verified: Boolean(p.is_verified),
      founding_seller: Boolean(p.founding_seller),
      is_test: Boolean(p.is_test),
      signed_up_at: o?.created_at ?? p.created_at,
      stage,
      milestone: s && s.n > 0 ? 'sold' : anyListing.has(p.id) ? 'listed' : 'none',
      country: o?.country ?? null,
      discord: o?.discord ?? null,
      sells,
      agreement_signed_at: agreementAt.get(p.id) ?? null,
      completed_at: o?.completed_at ?? null,
      last_active_at: latestIso(pr?.last_active_at, pr?.last_seen_at, o?.updated_at),
      stats: {
        active_listings: activeListings.get(p.id) ?? 0,
        completed_sales: s?.n ?? 0,
        revenue: s?.sum ?? 0,
        balance_usd: null,
      },
    }
  })

  // Funnel over everyone (before filters), so the strip is the whole picture.
  const funnel: SellerFunnel = {
    signed_up: rows.length,
    details: rows.filter((r) => r.stage >= 3).length,
    store: rows.filter((r) => r.stage >= 4).length,
    agreement: rows.filter((r) => r.agreement_signed_at || r.stage === 5).length,
    live: rows.filter((r) => r.stage === 5).length,
    listed: rows.filter((r) => r.milestone !== 'none').length,
    sold: rows.filter((r) => r.milestone === 'sold').length,
    verified: rows.filter((r) => r.stage === 5 && r.is_verified).length,
    founding: rows.filter((r) => r.founding_seller).length,
  }

  // Filters + search, then newest first, then page.
  const q = (filters.q ?? '').trim().toLowerCase()
  const now = Date.now()
  let filtered = rows
  switch (filters.stage ?? 'all') {
    case 'in_progress':
      filtered = filtered.filter((r) => r.stage < 5)
      break
    case 'live':
      filtered = filtered.filter((r) => r.stage === 5)
      break
    case 'listed':
      filtered = filtered.filter((r) => r.milestone !== 'none')
      break
    case 'sold':
      filtered = filtered.filter((r) => r.milestone === 'sold')
      break
    case 'stalled':
      filtered = filtered.filter((r) => r.stage < 5 && now - new Date(r.last_active_at ?? r.signed_up_at).getTime() > STALL_MS)
      break
  }
  if (filters.trust === 'verified') filtered = filtered.filter((r) => r.is_verified)
  if (filters.trust === 'new') filtered = filtered.filter((r) => !r.is_verified)
  if (filters.founding) filtered = filtered.filter((r) => r.founding_seller)
  if (q) {
    filtered = filtered.filter((r) =>
      [r.username, r.full_name, r.shop_name, r.email, r.discord, r.country].some((v) => v && v.toLowerCase().includes(q)),
    )
  }
  filtered.sort((a, b) => new Date(b.signed_up_at).getTime() - new Date(a.signed_up_at).getTime())

  const total = filtered.length
  const pageSize = SELLERS_PAGE_SIZE
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, filters.page ?? 1), maxPage)
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  // Balance for the visible live sellers only (one RPC each, in parallel).
  await Promise.all(
    pageRows
      .filter((r) => r.stage === 5)
      .map(async (r) => {
        try {
          const { data } = await service.rpc('seller_available_balance', { p_seller_id: r.id, p_currency: 'USD' })
          r.stats.balance_usd = typeof data === 'number' ? data / 100 : Number(data ?? 0) / 100
        } catch {
          r.stats.balance_usd = null
        }
      }),
  )

  return { rows: pageRows, total, page, pageSize, funnel }
}

function emptyFunnel(): SellerFunnel {
  return { signed_up: 0, details: 0, store: 0, agreement: 0, live: 0, listed: 0, sold: 0, verified: 0, founding: 0 }
}
