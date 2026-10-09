'use server'

/**
 * Moderation tools (2026-10-09): what an admin does when a live seller
 * posts something that should not be there.
 *
 *   takedownListing   active → suspended with a reason; seller emailed;
 *                     strike (optional).
 *   restoreListing    suspended → active (the only way back; the listing
 *                     write guard blocks a plain update).
 *   removeListingImage  drops one URL from listings.images + the file;
 *                     a listing left with no image is taken down too.
 *   resetSellerAvatar  avatar → default robot, file deleted, picture
 *                     locked (profiles.avatar_locked_at); seller emailed.
 *   issueStrike / revokeStrike  seller_strikes rows; the 2nd active strike
 *                     restricts the store, the 3rd bans it (same path as
 *                     the manual Restrict / Ban, so listings pause and the
 *                     seller is told).
 *   listReports / resolveReport  buyer reports: Uphold = takedown + strike,
 *                     Dismiss = reopen the listing if it was auto-hidden.
 *
 * Every action: moderator gate → service-role write → notification + email
 * → admin activity log → revalidate the listing surfaces.
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireRole, type AdminUser } from './admin-permissions'
import { logAdminActivity } from '@/lib/admin/activity-log'
import { createNotification } from '@/lib/utils/notifications'
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
import { sendImageRemovedEmail, sendListingTakenDownEmail, sendSellerStrikeEmail } from '@/lib/email'
import { listingImagePathFromUrl, LISTING_IMAGE_BUCKET } from '@/lib/listings/images'

type Result = { success: true } | { success: false; error: string }

export type StrikeKind = 'listing_takedown' | 'image_removed' | 'avatar_reset' | 'report_upheld' | 'other'

const MODERATORS = ['admin', 'super_admin', 'moderator'] as const

async function gate(): Promise<AdminUser> {
  return requireRole([...MODERATORS] as any)
}

async function safeLog(params: Parameters<typeof logAdminActivity>[0]) {
  try {
    await logAdminActivity(params)
  } catch (err) {
    console.error('[ModerationTools] activity log failed:', err)
  }
}

async function sellerContact(service: any, sellerId: string) {
  const { data } = await service.from('profiles').select('id, email, username, full_name, shop_name, seller_status').eq('id', sellerId).maybeSingle()
  return data as { id: string; email: string | null; username: string | null; full_name: string | null; shop_name: string | null; seller_status: string | null } | null
}

function displayName(p: { shop_name: string | null; username: string | null; full_name: string | null } | null) {
  return p?.shop_name || p?.full_name || p?.username || 'there'
}

async function revalidate(listingIds: string[], sellerIds: string[]) {
  try {
    revalidatePath('/admin/moderation')
    revalidatePath('/admin/reports')
    await revalidateListingSurfaces(createServiceRoleClient() as never, { listingIds, sellerIds })
  } catch (err) {
    console.error('[ModerationTools] revalidate failed:', err)
  }
}

/* ── Strikes ────────────────────────────────────────────────────── */

/**
 * Records a strike and escalates: 2 active → restricted, 3 → banned.
 * Returns the active count after this strike.
 */
export async function issueStrike(input: { sellerId: string; kind: StrikeKind; reason: string; listingId?: string | null }): Promise<Result & { count?: number }> {
  const admin = await gate()
  const reason = input.reason.trim()
  if (reason.length < 3) return { success: false, error: 'Give a reason (at least 3 characters).' }
  const service = createServiceRoleClient() as any
  const { error } = await service.from('seller_strikes').insert({
    seller_id: input.sellerId,
    issued_by: admin.userId,
    kind: input.kind,
    reason,
    listing_id: input.listingId ?? null,
  })
  if (error) return { success: false, error: error.message }
  const { data: countData } = await service.rpc('seller_strike_count', { p_seller: input.sellerId })
  const count = Number(countData ?? 0)

  await escalate(service, admin, input.sellerId, count, reason)

  const seller = await sellerContact(service, input.sellerId)
  if (seller?.email) {
    try {
      await sendSellerStrikeEmail({ to: seller.email, name: displayName(seller), reason, count })
    } catch (err) {
      console.error('[ModerationTools] strike email failed:', err)
    }
  }
  await createNotification({
    userId: input.sellerId,
    type: 'seller_strike',
    title: `Strike ${Math.min(count, 3)} of 3 on your store`,
    message: reason,
    link: '/account/restrictions',
  })
  await safeLog({ action: 'seller.strike', actionCategory: 'seller', resourceType: 'seller', resourceId: input.sellerId, notes: reason, metadata: { kind: input.kind, count, listingId: input.listingId ?? null } })
  return { success: true, count }
}

export async function revokeStrike(strikeId: string): Promise<Result> {
  const admin = await gate()
  const service = createServiceRoleClient() as any
  const { data, error } = await service
    .from('seller_strikes')
    .update({ revoked_at: new Date().toISOString(), revoked_by: admin.userId })
    .eq('id', strikeId)
    .is('revoked_at', null)
    .select('seller_id')
    .maybeSingle()
  if (error) return { success: false, error: error.message }
  if (data?.seller_id) {
    await safeLog({ action: 'seller.strike_revoked', actionCategory: 'seller', resourceType: 'seller', resourceId: data.seller_id, metadata: { strikeId } })
    revalidatePath(`/admin/active-sellers/${data.seller_id}`)
  }
  return { success: true }
}

/** 2 strikes → restricted, 3 → banned. Never downgrades a ban. */
async function escalate(service: any, admin: AdminUser, sellerId: string, count: number, reason: string) {
  if (count < 2) return
  const seller = await sellerContact(service, sellerId)
  if (!seller || seller.seller_status === 'banned') return
  const status = count >= 3 ? 'banned' : 'restricted'
  if (seller.seller_status === status) return
  const now = new Date().toISOString()
  const why = `${count >= 3 ? 'Third' : 'Second'} strike: ${reason}`
  const { error } = await service
    .from('profiles')
    .update({ seller_status: status, seller_restriction_reason: why, seller_restricted_at: now, seller_restricted_by: admin.userId })
    .eq('id', sellerId)
  if (error) {
    console.error('[ModerationTools] escalate failed:', error)
    return
  }
  // Pause what is live, as the manual Restrict does.
  await service.from('listings').update({ status: 'paused' }).eq('seller_id', sellerId).in('status', ['active', 'pending_approval'])
  await service.from('seller_restrictions').insert({ seller_id: sellerId, restricted_by: admin.userId, restriction_type: status, reason: why, metadata: { source: 'strikes', count } })
  await revalidate([], [sellerId])
}

/* ── Listings ───────────────────────────────────────────────────── */

export async function takedownListing(input: { listingId: string; reason: string; strike?: boolean }): Promise<Result> {
  const admin = await gate()
  const reason = input.reason.trim()
  if (reason.length < 3) return { success: false, error: 'Give a reason (at least 3 characters).' }
  const supabase = await createClient()
  const service = createServiceRoleClient() as any
  const { data: listing } = await service.from('listings').select('id, title, seller_id, status').eq('id', input.listingId).maybeSingle()
  if (!listing) return { success: false, error: 'Listing not found' }

  const { error } = await (supabase as any).rpc('takedown_listing', { listing_id: input.listingId, admin_id: admin.userId, reason })
  if (error) return { success: false, error: error.message }

  const seller = await sellerContact(service, listing.seller_id)
  await createNotification({ userId: listing.seller_id, type: 'listing_taken_down', title: 'A listing was removed', message: `${listing.title}: ${reason}`, link: '/account/listings' })
  if (seller?.email) {
    try {
      await sendListingTakenDownEmail({ to: seller.email, name: displayName(seller), listingTitle: listing.title, reason })
    } catch (err) {
      console.error('[ModerationTools] takedown email failed:', err)
    }
  }
  await safeLog({ action: 'listing.takedown', actionCategory: 'moderation', resourceType: 'listing', resourceId: input.listingId, resourceName: listing.title, notes: reason, previousState: { status: listing.status }, newState: { status: 'suspended' } })
  if (input.strike !== false) {
    await issueStrike({ sellerId: listing.seller_id, kind: 'listing_takedown', reason: `Listing removed: ${listing.title}. ${reason}`, listingId: input.listingId })
  }
  await revalidate([input.listingId], [listing.seller_id])
  revalidatePath(`/admin/active-sellers/${listing.seller_id}`)
  return { success: true }
}

export async function restoreListing(listingId: string): Promise<Result> {
  const admin = await gate()
  const supabase = await createClient()
  const service = createServiceRoleClient() as any
  const { data: listing } = await service.from('listings').select('id, title, seller_id, status').eq('id', listingId).maybeSingle()
  if (!listing) return { success: false, error: 'Listing not found' }
  if (listing.status !== 'suspended') return { success: false, error: 'Only a taken-down listing can be restored.' }
  const { error } = await (supabase as any).rpc('restore_listing', { listing_id: listingId, admin_id: admin.userId })
  if (error) return { success: false, error: error.message }
  await createNotification({ userId: listing.seller_id, type: 'listing_restored', title: 'A listing is back', message: `${listing.title} is live again.`, link: '/account/listings' })
  await safeLog({ action: 'listing.restore', actionCategory: 'moderation', resourceType: 'listing', resourceId: listingId, resourceName: listing.title })
  await revalidate([listingId], [listing.seller_id])
  revalidatePath(`/admin/active-sellers/${listing.seller_id}`)
  return { success: true }
}

export async function removeListingImage(input: { listingId: string; imageUrl: string; reason: string; strike?: boolean }): Promise<Result> {
  const admin = await gate()
  const reason = input.reason.trim()
  if (reason.length < 3) return { success: false, error: 'Give a reason (at least 3 characters).' }
  const service = createServiceRoleClient() as any
  const { data: listing } = await service.from('listings').select('id, title, seller_id, status, images').eq('id', input.listingId).maybeSingle()
  if (!listing) return { success: false, error: 'Listing not found' }
  const images: string[] = Array.isArray(listing.images) ? listing.images : []
  if (!images.includes(input.imageUrl)) return { success: false, error: 'That image is not on this listing any more.' }
  const remaining = images.filter((u) => u !== input.imageUrl)

  const { error } = await service.from('listings').update({ images: remaining }).eq('id', input.listingId)
  if (error) return { success: false, error: error.message }
  const path = listingImagePathFromUrl(input.imageUrl)
  if (path) {
    try {
      await service.storage.from(LISTING_IMAGE_BUCKET).remove([path])
    } catch (err) {
      console.error('[ModerationTools] image delete failed:', err)
    }
  }
  const seller = await sellerContact(service, listing.seller_id)
  if (seller?.email) {
    try {
      await sendImageRemovedEmail({ to: seller.email, name: displayName(seller), what: 'listing image', reason })
    } catch (err) {
      console.error('[ModerationTools] image email failed:', err)
    }
  }
  await createNotification({ userId: listing.seller_id, type: 'listing_image_removed', title: 'An image was removed', message: `${listing.title}: ${reason}`, link: `/sell/edit/${input.listingId}` })
  await safeLog({ action: 'listing.image_removed', actionCategory: 'moderation', resourceType: 'listing', resourceId: input.listingId, resourceName: listing.title, notes: reason, metadata: { imageUrl: input.imageUrl } })
  if (input.strike) {
    await issueStrike({ sellerId: listing.seller_id, kind: 'image_removed', reason: `Image removed from ${listing.title}. ${reason}`, listingId: input.listingId })
  }
  // Nothing left to show: it cannot stay live.
  if (remaining.length === 0 && (listing.status === 'active' || listing.status === 'pending_approval')) {
    await takedownListing({ listingId: input.listingId, reason: 'Listing has no images after moderation removed one. Add a new image and resubmit.', strike: false })
  }
  await revalidate([input.listingId], [listing.seller_id])
  revalidatePath(`/admin/active-sellers/${listing.seller_id}`)
  return { success: true }
}

/* ── Avatar ─────────────────────────────────────────────────────── */

export async function resetSellerAvatar(input: { userId: string; reason: string; strike?: boolean; lock?: boolean }): Promise<Result> {
  await gate()
  const reason = input.reason.trim()
  if (reason.length < 3) return { success: false, error: 'Give a reason (at least 3 characters).' }
  const service = createServiceRoleClient() as any
  const seller = await sellerContact(service, input.userId)
  if (!seller) return { success: false, error: 'User not found' }
  const lock = input.lock !== false
  const { error } = await service
    .from('profiles')
    .update({ avatar_url: null, avatar_locked_at: lock ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', input.userId)
  if (error) return { success: false, error: error.message }
  try {
    const { data: files } = await service.storage.from('avatars').list(input.userId)
    const names = (files ?? []).map((f: any) => `${input.userId}/${f.name}`)
    if (names.length) await service.storage.from('avatars').remove(names)
  } catch (err) {
    console.error('[ModerationTools] avatar delete failed:', err)
  }
  if (seller.email) {
    try {
      await sendImageRemovedEmail({ to: seller.email, name: displayName(seller), what: 'profile picture', reason, locked: lock })
    } catch (err) {
      console.error('[ModerationTools] avatar email failed:', err)
    }
  }
  await createNotification({ userId: input.userId, type: 'avatar_reset', title: 'Your profile picture was reset', message: reason, link: '/account/settings' })
  await safeLog({ action: 'user.avatar_reset', actionCategory: 'user', resourceType: 'user', resourceId: input.userId, notes: reason, metadata: { locked: lock } })
  if (input.strike) {
    await issueStrike({ sellerId: input.userId, kind: 'avatar_reset', reason: `Profile picture removed. ${reason}` })
  }
  await revalidate([], [input.userId])
  revalidatePath(`/admin/active-sellers/${input.userId}`)
  return { success: true }
}

export async function unlockSellerAvatar(userId: string): Promise<Result> {
  await gate()
  const service = createServiceRoleClient() as any
  const { error } = await service.from('profiles').update({ avatar_locked_at: null }).eq('id', userId)
  if (error) return { success: false, error: error.message }
  await safeLog({ action: 'user.avatar_unlocked', actionCategory: 'user', resourceType: 'user', resourceId: userId })
  revalidatePath(`/admin/active-sellers/${userId}`)
  return { success: true }
}

/* ── Buyer reports ──────────────────────────────────────────────── */

export type ReportRow = {
  id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  reporter: { id: string; username: string | null }
  listing: { id: string; title: string; status: string; seller_id: string; shop_name: string | null; open_reports: number }
}

export async function listReports(status: 'open' | 'resolved' = 'open', limit = 100): Promise<{ success: boolean; rows: ReportRow[]; error?: string }> {
  await gate()
  const service = createServiceRoleClient() as any
  let q = service
    .from('listing_reports')
    .select('id, reason, details, status, created_at, reporter:profiles!listing_reports_reporter_id_fkey(id, username), listing:listings!listing_reports_listing_id_fkey(id, title, status, seller_id, seller:profiles!listings_seller_id_fkey(shop_name))')
    .order('created_at', { ascending: false })
    .limit(limit)
  q = status === 'open' ? q.eq('status', 'open') : q.neq('status', 'open')
  const { data, error } = await q
  if (error) return { success: false, rows: [], error: error.message }
  const rows = (data ?? []) as any[]
  const perListing = new Map<string, number>()
  for (const r of rows) if (r.status === 'open') perListing.set(r.listing?.id, (perListing.get(r.listing?.id) ?? 0) + 1)
  return {
    success: true,
    rows: rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details ?? null,
      status: r.status,
      created_at: r.created_at,
      reporter: { id: r.reporter?.id, username: r.reporter?.username ?? null },
      listing: {
        id: r.listing?.id,
        title: r.listing?.title ?? '(deleted)',
        status: r.listing?.status ?? 'unknown',
        seller_id: r.listing?.seller_id,
        shop_name: r.listing?.seller?.shop_name ?? null,
        open_reports: perListing.get(r.listing?.id) ?? 0,
      },
    })),
  }
}

/**
 * Uphold: the listing is taken down with the given reason (every open report
 * on it is closed as upheld) and the seller gets a strike. Dismiss: all open
 * reports on the listing are closed; if it was auto-hidden it goes live again.
 */
export async function resolveReport(input: { reportId: string; verdict: 'upheld' | 'dismissed'; reason?: string }): Promise<Result> {
  const admin = await gate()
  const service = createServiceRoleClient() as any
  const { data: report } = await service.from('listing_reports').select('id, listing_id, status').eq('id', input.reportId).maybeSingle()
  if (!report) return { success: false, error: 'Report not found' }
  const now = new Date().toISOString()
  const { error } = await service
    .from('listing_reports')
    .update({ status: input.verdict, resolved_by: admin.userId, resolved_at: now })
    .eq('listing_id', report.listing_id)
    .eq('status', 'open')
  if (error) return { success: false, error: error.message }

  const { data: listing } = await service.from('listings').select('id, title, status, seller_id, moderation_notes').eq('id', report.listing_id).maybeSingle()
  if (listing) {
    if (input.verdict === 'upheld') {
      const reason = (input.reason ?? '').trim() || 'Buyer reports were upheld after review.'
      if (listing.status === 'suspended') {
        // Already hidden by the auto rule: record the reason + strike without a second takedown.
        await service.from('listings').update({ moderation_notes: `Taken down: ${reason}` }).eq('id', listing.id)
        await issueStrike({ sellerId: listing.seller_id, kind: 'report_upheld', reason: `Reports upheld on ${listing.title}. ${reason}`, listingId: listing.id })
        const seller = await sellerContact(service, listing.seller_id)
        if (seller?.email) {
          try {
            await sendListingTakenDownEmail({ to: seller.email, name: displayName(seller), listingTitle: listing.title, reason })
          } catch (err) {
            console.error('[ModerationTools] takedown email failed:', err)
          }
        }
      } else {
        await takedownListing({ listingId: listing.id, reason, strike: true })
      }
    } else if (listing.status === 'suspended' && String(listing.moderation_notes ?? '').startsWith('Auto-hidden')) {
      await restoreListing(listing.id)
    }
  }
  await safeLog({ action: `report.${input.verdict}`, actionCategory: 'moderation', resourceType: 'listing', resourceId: report.listing_id, notes: input.reason })
  await revalidate([report.listing_id], listing ? [listing.seller_id] : [])
  return { success: true }
}
