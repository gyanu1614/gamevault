/**
 * Moderation Actions
 *
 * Server actions for admin listing moderation. Every action is gated by
 * requireModerator() (admin / super_admin / moderator via admin_roles) and
 * writes an admin_activity_log entry (category 'moderation') on decisions.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { DEFAULT_TIER } from '@/lib/seller/tiers'
import { logAdminActivity } from '@/lib/admin/activity-log'
import { revalidatePath } from 'next/cache'

// ─── Shared moderator gate ───────────────────────────────────────────────────

type ModeratorGate =
  | { ok: true; user: { id: string }; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }

/**
 * ONE admin-role check for every moderation action: authenticated user with
 * an active admin_roles row of admin / super_admin / moderator.
 */
async function requireModerator(): Promise<ModeratorGate> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Unauthorized' }
  }

  const { data: adminRole } = await supabase
    .from('admin_roles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single() as any

  const role = (adminRole as any)?.role
  if (!adminRole || (role !== 'admin' && role !== 'super_admin' && role !== 'moderator')) {
    return { ok: false, error: 'Forbidden - Admin access required' }
  }

  return { ok: true, user, supabase }
}

/** Fire-and-forget activity log — logging failures never fail the action. */
async function safeLog(params: Parameters<typeof logAdminActivity>[0]) {
  try {
    await logAdminActivity(params)
  } catch (err) {
    console.error('[Moderation] Activity log failed:', err)
  }
}

// ─── Queue ───────────────────────────────────────────────────────────────────

export interface SellerModerationContext {
  /** Listings already released for this seller (active/sold/archived + approved_at). */
  approvedCount: number
  /** Tier's pre-moderation listing count (seller_tier_config, default 3). */
  threshold: number
  /** seller_presence.store_paused */
  storePaused: boolean
  /** How many of this seller's listings sit in the pending queue right now. */
  pendingCount: number
}

/**
 * Get the moderation queue: listings awaiting an admin decision
 * (pending_approval) plus listings bounced back to the seller
 * (changes_requested), each enriched with a seller profile block and a
 * batch-computed per-seller moderation context.
 */
export async function getPendingListings(): Promise<{
  success: boolean
  listings?: any[]
  error?: string
}> {
  try {
    const gate = await requireModerator()
    if (!gate.ok) return { success: false, error: gate.error }

    const { data: listings, error } = await (gate.supabase
      .from('listings')
      .select(`
        *,
        seller:profiles!listings_seller_id_fkey(
          id, username, shop_name, avatar_url, seller_tier, is_verified,
          total_sales, seller_rating, created_at, seller_status, is_test,
          founding_seller
        ),
        game:games!listings_game_id_fkey(name, slug),
        category:categories!listings_category_id_fkey(name, slug)
      `)
      .in('status', ['pending_approval', 'changes_requested'])
      .order('created_at', { ascending: false }) as any)

    if (error) {
      console.error('Error fetching listings:', error)
      return { success: false, error: error.message }
    }

    const rows: any[] = listings || []

    // ── Per-seller context (batched — 3 queries over the distinct sellers) ──
    const sellerIds = Array.from(
      new Set(rows.map((l) => l.seller_id).filter(Boolean)),
    ) as string[]

    if (sellerIds.length > 0) {
      const service = createServiceRoleClient()

      const [approvedRes, tierRes, presenceRes] = await Promise.all([
        // 1) Released listings per seller (approved + live/sold/archived).
        service
          .from('listings')
          .select('seller_id')
          .in('seller_id', sellerIds)
          .in('status', ['active', 'sold', 'archived'])
          .not('approved_at', 'is', null) as any,
        // 2) Tier thresholds (tiny table — fetch all rows once).
        service
          .from('seller_tier_config')
          .select('tier, pre_moderation_listings') as any,
        // 3) Store-paused flags.
        service
          .from('seller_presence')
          .select('seller_id, store_paused')
          .in('seller_id', sellerIds) as any,
      ])

      const approvedCounts = new Map<string, number>()
      for (const r of approvedRes.data ?? []) {
        approvedCounts.set(r.seller_id, (approvedCounts.get(r.seller_id) ?? 0) + 1)
      }

      const thresholds = new Map<string, number>()
      for (const t of tierRes.data ?? []) {
        if (typeof t.pre_moderation_listings === 'number') {
          thresholds.set(t.tier, t.pre_moderation_listings)
        }
      }

      const paused = new Map<string, boolean>()
      for (const p of presenceRes.data ?? []) {
        paused.set(p.seller_id, !!p.store_paused)
      }

      // 4) Pending count comes from the queue we already fetched.
      const pendingCounts = new Map<string, number>()
      for (const l of rows) {
        if (l.status === 'pending_approval' && l.seller_id) {
          pendingCounts.set(l.seller_id, (pendingCounts.get(l.seller_id) ?? 0) + 1)
        }
      }

      for (const l of rows) {
        const sid = l.seller_id as string | undefined
        if (!sid) continue
        const tier = (l.seller?.seller_tier as string | null) || DEFAULT_TIER
        l.sellerContext = {
          approvedCount: approvedCounts.get(sid) ?? 0,
          threshold: thresholds.get(tier) ?? 3,
          storePaused: paused.get(sid) ?? false,
          pendingCount: pendingCounts.get(sid) ?? 0,
        } satisfies SellerModerationContext
      }
    }

    return { success: true, listings: rows }
  } catch (error: any) {
    console.error('Error in getPendingListings:', error)
    return {
      success: false,
      error: error.message || 'Failed to get pending listings',
    }
  }
}

// ─── Approve ─────────────────────────────────────────────────────────────────

export async function approveListing(
  listingId: string,
  notes?: string
): Promise<{
  success: boolean
  /** How many additional listings the threshold drain auto-released. */
  drainedCount?: number
  error?: string
}> {
  try {
    const gate = await requireModerator()
    if (!gate.ok) return { success: false, error: gate.error }
    const { user, supabase } = gate

    // Use the database function to approve listing (bypasses the moderation trigger)
    const { error: approveError } = await (supabase.rpc as any)('approve_listing', {
      listing_id: listingId,
      admin_id: user.id,
    })

    if (approveError) {
      console.error('Error approving listing:', approveError)
      return { success: false, error: approveError.message }
    }

    // Update moderation notes if provided
    if (notes) {
      await (supabase
        .from('listings')
        .update as any)({ moderation_notes: notes })
        .eq('id', listingId)
    }

    // Seller comms (email + in-app, awaited but never fails the approval).
    // Service client: the admin session's cookie client can't read the
    // seller's profile or insert notifications for another user under RLS.
    let approvedTitle: string | undefined
    await (async () => {
      const service = createServiceRoleClient()
      const { data: listing } = await service
        .from('listings')
        .select(`
          seller_id,
          title,
          slug,
          seller:profiles!listings_seller_id_fkey(email, username, full_name),
          game:games!listings_game_id_fkey(slug),
          category:categories!listings_category_id_fkey(slug)
        `)
        .eq('id', listingId)
        .single() as any

      if (!listing?.seller_id) return
      approvedTitle = listing.title

      const listingPath =
        listing.slug && listing.game?.slug && listing.category?.slug
          ? `/${listing.game.slug}/${listing.category.slug}/${listing.slug}`
          : undefined

      await (service.from('notifications').insert as any)({
        user_id: listing.seller_id,
        type: 'listing_approved',
        title: 'Listing Approved',
        message: `"${listing.title}" passed review and is now live for buyers.`,
        link: '/account/listings',
        is_read: false,
      })

      if (listing.seller?.email) {
        const { sendListingApprovedEmail } = await import('@/lib/email')
        await sendListingApprovedEmail({
          to: listing.seller.email,
          name: listing.seller.full_name || listing.seller.username || 'Gamer',
          listingTitle: listing.title,
          listingPath,
        })
      }
    })().catch((err) => console.error('[Moderation] Approval comms failed:', err))

    // Threshold drain: if THIS approval pushed the seller past their tier's
    // pre-moderation count (e.g. the "first 3" for unverified), the seller is
    // now trusted — release the rest of their queued listings automatically so
    // admins never re-review a seller who already crossed the bar.
    let drainedCount = 0
    try {
      const service = createServiceRoleClient()
      const { data: approvedRow } = await service
        .from('listings')
        .select('seller_id')
        .eq('id', listingId)
        .single() as any
      const sellerId = approvedRow?.seller_id as string | undefined
      if (sellerId) {
        const { data: stillNeedsModeration } = await (service.rpc as any)(
          'check_seller_needs_moderation',
          { seller_id: sellerId },
        )
        if (stillNeedsModeration === false) {
          const { data: queued } = await service
            .from('listings')
            .select('id')
            .eq('seller_id', sellerId)
            .eq('status', 'pending_approval') as any
          for (const q of queued ?? []) {
            const { error: drainError } = await (service.rpc as any)('approve_listing', {
              listing_id: q.id,
              admin_id: user.id,
            })
            if (!drainError) drainedCount++
          }
          if (drainedCount > 0) {
            await (service.from('notifications').insert as any)({
              user_id: sellerId,
              type: 'listing_approved',
              title: 'Listings Released',
              message: `${drainedCount} more of your listings went live automatically — you've passed your initial review.`,
              link: '/account/listings',
              is_read: false,
            })
          }
        }
      }
    } catch (err) {
      console.error('[Moderation] Threshold drain failed:', err)
    }

    // Audit trail (never fails the action).
    await safeLog({
      action: 'listing_approved',
      actionCategory: 'moderation',
      resourceType: 'listing',
      resourceId: listingId,
      resourceName: approvedTitle,
      notes,
    })
    if (drainedCount > 0) {
      await safeLog({
        action: 'listing_threshold_drain',
        actionCategory: 'moderation',
        resourceType: 'listing',
        resourceId: listingId,
        resourceName: approvedTitle,
        notes: `Auto-released ${drainedCount} queued listing(s) after the seller crossed their review threshold`,
        metadata: { drained: drainedCount },
      })
    }

    revalidatePath('/admin/moderation')
    // V21/P7.d — Marketplace tree lives at `/{gameSlug}/...` now;
    // homepage surfaces featured/popular listings so revalidating
    // `/` covers the public-facing impact of a moderation change.
    revalidatePath('/')

    return { success: true, drainedCount }
  } catch (error: any) {
    console.error('Error in approveListing:', error)
    return {
      success: false,
      error: error.message || 'Failed to approve listing',
    }
  }
}

// ─── Reject ──────────────────────────────────────────────────────────────────

export async function rejectListing(
  listingId: string,
  reason: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const gate = await requireModerator()
    if (!gate.ok) return { success: false, error: gate.error }
    const { user, supabase } = gate

    // Use the database function to reject listing
    const { error: rejectError } = await (supabase.rpc as any)('reject_listing', {
      listing_id: listingId,
      admin_id: user.id,
      reason: reason,
    })

    if (rejectError) {
      return { success: false, error: rejectError.message }
    }

    // Seller comms (email + in-app, awaited but never fails the rejection).
    // Service client: RLS hides the seller's profile and the now-rejected
    // listing from the admin's cookie client.
    let rejectedTitle: string | undefined
    await (async () => {
      const service = createServiceRoleClient()
      const { data: listing } = await service
        .from('listings')
        .select(`
          seller_id,
          title,
          seller:profiles!listings_seller_id_fkey(email, username, full_name)
        `)
        .eq('id', listingId)
        .single() as any

      if (!listing?.seller_id) return
      rejectedTitle = listing.title

      await (service.from('notifications').insert as any)({
        user_id: listing.seller_id,
        type: 'listing_rejected',
        title: 'Listing Not Approved',
        message: `"${listing.title}" didn't pass review. Check the reason and update your listing.`,
        link: '/account/listings',
        is_read: false,
      })

      if (listing.seller?.email) {
        const { sendListingRejectedEmail } = await import('@/lib/email')
        await sendListingRejectedEmail({
          to: listing.seller.email,
          name: listing.seller.full_name || listing.seller.username || 'Gamer',
          listingTitle: listing.title,
          reason,
          changesRequested: false,
        })
      }
    })().catch((err) => console.error('[Moderation] Rejection comms failed:', err))

    await safeLog({
      action: 'listing_rejected',
      actionCategory: 'moderation',
      resourceType: 'listing',
      resourceId: listingId,
      resourceName: rejectedTitle,
      notes: reason,
    })

    revalidatePath('/admin/moderation')

    return { success: true }
  } catch (error: any) {
    console.error('Error in rejectListing:', error)
    return {
      success: false,
      error: error.message || 'Failed to reject listing',
    }
  }
}

// ─── Request changes ─────────────────────────────────────────────────────────

export async function requestListingChanges(
  listingId: string,
  changes: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const gate = await requireModerator()
    if (!gate.ok) return { success: false, error: gate.error }
    const { user, supabase } = gate

    // Flip the listing to changes_requested + store what to change.
    // SECURITY DEFINER RPC (sibling of approve_listing/reject_listing);
    // sets status='changes_requested', moderation_notes=changes and
    // clears approved_by/approved_at.
    const { error: updateError } = await (supabase.rpc as any)('request_listing_changes', {
      listing_id: listingId,
      admin_id: user.id,
      changes,
    })

    if (updateError) {
      console.error('Error requesting listing changes:', updateError)
      return { success: false, error: updateError.message }
    }

    // Seller comms (email + in-app, awaited but never fails the request).
    // Service client: RLS hides the seller's profile and non-active
    // listings from the admin's cookie client.
    let changedTitle: string | undefined
    await (async () => {
      const service = createServiceRoleClient()
      const { data: listing } = await service
        .from('listings')
        .select(`
          seller_id,
          title,
          seller:profiles!listings_seller_id_fkey(email, username, full_name)
        `)
        .eq('id', listingId)
        .single() as any

      if (!listing?.seller_id) return
      changedTitle = listing.title

      await (service.from('notifications').insert as any)({
        user_id: listing.seller_id,
        type: 'listing_changes_requested',
        title: 'Changes Requested',
        message: `Changes requested on "${listing.title}" — review the notes and resubmit.`,
        link: '/account/listings',
        is_read: false,
      })

      if (listing.seller?.email) {
        const { sendListingRejectedEmail } = await import('@/lib/email')
        await sendListingRejectedEmail({
          to: listing.seller.email,
          name: listing.seller.full_name || listing.seller.username || 'Gamer',
          listingTitle: listing.title,
          reason: changes,
          changesRequested: true,
        })
      }
    })().catch((err) => console.error('[Moderation] Change-request comms failed:', err))

    await safeLog({
      action: 'listing_changes_requested',
      actionCategory: 'moderation',
      resourceType: 'listing',
      resourceId: listingId,
      resourceName: changedTitle,
      notes: changes,
    })

    revalidatePath('/admin/moderation')
    revalidatePath('/account/listings')

    return { success: true }
  } catch (error: any) {
    console.error('Error in requestListingChanges:', error)
    return {
      success: false,
      error: error.message || 'Failed to request changes',
    }
  }
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getModerationStats(): Promise<{
  success: boolean
  stats?: {
    pending: number
    awaiting_seller: number
    approved_today: number
    rejected_today: number
    total_approved: number
  }
  error?: string
}> {
  try {
    const gate = await requireModerator()
    if (!gate.ok) return { success: false, error: gate.error }
    const { supabase } = gate

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      { count: pending },
      { count: awaiting_seller },
      { count: approved_today },
      { count: rejected_today },
      { count: total_approved },
    ] = await Promise.all([
      supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_approval'),
      supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'changes_requested'),
      supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('approved_at', today.toISOString()),
      // reject_listing nulls approved_at and stamps rejected_at, so the
      // "today" filter must use rejected_at (approved_at was always 0).
      supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'rejected')
        .gte('rejected_at', today.toISOString()),
      supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .not('approved_at', 'is', null),
    ])

    return {
      success: true,
      stats: {
        pending: pending || 0,
        awaiting_seller: awaiting_seller || 0,
        approved_today: approved_today || 0,
        rejected_today: rejected_today || 0,
        total_approved: total_approved || 0,
      },
    }
  } catch (error: any) {
    console.error('Error in getModerationStats:', error)
    return {
      success: false,
      error: error.message || 'Failed to get moderation stats',
    }
  }
}

// ─── History ─────────────────────────────────────────────────────────────────

export type ModerationHistorySlice =
  | 'approved_today'
  | 'rejected_today'
  | 'approved_all'
  | 'all'

export interface ModerationHistoryRow {
  id: string
  title: string
  slug: string | null
  images: string[] | null
  price: number | null
  game: { name: string; slug: string } | null
  category: { name: string; slug: string } | null
  seller: string | null
  decision: 'approved' | 'rejected' | 'changes_requested'
  decidedAt: string | null
  decidedBy: string | null
  reason: string | null
}

const HISTORY_PAGE_SIZE = 25

/**
 * Decision history for the moderation surface. Slices:
 *  - approved_today / rejected_today: decisions since local midnight
 *  - approved_all: every listing with an approved_at
 *  - all: any listing that ever received a decision (approved OR rejected
 *    OR changes requested), newest decision first (updated_at proxy).
 */
export async function getModerationHistory(input: {
  slice: ModerationHistorySlice
  page?: number
}): Promise<{
  success: boolean
  rows?: ModerationHistoryRow[]
  total?: number
  page?: number
  pageSize?: number
  error?: string
}> {
  try {
    const gate = await requireModerator()
    if (!gate.ok) return { success: false, error: gate.error }

    const page = Math.max(1, input.page || 1)
    const from = (page - 1) * HISTORY_PAGE_SIZE
    const to = from + HISTORY_PAGE_SIZE - 1

    // Service client: RLS hides rejected / non-active listings from the
    // admin's cookie client (same reason the comms blocks use it).
    const service = createServiceRoleClient()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const midnight = today.toISOString()

    let query = (service
      .from('listings')
      .select(
        `
        id, title, slug, images, price, status, updated_at,
        approved_by, approved_at,
        rejected_by, rejected_at, rejection_reason,
        changes_requested_by, changes_requested_at,
        moderation_notes,
        game:games!listings_game_id_fkey(name, slug),
        category:categories!listings_category_id_fkey(name, slug),
        seller:profiles!listings_seller_id_fkey(username)
      `,
        { count: 'exact' },
      ) as any)

    switch (input.slice) {
      case 'approved_today':
        query = query
          .not('approved_at', 'is', null)
          .gte('approved_at', midnight)
          .order('approved_at', { ascending: false })
        break
      case 'rejected_today':
        query = query
          .not('rejected_at', 'is', null)
          .gte('rejected_at', midnight)
          .order('rejected_at', { ascending: false })
        break
      case 'approved_all':
        query = query
          .not('approved_at', 'is', null)
          .order('approved_at', { ascending: false })
        break
      case 'all':
        // Any decision ever. PostgREST can't order by greatest(timestamps),
        // so updated_at (stamped by every decision RPC) is the sort proxy.
        query = query
          .or('approved_at.not.is.null,rejected_at.not.is.null,changes_requested_at.not.is.null')
          .order('updated_at', { ascending: false })
        break
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      console.error('Error fetching moderation history:', error)
      return { success: false, error: error.message }
    }

    const rawRows: any[] = data || []

    // Batch-resolve the deciding admins' usernames (one query, no nested
    // multi-FK joins).
    const adminIds = Array.from(
      new Set(
        rawRows
          .flatMap((r) => [r.approved_by, r.rejected_by, r.changes_requested_by])
          .filter(Boolean),
      ),
    ) as string[]

    const adminNames = new Map<string, string>()
    if (adminIds.length > 0) {
      const { data: admins } = await (service
        .from('profiles')
        .select('id, username')
        .in('id', adminIds) as any)
      for (const a of admins ?? []) {
        if (a.username) adminNames.set(a.id, a.username)
      }
    }

    const rows: ModerationHistoryRow[] = rawRows.map((r) => {
      // Latest decision on the row (slice-specific slices force their own).
      const candidates: {
        decision: ModerationHistoryRow['decision']
        at: string | null
        by: string | null
      }[] = [
        { decision: 'approved', at: r.approved_at, by: r.approved_by },
        { decision: 'rejected', at: r.rejected_at, by: r.rejected_by },
        { decision: 'changes_requested', at: r.changes_requested_at, by: r.changes_requested_by },
      ]

      let picked = candidates
        .filter((c) => c.at)
        .sort((a, b) => new Date(b.at!).getTime() - new Date(a.at!).getTime())[0]

      if (input.slice === 'approved_today' || input.slice === 'approved_all') {
        picked = candidates[0]
      } else if (input.slice === 'rejected_today') {
        picked = candidates[1]
      }
      if (!picked) picked = candidates[0]

      return {
        id: r.id,
        title: r.title,
        slug: r.slug ?? null,
        images: r.images ?? null,
        price: r.price ?? null,
        game: r.game ? { name: r.game.name, slug: r.game.slug } : null,
        category: r.category ? { name: r.category.name, slug: r.category.slug } : null,
        seller: r.seller?.username ?? null,
        decision: picked.decision,
        decidedAt: picked.at ?? null,
        decidedBy: picked.by ? adminNames.get(picked.by) ?? null : null,
        reason: r.rejection_reason || r.moderation_notes || null,
      }
    })

    return {
      success: true,
      rows,
      total: count || 0,
      page,
      pageSize: HISTORY_PAGE_SIZE,
    }
  } catch (error: any) {
    console.error('Error in getModerationHistory:', error)
    return {
      success: false,
      error: error.message || 'Failed to get moderation history',
    }
  }
}
