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
import { UNVERIFIED_REVIEW_PRICE_USD } from '@/lib/fees'
import { DEFAULT_TIER } from '@/lib/seller/tiers'
import { logAdminActivities, type LogActivityParams } from '@/lib/admin/activity-log'
import { getAdminGate } from '@/lib/admin/context'
import { utcPeriods } from '@/lib/admin/periods'
import { afterResponse } from '@/lib/after-response'
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
import { snapshotListings, submitListingChanges, type ListingSnapshot } from '@/lib/seo/indexnow'

// ─── Shared moderator gate ───────────────────────────────────────────────────

type ModeratorSession = { ok: true; user: { id: string }; supabase: Awaited<ReturnType<typeof createClient>> }
type ModeratorGate = ModeratorSession | { ok: false; error: string }

/**
 * ONE admin-role check for every moderation action: active staff with two-factor
 * in this session (lib/admin/context), role admin / super_admin / moderator.
 */
async function requireModerator(): Promise<ModeratorGate> {
  const gate = await getAdminGate()
  if (gate.status === 'signed_out') return { ok: false, error: 'Unauthorized' }
  if (gate.status !== 'ok') return { ok: false, error: 'Forbidden - Admin access required' }

  const role = gate.admin.role
  if (role !== 'admin' && role !== 'super_admin' && role !== 'moderator') {
    return { ok: false, error: 'Forbidden - Admin access required' }
  }

  return { ok: true, user: gate.user, supabase: await createClient() }
}

/** Activity log: a logging failure never fails the action. */
async function safeLog(entries: LogActivityParams[]) {
  try {
    await logAdminActivities(entries)
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

/** The newest this many rows reach the screen; the numbers on top count all of them. */
const QUEUE_LIMIT = 200

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
        id, seller_id, title, slug, price, quantity, images, template_data, status,
        created_at, updated_at, moderation_notes, changes_requested_at,
        seller:profiles!listings_seller_id_fkey(
          id, username, shop_name, avatar_url, seller_tier, is_verified,
          total_sales, seller_rating, created_at, seller_status, is_test,
          founding_seller
        ),
        game:games!listings_game_id_fkey(name, slug),
        category:game_categories!listings_game_category_id_fkey(name, slug)
      `)
      .in('status', ['pending_approval', 'changes_requested'])
      .order('created_at', { ascending: false })
      .limit(QUEUE_LIMIT) as any)

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
        (service.rpc as any)('admin_seller_released_counts', { p_seller_ids: sellerIds }),
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
        approvedCounts.set(r.seller_id, Number(r.released))
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
        // Open seller signup: say WHY it is here. An unverified seller's
        // listing over the review price is the new reason; the entry rank's
        // first-N review is the old one.
        const unverified = l.seller?.is_verified === false
        const overLine = unverified && Number(l.price ?? 0) > UNVERIFIED_REVIEW_PRICE_USD
        l.reviewReason = l.status !== 'pending_approval'
          ? null
          : overLine
            ? `New seller · over $${UNVERIFIED_REVIEW_PRICE_USD}`
            : l.sellerContext.approvedCount < l.sellerContext.threshold
              ? `First ${l.sellerContext.threshold} listings`
              : unverified
                ? 'New seller'
                : null
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

const RELEASE_ROW = `
  id,
  seller_id,
  title,
  slug,
  seller:profiles!listings_seller_id_fkey(email, username, full_name),
  game:games!listings_game_id_fkey(slug),
  category:game_categories!listings_game_category_id_fkey(slug)
`

interface ReleaseRow {
  id: string
  seller_id: string | null
  title: string
  slug: string | null
  seller: { email: string | null; username: string | null; full_name: string | null } | null
  game: { slug: string | null } | null
  category: { slug: string | null } | null
}

function greetingName(seller: ReleaseRow['seller']): string {
  return seller?.full_name || seller?.username || 'Gamer'
}

/**
 * One seller told once, however many listings one decision released.
 * Service client: the admin session can't read the seller's profile or insert
 * notifications for another user under RLS.
 */
async function tellSellerReleased(
  service: ReturnType<typeof createServiceRoleClient>,
  rows: ReleaseRow[],
  drained: number,
): Promise<void> {
  const first = rows[0]
  if (!first?.seller_id) return

  const notify = (title: string, message: string) => ({
    user_id: first.seller_id,
    type: 'listing_approved',
    title,
    message,
    link: '/account/listings',
    is_read: false,
  })
  await (service.from('notifications').insert as any)([
    rows.length > 1
      ? notify('Listings Approved', `${rows.length} of your listings passed review and are now live for buyers.`)
      : notify('Listing Approved', `"${first.title}" passed review and is now live for buyers.`),
    ...(drained > 0
      ? [notify('Listings Released', `${drained} more of your listings went live automatically — you've passed your initial review.`)]
      : []),
  ])

  if (!first.seller?.email) return
  const { sendListingApprovedEmail, sendListingsApprovedEmail } = await import('@/lib/email')
  const name = greetingName(first.seller)
  if (rows.length > 1) {
    await sendListingsApprovedEmail({ to: first.seller.email, name, count: rows.length })
    return
  }
  await sendListingApprovedEmail({
    to: first.seller.email,
    name,
    listingTitle: first.title,
    listingPath:
      first.slug && first.game?.slug && first.category?.slug
        ? `/${first.game.slug}/${first.category.slug}/${first.slug}`
        : undefined,
  })
}

/**
 * Put listings live: one decision, whether it covers one listing or a seller's
 * whole group. A failure stops there; what went live stays live and is reported.
 *
 * What the action promises happens before it returns: the decision, the audit
 * rows, the public cache refresh. The seller's email and notification and the
 * search-engine ping run after the response, so staff never wait on them.
 */
async function releaseListings(
  gate: ModeratorSession,
  ids: string[],
  notes?: string,
): Promise<{ approvedIds: string[]; drainedCount: number; error?: string }> {
  const service = createServiceRoleClient()

  // IndexNow: the approval is the moment most listings go live, so snapshot
  // the listings (and, below, any queue they drain) BEFORE they change.
  const [indexNowBefore, { data: rowData }] = await Promise.all([
    snapshotListings(service, ids),
    service.from('listings').select(RELEASE_ROW).in('id', ids) as any,
  ])
  const rows = (rowData ?? []) as ReleaseRow[]

  // The database function bypasses the moderation trigger.
  const approvedIds: string[] = []
  let failure: string | undefined
  for (const id of ids) {
    const { error } = await (gate.supabase.rpc as any)('approve_listing', {
      listing_id: id,
      admin_id: gate.user.id,
    })
    if (error) {
      console.error('Error approving listing:', error)
      failure = error.message
      break
    }
    approvedIds.push(id)
  }
  if (approvedIds.length === 0) return { approvedIds, drainedCount: 0, error: failure }

  if (notes) {
    // AUTH-006: moderation_notes is trigger-protected; the moderator session
    // (gated by requireModerator) writes it via the service role.
    await (service.from('listings').update as any)({ moderation_notes: notes }).in('id', approvedIds)
  }

  const approvedRows = rows.filter((r) => approvedIds.includes(r.id))
  const sellerIds = Array.from(new Set(approvedRows.map((r) => r.seller_id).filter(Boolean))) as string[]

  // Threshold drain: if THIS approval pushed the seller past their tier's
  // pre-moderation count (e.g. the "first 3" for unverified), the seller is
  // now trusted — release the rest of their queued listings automatically so
  // admins never re-review a seller who already crossed the bar.
  const drainedBySeller = new Map<string, string[]>()
  try {
    for (const sellerId of sellerIds) {
      const { data: stillNeedsModeration } = await (service.rpc as any)(
        'check_seller_needs_moderation',
        { seller_id: sellerId },
      )
      if (stillNeedsModeration !== false) continue
      const { data: queued } = await service
        .from('listings')
        .select('id')
        .eq('seller_id', sellerId)
        .eq('status', 'pending_approval') as any
      // Snapshot the queue before it is released so IndexNow sees these go live too.
      const queueBefore = await snapshotListings(service, (queued ?? []).map((q: { id: string }) => q.id))
      if (queueBefore) for (const [id, snap] of queueBefore) indexNowBefore?.set(id, snap)
      const released: string[] = []
      for (const q of queued ?? []) {
        const { error: drainError } = await (service.rpc as any)('approve_listing', {
          listing_id: q.id,
          admin_id: gate.user.id,
        })
        if (!drainError) released.push(q.id)
      }
      if (released.length > 0) drainedBySeller.set(sellerId, released)
    }
  } catch (err) {
    console.error('[Moderation] Threshold drain failed:', err)
  }
  const drainedIds = Array.from(drainedBySeller.values()).flat()

  // Audit trail (never fails the action).
  await safeLog([
    ...approvedIds.map((id): LogActivityParams => ({
      action: 'listing_approved',
      actionCategory: 'moderation',
      resourceType: 'listing',
      resourceId: id,
      resourceName: rows.find((r) => r.id === id)?.title,
      notes,
    })),
    ...Array.from(drainedBySeller, ([sellerId, released]): LogActivityParams => {
      const trigger = approvedRows.find((r) => r.seller_id === sellerId)
      return {
        action: 'listing_threshold_drain',
        actionCategory: 'moderation',
        resourceType: 'listing',
        resourceId: trigger?.id,
        resourceName: trigger?.title,
        notes: `Auto-released ${released.length} queued listing(s) after the seller crossed their review threshold`,
        metadata: { drained: released.length },
      }
    }),
  ])

  // No revalidatePath('/'): the homepage's featured/popular shelves are
  // CLIENT react-query hooks (features/home/hooks/*), which server
  // revalidation cannot reach. The category tags below are the real
  // public-facing refresh (build audit 2026-09-22, §4).
  // Step 7b — the category pages (24 h TTL). A drain releases the seller's
  // whole queue, so resolve by seller as well as by listing.
  await revalidateListingSurfaces(service as never, {
    listingIds: approvedIds,
    sellerIds: Array.from(drainedBySeller.keys()),
  })

  afterResponse('Moderation release', async () => {
    await Promise.all([
      ...sellerIds.map((sellerId) =>
        tellSellerReleased(
          service,
          approvedRows.filter((r) => r.seller_id === sellerId),
          drainedBySeller.get(sellerId)?.length ?? 0,
        ),
      ),
      submitListingChanges(indexNowBefore, await snapshotListings(service, [...approvedIds, ...drainedIds])),
    ])
  })

  return { approvedIds, drainedCount: drainedIds.length, error: failure }
}

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

    const { error, drainedCount } = await releaseListings(gate, [listingId], notes)
    if (error) return { success: false, error }
    return { success: true, drainedCount }
  } catch (error: any) {
    console.error('Error in approveListing:', error)
    return {
      success: false,
      error: error.message || 'Failed to approve listing',
    }
  }
}

/** Approve All: one action, one email and one notification for the whole group. */
export async function approveListings(listingIds: string[]): Promise<{
  success: boolean
  /** What went live, even when a later listing failed. */
  approvedIds: string[]
  drainedCount?: number
  error?: string
}> {
  try {
    const gate = await requireModerator()
    if (!gate.ok) return { success: false, approvedIds: [], error: gate.error }

    const { approvedIds, drainedCount, error } = await releaseListings(gate, listingIds)
    if (error) return { success: false, approvedIds, drainedCount, error }
    return { success: true, approvedIds, drainedCount }
  } catch (error: any) {
    console.error('Error in approveListings:', error)
    return {
      success: false,
      approvedIds: [],
      error: error.message || 'Failed to approve listings',
    }
  }
}

// ─── Reject / request changes ────────────────────────────────────────────────

/**
 * The seller's in-app notice + email for a decision that keeps a listing off
 * the site. Service client: RLS hides the seller's profile and non-active
 * listings from the admin's cookie client.
 */
async function readDecidedListing(listingId: string): Promise<Pick<ReleaseRow, 'seller_id' | 'title' | 'seller'> | null> {
  const { data } = await createServiceRoleClient()
    .from('listings')
    .select(`
      seller_id,
      title,
      seller:profiles!listings_seller_id_fkey(email, username, full_name)
    `)
    .eq('id', listingId)
    .single() as any
  return data ?? null
}

function tellSellerNotLive(
  label: string,
  listing: Awaited<ReturnType<typeof readDecidedListing>>,
  note: { type: string; title: string; message: string },
  email: { reason: string; changesRequested: boolean },
): void {
  if (!listing?.seller_id) return
  afterResponse(label, async () => {
    await (createServiceRoleClient().from('notifications').insert as any)({
      user_id: listing.seller_id,
      ...note,
      link: '/account/listings',
      is_read: false,
    })
    if (!listing.seller?.email) return
    const { sendListingRejectedEmail } = await import('@/lib/email')
    await sendListingRejectedEmail({
      to: listing.seller.email,
      name: greetingName(listing.seller),
      listingTitle: listing.title,
      ...email,
    })
  })
}

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

    const listing = await readDecidedListing(listingId)

    await safeLog([{
      action: 'listing_rejected',
      actionCategory: 'moderation',
      resourceType: 'listing',
      resourceId: listingId,
      resourceName: listing?.title,
      notes: reason,
    }])

    await revalidateListingSurfaces(createServiceRoleClient() as never, { listingIds: [listingId] })

    tellSellerNotLive(
      'Moderation rejection',
      listing,
      {
        type: 'listing_rejected',
        title: 'Listing Not Approved',
        message: `"${listing?.title}" didn't pass review. Check the reason and update your listing.`,
      },
      { reason, changesRequested: false },
    )

    return { success: true }
  } catch (error: any) {
    console.error('Error in rejectListing:', error)
    return {
      success: false,
      error: error.message || 'Failed to reject listing',
    }
  }
}

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

    const listing = await readDecidedListing(listingId)

    await safeLog([{
      action: 'listing_changes_requested',
      actionCategory: 'moderation',
      resourceType: 'listing',
      resourceId: listingId,
      resourceName: listing?.title,
      notes: changes,
    }])

    await revalidateListingSurfaces(createServiceRoleClient() as never, { listingIds: [listingId] })

    tellSellerNotLive(
      'Moderation change request',
      listing,
      {
        type: 'listing_changes_requested',
        title: 'Changes Requested',
        message: `Changes requested on "${listing?.title}" — review the notes and resubmit.`,
      },
      { reason: changes, changesRequested: true },
    )

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

    const { data, error } = await (createServiceRoleClient().rpc as any)('admin_moderation_stats', {
      p_today: utcPeriods(new Date()).todayStart.toISOString(),
    })
    if (error) return { success: false, error: error.message }

    return { success: true, stats: data }
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
        category:game_categories!listings_game_category_id_fkey(name, slug),
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
