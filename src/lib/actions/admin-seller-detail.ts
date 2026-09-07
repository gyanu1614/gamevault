'use server'

/**
 * Admin — seller detail (/admin/active-sellers/[id]).
 *
 * One aggregated read (getSellerDetail) + the management mutations that
 * belong to the seller-management hub: tier changes, in-app messages and
 * ad-hoc emails. Restrict/ban lives in admin-seller-restrictions.ts and
 * withdrawal decisions in withdrawals.ts — this module only aggregates
 * their data for display.
 */

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireAdmin, requireRole } from '@/lib/actions/admin-permissions'
import { logAdminActivity } from '@/lib/admin/activity-log'

// ─── Types ───────────────────────────────────────────────────────────────────

// Tier ladder comes from the single source of truth. ('use server' files may
// only export async functions, so re-export the type but keep the array local.)
import { TIER_KEYS, DEFAULT_TIER, type SellerTier } from '@/lib/seller/tiers'

const SELLER_TIERS = TIER_KEYS

export type { SellerTier }

export interface SellerDetailProfile {
  id: string
  username: string | null
  full_name: string | null
  email: string | null
  avatar_url: string | null
  shop_name: string | null
  shop_slug: string | null
  role: string | null
  seller_tier: string
  seller_status: string
  seller_restriction_reason: string | null
  seller_restricted_at: string | null
  kyc_status: string | null
  founding_seller: boolean
  is_test: boolean
  created_at: string
  total_sales: number
  seller_rating: number | null
  total_reviews: number
}

export interface SellerListingRow {
  id: string
  title: string
  price: number
  status: string
  created_at: string
  game_name: string | null
}

export interface SellerOrderRow {
  id: string
  order_number: string | null
  total_amount: number
  seller_payout: number
  status: string
  created_at: string
}

export interface SellerBalance {
  currency: string
  /** Major units (RPCs return minor units — already divided by 100 here). */
  amount: number
}

export interface SellerWalletTransaction {
  id: string
  type: string
  amount: number
  description: string | null
  status: string | null
  created_at: string
}

export interface SellerWithdrawalRow {
  id: string
  amount: number
  net_amount: number | null
  method_name: string | null
  status: string
  created_at: string
}

export interface SellerRestrictionRow {
  id: string
  restriction_type: string
  reason: string | null
  created_at: string
  admin: { username: string | null; email: string | null } | null
}

export interface SellerTierHistoryRow {
  id: string
  previous_tier: string | null
  new_tier: string
  reason: string
  notes: string | null
  created_at: string
}

export interface SellerTierConfigRow {
  tier: string
  display_name: string | null
  commission_rate: number | null
  listing_limit: number | null
  pre_moderation_listings: number | null
  badge_color: string | null
  sort_order: number | null
}

export interface SellerReviewRow {
  id: string
  rating: number | null
  title: string | null
  comment: string | null
  created_at: string
}

export interface SellerDetail {
  profile: SellerDetailProfile
  presence: {
    store_paused: boolean
    /**
     * GREATEST of seller_presence.last_active_at / last_seen_at and the
     * auth user's last_sign_in_at — presence heartbeats only run on some
     * pages and go stale, so a login today must win over old heartbeats.
     */
    last_active_at: string | null
  }
  listings: {
    countsByStatus: Record<string, number>
    recent: SellerListingRow[]
  }
  orders: {
    totalOrders: number
    completedCount: number
    /** SUM(seller_payout) over completed orders. */
    revenue: number
    /** SUM(total_amount) over completed orders. */
    gmv: number
    /** % of non-cancelled/refunded orders that completed (100 when none). */
    completionRate: number
    recent: SellerOrderRow[]
  }
  wallet: {
    sellerBalances: SellerBalance[]
    storeCreditBalances: SellerBalance[]
    transactions: SellerWalletTransaction[]
  }
  withdrawals: SellerWithdrawalRow[]
  restrictions: SellerRestrictionRow[]
  tier: {
    history: SellerTierHistoryRow[]
    configs: SellerTierConfigRow[]
    /** RPC get_seller_tier_info — null when the RPC is unavailable. */
    info: {
      current_tier: string
      eligible_tier: string
      commission_rate: number | null
      listing_limit: number | null
      banner_access: boolean | null
      next_tier: string | null
    } | null
  }
  reviews: SellerReviewRow[]
  /** Original seller application, when the seller came through the flow. */
  application: { id: string; status: string; reviewed_at: string | null } | null
}

const BALANCE_CURRENCIES = ['EUR', 'USD'] as const

/** Latest of several ISO timestamps (nulls skipped); null when all missing. */
function latestIso(...values: (string | null | undefined)[]): string | null {
  let best: string | null = null
  let bestMs = -Infinity
  for (const v of values) {
    if (!v) continue
    const ms = new Date(v).getTime()
    if (Number.isFinite(ms) && ms > bestMs) {
      bestMs = ms
      best = v
    }
  }
  return best
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getSellerDetail(userId: string): Promise<{
  success: boolean
  detail?: SellerDetail
  error?: string
}> {
  try {
    await requireAdmin()

    const service = createServiceRoleClient()

    const [
      profileRes,
      presenceRes,
      listingsRes,
      ordersRes,
      sellerBalancesRes,
      walletBalancesRes,
      walletTxRes,
      withdrawalsRes,
      restrictionsRes,
      tierHistoryRes,
      tierConfigRes,
      tierInfoRes,
      reviewsRes,
      applicationRes,
      authUserRes,
    ] = await Promise.all([
      service
        .from('profiles')
        .select(
          'id, username, full_name, email, avatar_url, shop_name, shop_slug, role, seller_tier, seller_status, seller_restriction_reason, seller_restricted_at, kyc_status, founding_seller, is_test, created_at, total_sales, seller_rating, total_reviews',
        )
        .eq('id', userId)
        .maybeSingle() as any,
      service
        .from('seller_presence')
        .select('store_paused, last_active_at, last_seen_at')
        .eq('seller_id', userId)
        .maybeSingle() as any,
      service
        .from('listings')
        .select('id, title, price, status, created_at, game:games!listings_game_id_fkey(name)')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false }) as any,
      service
        .from('orders')
        .select('id, order_number, total_amount, seller_payout, status, created_at')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false }) as any,
      Promise.all(
        BALANCE_CURRENCIES.map(async (currency) => {
          const { data, error } = await (service.rpc as any)('seller_available_balance', {
            p_seller_id: userId,
            p_currency: currency,
          })
          if (error) {
            console.error(`seller_available_balance(${currency}) failed:`, error.message)
            return { currency, amount: 0 }
          }
          return { currency, amount: Number(data ?? 0) / 100 }
        }),
      ),
      Promise.all(
        BALANCE_CURRENCIES.map(async (currency) => {
          const { data, error } = await (service.rpc as any)('user_wallet_balance', {
            p_user_id: userId,
            p_currency: currency,
          })
          if (error) {
            console.error(`user_wallet_balance(${currency}) failed:`, error.message)
            return { currency, amount: 0 }
          }
          return { currency, amount: Number(data ?? 0) / 100 }
        }),
      ),
      service
        .from('wallet_transactions')
        .select('id, type, amount, description, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(15) as any,
      (service.from('withdrawal_requests' as any) as any)
        .select('id, amount, net_amount, method_name, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      service
        .from('seller_restrictions')
        .select('id, restriction_type, reason, created_at, admin:restricted_by(username, email)')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false }) as any,
      (service.from('seller_tier_history' as any) as any)
        .select('id, previous_tier, new_tier, reason, notes, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      service
        .from('seller_tier_config')
        .select('tier, display_name, commission_rate, listing_limit, pre_moderation_listings, badge_color, sort_order')
        .order('sort_order', { ascending: true }) as any,
      (service.rpc as any)('get_seller_tier_info', { p_user_id: userId }),
      service
        .from('reviews')
        .select('id, rating, title, comment, created_at')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
        .limit(5) as any,
      service
        .from('seller_applications')
        .select('id, status, reviewed_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as any,
      // Auth record: last_sign_in_at — the presence heartbeat only runs on
      // some pages, so a fresh login must be able to win "last active".
      service.auth.admin
        .getUserById(userId)
        .catch(() => ({ data: { user: null }, error: null })) as any,
    ])

    const profile = profileRes.data
    if (profileRes.error || !profile) {
      return { success: false, error: 'Seller not found' }
    }

    // Listings: fold counts by status, keep the 8 most recent.
    const listingRows: any[] = listingsRes.data ?? []
    const countsByStatus: Record<string, number> = {}
    for (const l of listingRows) {
      countsByStatus[l.status] = (countsByStatus[l.status] ?? 0) + 1
    }

    // Orders: revenue / GMV / completion rate (seller-tiers.ts formula —
    // completed / non-(cancelled|refunded), 100% with no orders).
    const orderRows: any[] = ordersRes.data ?? []
    let completedCount = 0
    let revenue = 0
    let gmv = 0
    let countable = 0
    for (const o of orderRows) {
      if (o.status === 'completed') {
        completedCount++
        revenue += Number(o.seller_payout ?? 0)
        gmv += Number(o.total_amount ?? 0)
      }
      if (o.status !== 'cancelled' && o.status !== 'refunded') countable++
    }
    const completionRate =
      countable === 0 ? 100 : Math.round((completedCount / countable) * 1000) / 10

    const detail: SellerDetail = {
      profile: {
        id: profile.id,
        username: profile.username ?? null,
        full_name: profile.full_name ?? null,
        email: profile.email ?? null,
        avatar_url: profile.avatar_url ?? null,
        shop_name: profile.shop_name ?? null,
        shop_slug: profile.shop_slug ?? null,
        role: profile.role ?? null,
        seller_tier: profile.seller_tier || DEFAULT_TIER,
        seller_status: profile.seller_status || 'active',
        seller_restriction_reason: profile.seller_restriction_reason ?? null,
        seller_restricted_at: profile.seller_restricted_at ?? null,
        kyc_status: profile.kyc_status ?? null,
        founding_seller: profile.founding_seller === true,
        is_test: profile.is_test === true,
        created_at: profile.created_at,
        total_sales: Number(profile.total_sales ?? 0),
        seller_rating: profile.seller_rating != null ? Number(profile.seller_rating) : null,
        total_reviews: Number(profile.total_reviews ?? 0),
      },
      presence: {
        store_paused: !!presenceRes.data?.store_paused,
        // GREATEST(presence heartbeats, auth last_sign_in_at) — see interface.
        last_active_at: latestIso(
          presenceRes.data?.last_active_at,
          presenceRes.data?.last_seen_at,
          authUserRes?.data?.user?.last_sign_in_at,
        ),
      },
      listings: {
        countsByStatus,
        recent: listingRows.slice(0, 8).map((l) => ({
          id: l.id,
          title: l.title,
          price: Number(l.price ?? 0),
          status: l.status,
          created_at: l.created_at,
          game_name: l.game?.name ?? null,
        })),
      },
      orders: {
        totalOrders: orderRows.length,
        completedCount,
        revenue,
        gmv,
        completionRate,
        recent: orderRows.slice(0, 10).map((o) => ({
          id: o.id,
          order_number: o.order_number ?? null,
          total_amount: Number(o.total_amount ?? 0),
          seller_payout: Number(o.seller_payout ?? 0),
          status: o.status,
          created_at: o.created_at,
        })),
      },
      wallet: {
        sellerBalances: sellerBalancesRes as SellerBalance[],
        storeCreditBalances: walletBalancesRes as SellerBalance[],
        transactions: (walletTxRes.data ?? []).map((t: any) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount ?? 0),
          description: t.description ?? null,
          status: t.status ?? null,
          created_at: t.created_at,
        })),
      },
      withdrawals: (withdrawalsRes.data ?? []).map((w: any) => ({
        id: w.id,
        amount: Number(w.amount ?? 0),
        net_amount: w.net_amount != null ? Number(w.net_amount) : null,
        method_name: w.method_name ?? null,
        status: w.status,
        created_at: w.created_at,
      })),
      restrictions: (restrictionsRes.data ?? []).map((r: any) => ({
        id: r.id,
        restriction_type: r.restriction_type,
        reason: r.reason ?? null,
        created_at: r.created_at,
        admin: r.admin
          ? { username: r.admin.username ?? null, email: r.admin.email ?? null }
          : null,
      })),
      tier: {
        history: (tierHistoryRes.data ?? []).map((h: any) => ({
          id: h.id,
          previous_tier: h.previous_tier ?? null,
          new_tier: h.new_tier,
          reason: h.reason,
          notes: h.notes ?? null,
          created_at: h.created_at,
        })),
        configs: (tierConfigRes.data ?? []).map((c: any) => ({
          tier: c.tier,
          display_name: c.display_name ?? null,
          commission_rate: c.commission_rate != null ? Number(c.commission_rate) : null,
          listing_limit: c.listing_limit != null ? Number(c.listing_limit) : null,
          pre_moderation_listings:
            c.pre_moderation_listings != null ? Number(c.pre_moderation_listings) : null,
          badge_color: c.badge_color ?? null,
          sort_order: c.sort_order != null ? Number(c.sort_order) : null,
        })),
        info:
          !tierInfoRes.error && tierInfoRes.data
            ? {
                current_tier: tierInfoRes.data.current_tier,
                eligible_tier: tierInfoRes.data.eligible_tier,
                commission_rate:
                  tierInfoRes.data.commission_rate != null
                    ? Number(tierInfoRes.data.commission_rate)
                    : null,
                listing_limit:
                  tierInfoRes.data.listing_limit != null
                    ? Number(tierInfoRes.data.listing_limit)
                    : null,
                banner_access: tierInfoRes.data.banner_access ?? null,
                next_tier: tierInfoRes.data.next_tier ?? null,
              }
            : null,
      },
      reviews: (reviewsRes.data ?? []).map((r: any) => ({
        id: r.id,
        rating: r.rating != null ? Number(r.rating) : null,
        title: r.title ?? null,
        comment: r.comment ?? null,
        created_at: r.created_at,
      })),
      application: applicationRes.data
        ? {
            id: applicationRes.data.id,
            status: applicationRes.data.status,
            reviewed_at: applicationRes.data.reviewed_at ?? null,
          }
        : null,
    }

    return { success: true, detail }
  } catch (error: any) {
    console.error('Error in getSellerDetail:', error)
    return { success: false, error: error.message || 'Failed to load the seller' }
  }
}

// ─── Tier change ─────────────────────────────────────────────────────────────

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

export async function changeSellerTier(params: {
  userId: string
  newTier: string
  notes?: string
}): Promise<{
  success: boolean
  previousTier?: string
  newTier?: string
  error?: string
}> {
  try {
    const admin = await requireRole(['admin', 'super_admin'])
    const { userId, notes } = params
    const newTier = params.newTier as SellerTier

    if (!SELLER_TIERS.includes(newTier)) {
      return { success: false, error: 'Invalid tier' }
    }

    const service = createServiceRoleClient()

    const { data: profile, error: profileError } = (await service
      .from('profiles')
      .select('id, username, shop_name, seller_tier, total_sales, seller_rating')
      .eq('id', userId)
      .maybeSingle()) as any

    if (profileError || !profile) {
      return { success: false, error: 'Seller not found' }
    }

    const previousTier: string = profile.seller_tier || DEFAULT_TIER
    if (previousTier === newTier) {
      return { success: true, previousTier, newTier }
    }

    const { error: updateError } = await (service.from('profiles').update as any)({
      seller_tier: newTier,
    }).eq('id', userId)

    if (updateError) {
      console.error('Error updating seller tier:', updateError)
      return { success: false, error: 'Failed to update the tier' }
    }

    const upgrade =
      SELLER_TIERS.indexOf(newTier) > SELLER_TIERS.indexOf(previousTier as SellerTier)

    const { error: historyError } = await (service
      .from('seller_tier_history' as any)
      .insert as any)({
      user_id: userId,
      previous_tier: previousTier,
      new_tier: newTier,
      reason: upgrade ? 'manual_upgrade' : 'manual_downgrade',
      total_sales_at_change: Number(profile.total_sales ?? 0),
      seller_rating_at_change: profile.seller_rating ?? null,
      changed_by: admin.userId,
      notes: notes?.trim() || null,
    })
    if (historyError) {
      // Non-fatal: the tier itself changed; history is best-effort.
      console.error('Error recording tier history:', historyError)
    }

    await logAdminActivity({
      action: upgrade ? 'seller_tier_upgraded' : 'seller_tier_downgraded',
      actionCategory: 'seller',
      resourceType: 'profile',
      resourceId: userId,
      resourceName: profile.shop_name || profile.username || undefined,
      previousState: { seller_tier: previousTier },
      newState: { seller_tier: newTier },
      notes: notes?.trim() || undefined,
    })

    // Tell the seller (notifications has NO metadata column — don't pass one).
    const { error: notifError } = await (service.from('notifications').insert as any)({
      user_id: userId,
      type: 'seller_tier_changed',
      title: 'Your Seller Tier Changed',
      message: `Your seller tier is now ${tierLabel(newTier)}${
        upgrade ? ' — congratulations!' : ''
      } Your commission rate and listing limits have been updated to match.`,
      link: '/account/tiers',
      is_read: false,
    })
    if (notifError) {
      console.error('Error notifying seller of tier change:', notifError)
    }

    revalidatePath('/admin/active-sellers')
    revalidatePath(`/admin/active-sellers/${userId}`)

    return { success: true, previousTier, newTier }
  } catch (error: any) {
    console.error('Error in changeSellerTier:', error)
    return { success: false, error: error.message || 'Failed to change the tier' }
  }
}

// ─── Comms ───────────────────────────────────────────────────────────────────

export async function messageSeller(params: {
  userId: string
  message: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireRole(['admin', 'super_admin'])

    const message = params.message.trim()
    if (!message) return { success: false, error: 'Message is empty' }
    if (message.length > 500) return { success: false, error: 'Keep it under 500 characters' }

    const service = createServiceRoleClient()

    const { error } = await (service.from('notifications').insert as any)({
      user_id: params.userId,
      type: 'admin_message',
      title: 'Message From The DropMarket Team',
      message,
      // Deep link: the status page auto-opens the team chat on arrival.
      link: '/account/seller-status?openMessages=1',
      is_read: false,
    })
    if (error) throw error

    await logAdminActivity({
      action: 'seller_messaged',
      actionCategory: 'seller',
      resourceType: 'profile',
      resourceId: params.userId,
      notes: message.slice(0, 200),
      metadata: { admin_email: admin.email },
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error in messageSeller:', error)
    return { success: false, error: 'Could not send the message' }
  }
}

export async function emailSeller(params: {
  userId: string
  subject: string
  body: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireRole(['admin', 'super_admin'])

    const subject = params.subject.trim()
    const body = params.body.trim()
    if (!subject) return { success: false, error: 'Subject is empty' }
    if (subject.length > 150) return { success: false, error: 'Keep the subject under 150 characters' }
    if (!body) return { success: false, error: 'Email body is empty' }
    if (body.length > 3000) return { success: false, error: 'Keep the body under 3000 characters' }

    const service = createServiceRoleClient()
    const { data: profile } = (await service
      .from('profiles')
      .select('email, username, full_name, shop_name')
      .eq('id', params.userId)
      .maybeSingle()) as any

    if (!profile?.email) {
      return { success: false, error: 'This seller has no email address on file' }
    }

    const { sendAdminNoticeEmail } = await import('@/lib/email')
    const result = await sendAdminNoticeEmail({
      to: profile.email,
      name: profile.full_name || profile.username || 'there',
      subject,
      bodyText: body,
    })
    if (!result.success) {
      return { success: false, error: 'The email could not be sent' }
    }

    await logAdminActivity({
      action: 'seller_emailed',
      actionCategory: 'seller',
      resourceType: 'profile',
      resourceId: params.userId,
      resourceName: profile.shop_name || profile.username || undefined,
      notes: subject,
      metadata: { admin_email: admin.email },
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error in emailSeller:', error)
    return { success: false, error: 'Could not send the email' }
  }
}
