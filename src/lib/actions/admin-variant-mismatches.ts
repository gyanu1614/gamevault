'use server'

/**
 * Admin "Variant Mismatches" (Adopt Me): listings whose title names another
 * variant than the seller's Trait pick. Listed when the page opens; fixed one
 * row at a time or every clear row at once. A fix switches the pick to what the
 * title names, re-links through THE link, revalidates the listing surfaces
 * through the seam, and is logged.
 */
import { revalidatePath } from 'next/cache'
import { requireRole } from './admin-permissions'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { logAdminActivity } from '@/lib/admin/activity-log'
import { isUuid } from '@/lib/ids'
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
import { linkListingsToValueItems } from '@/lib/value-listings/link'
import { findVariantMismatches, switchTraitPicks, type VariantMismatch } from '@/lib/value-listings/variant-mismatches'

export type VariantMismatchView = Omit<VariantMismatch, 'templateData'>

type Result<T> = { success: true; data: T } | { success: false; error: string }

const ROLES = ['admin', 'super_admin', 'moderator'] as const
const PAGE_SIZE = 25
/** One click fixes at most this many; press again for the rest. */
const FIX_ALL_CAP = 500
/** `.in('id', …)` stays well under URL limits. */
const ID_CHUNK = 100

const gate = () => requireRole([...ROLES] as never)
const page = (n: unknown) => (Number.isInteger(n) && (n as number) > 0 ? (n as number) : 1)
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function loadVariantMismatches(
  pageNumber = 1,
): Promise<Result<{ rows: VariantMismatchView[]; total: number; page: number; pageSize: number }>> {
  await gate()
  try {
    const all = await findVariantMismatches(createServiceRoleClient() as never)
    const p = Math.min(page(pageNumber), Math.max(1, Math.ceil(all.length / PAGE_SIZE)))
    const rows = all.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE).map(({ templateData: _, ...view }) => view)
    return { success: true, data: { rows, total: all.length, page: p, pageSize: PAGE_SIZE } }
  } catch (e) {
    return { success: false, error: message(e) }
  }
}

async function applyFixes(rows: VariantMismatch[]): Promise<Result<{ fixed: number; skipped: number }>> {
  const service = createServiceRoleClient() as never
  const out = await switchTraitPicks(service, rows)
  for (let i = 0; i < out.fixed.length; i += ID_CHUNK) {
    const ids = out.fixed.slice(i, i + ID_CHUNK)
    // Re-link first, so the revalidated pages read the new variant.
    await linkListingsToValueItems(service, ids)
    await revalidateListingSurfaces(service, { listingIds: ids })
  }
  revalidatePath('/admin/variant-mismatches')
  if (out.fixed.length > 0) {
    try {
      await logAdminActivity({
        action: 'listing.variant_fixed',
        actionCategory: 'moderation',
        resourceType: 'listing',
        resourceId: out.fixed.length === 1 ? out.fixed[0] : undefined,
        metadata: { count: out.fixed.length, ids: out.fixed.slice(0, 50), switchedTo: rows.map((r) => r.switchTo.label).slice(0, 50) },
      })
    } catch (e) {
      console.error('[variant-mismatches] activity log failed:', e)
    }
  }
  if (out.errors.length > 0) return { success: false, error: `Fixed ${out.fixed.length}; ${out.errors.length} failed: ${out.errors[0]}` }
  return { success: true, data: { fixed: out.fixed.length, skipped: out.skipped.length } }
}

/** Fix one row. Re-checks it first: only a row that is still a mismatch is changed. */
export async function fixVariantMismatch(listingId: string): Promise<Result<{ fixed: number; skipped: number }>> {
  await gate()
  if (!isUuid(listingId)) return { success: false, error: 'Invalid listing' }
  try {
    const rows = await findVariantMismatches(createServiceRoleClient() as never, { ids: [listingId] })
    if (rows.length === 0) return { success: true, data: { fixed: 0, skipped: 1 } }
    return await applyFixes(rows)
  } catch (e) {
    return { success: false, error: message(e) }
  }
}

/** "Fix All Clear Cases": every current mismatch (each one names exactly one variant), up to the cap. */
export async function fixAllVariantMismatches(): Promise<Result<{ fixed: number; skipped: number; remaining: number }>> {
  await gate()
  try {
    const all = await findVariantMismatches(createServiceRoleClient() as never)
    const res = await applyFixes(all.slice(0, FIX_ALL_CAP))
    if (!res.success) return res
    return { success: true, data: { ...res.data, remaining: Math.max(0, all.length - FIX_ALL_CAP) } }
  } catch (e) {
    return { success: false, error: message(e) }
  }
}
