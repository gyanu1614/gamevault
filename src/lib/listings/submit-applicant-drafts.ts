/**
 * GRO-08 (server half) — drafts an applicant built while their application
 * was under review are submitted the moment the application is approved.
 *
 * "Submitted" means exactly what publishListing would have done with the same
 * payload: the shared validator decides whether the draft is complete, the
 * seller's publish policy decides active vs pending_approval (moderation
 * rules unchanged), the listing cap is honoured, and the category pages are
 * revalidated. A draft that fails validation stays a draft and is named in
 * the email so the seller can finish it.
 *
 * Only drafts marked metadata.applicant_draft = true are touched — a draft
 * the seller keeps on purpose after approval is never auto-submitted.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateListingWrite } from './validate'
import { loadListingRuleContext } from './rule-context'
import { decidePublishStatus } from './publish-status'
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'

type Client = SupabaseClient<any, any, any, any, any>

export const APPLICANT_DRAFT_KEY = 'applicant_draft'

export interface SubmittedDraft { id: string; title: string; status: 'active' | 'pending_approval' }
export interface SkippedDraft { id: string; title: string; reason: string }
export interface SubmitApplicantDraftsResult { submitted: SubmittedDraft[]; skipped: SkippedDraft[] }

interface DraftRow {
  id: string
  title: string
  description: string | null
  price: number
  original_price: number | null
  quantity: number
  min_quantity: number
  delivery_method: string
  delivery_time: string | null
  images: string[] | null
  template_data: Record<string, unknown> | null
  region: string | null
  platform: string | null
  bundle_id: string | null
  game_id: string
  metadata: Record<string, unknown> | null
  pair: { type: string } | null
}

interface Policy { needs_moderation: boolean; auto_approve_single: boolean; listing_limit: number | null; active_count: number }

export async function submitApplicantDrafts(service: Client, userId: string): Promise<SubmitApplicantDraftsResult> {
  const result: SubmitApplicantDraftsResult = { submitted: [], skipped: [] }

  const { data: rows, error } = await service
    .from('listings')
    .select('id, title, description, price, original_price, quantity, min_quantity, delivery_method, delivery_time, images, template_data, region, platform, bundle_id, game_id, metadata, pair:game_categories!listings_game_category_id_fkey (type)')
    .eq('seller_id', userId)
    .eq('status', 'draft')
    .eq(`metadata->>${APPLICANT_DRAFT_KEY}`, 'true')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`applicant drafts: ${error.message}`)
  const drafts = (rows ?? []) as unknown as DraftRow[]
  if (drafts.length === 0) return result

  const { data: policyRaw, error: policyErr } = await service.rpc('get_seller_publish_policy', { p_user_id: userId })
  if (policyErr) throw new Error(`publish policy: ${policyErr.message}`)
  const policy = policyRaw as Policy
  let activeCount = Number(policy.active_count ?? 0)

  const touched: string[] = []
  for (const d of drafts) {
    const categoryType = d.pair?.type ?? 'items'
    const rules = await loadListingRuleContext(service, d.game_id, categoryType)
    const validated = validateListingWrite(
      {
        title: d.title ?? '',
        description: d.description ?? '',
        price: Number(d.price),
        original_price: d.original_price == null ? null : Number(d.original_price),
        quantity: d.quantity,
        min_quantity: d.min_quantity,
        delivery_method: d.delivery_method,
        delivery_time: d.delivery_time,
        images: d.images ?? [],
        template_data: d.template_data ?? {},
        region: d.region,
        platform: d.platform,
        bundle_id: d.bundle_id,
        status: 'active',
      },
      rules,
    )
    if (!validated.ok) {
      result.skipped.push({ id: d.id, title: d.title, reason: validated.error })
      continue
    }
    if (policy.listing_limit != null && activeCount >= policy.listing_limit) {
      result.skipped.push({ id: d.id, title: d.title, reason: `active-listing cap (${policy.listing_limit}) reached` })
      continue
    }
    const status = decidePublishStatus(policy, 'active') as 'active' | 'pending_approval'
    const metadata = { ...(d.metadata ?? {}) }
    delete metadata[APPLICANT_DRAFT_KEY]
    const { data: written, error: updErr } = await service
      .from('listings')
      .update({ ...validated.value, status, metadata })
      .eq('id', d.id)
      .eq('seller_id', userId)
      .eq('status', 'draft')
      .select('status')
      .maybeSingle()
    if (updErr || !written) {
      result.skipped.push({ id: d.id, title: d.title, reason: updErr?.message ?? 'could not be submitted' })
      continue
    }
    const landed = ((written as { status: string }).status === 'active' ? 'active' : 'pending_approval') as SubmittedDraft['status']
    if (landed === 'active') activeCount++
    result.submitted.push({ id: d.id, title: validated.value.title || d.title, status: landed })
    touched.push(d.id)
  }

  if (touched.length > 0) {
    await revalidateListingSurfaces(service as never, { listingIds: touched })
  }
  return result
}
