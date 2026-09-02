'use server'

/**
 * Seller-lead CRM actions — OUTBOUND concierge outreach tracking.
 *
 * Distinct from early-seller.ts (inbound public waitlist). These power the
 * admin tool where you log sellers you FOUND (on EpicNPC/Sythe/G2G/Eldorado/
 * Discord) and are courting 1:1 — the tooling for the sales motion that
 * acquires the first sellers. Admin-only; all writes via the service-role
 * client (RLS blocks the anon key entirely). See migration
 * 20260824000000_seller_leads.sql.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireAdmin } from './admin-permissions'
import { revalidatePath } from 'next/cache'

export type SellerLeadStatus =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'negotiating'
  | 'signed_up'
  | 'converted'
  | 'passed'
  | 'lost'

export const SELLER_LEAD_STATUSES: SellerLeadStatus[] = [
  'new',
  'contacted',
  'replied',
  'negotiating',
  'signed_up',
  'converted',
  'passed',
  'lost',
]

export interface SellerLead {
  id: string
  handle: string
  source: string | null
  contact: string | null
  game: string | null
  status: SellerLeadStatus
  notes: string | null
  last_contacted: string | null
  next_follow_up: string | null
  created_at: string
  updated_at: string
}

type Result = { ok: true } | { ok: false; error: string }
type ListResult =
  | { ok: true; leads: SellerLead[] }
  | { ok: false; error: string }

const SELECT =
  'id, handle, source, contact, game, status, notes, last_contacted, next_follow_up, created_at, updated_at'

/** Admin-only — the full lead pipeline, newest-touched first. */
export async function getSellerLeads(): Promise<ListResult> {
  try {
    await requireAdmin()
  } catch {
    return { ok: false, error: 'Not authorized.' }
  }
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await (supabase as any)
      .from('seller_leads')
      .select(SELECT)
      .order('updated_at', { ascending: false })
    if (error) {
      console.error('[seller-leads] list failed:', error)
      return { ok: false, error: 'Failed to load leads.' }
    }
    return { ok: true, leads: (data ?? []) as SellerLead[] }
  } catch (err) {
    console.error('[seller-leads] list error:', err)
    return { ok: false, error: 'Failed to load leads.' }
  }
}

export interface CreateSellerLeadInput {
  handle: string
  source?: string | null
  contact?: string | null
  game?: string | null
  notes?: string | null
  status?: SellerLeadStatus
  next_follow_up?: string | null
}

/** Admin-only — add a lead you found. `handle` is the only required field. */
export async function createSellerLead(
  input: CreateSellerLeadInput,
): Promise<Result> {
  try {
    await requireAdmin()
  } catch {
    return { ok: false, error: 'Not authorized.' }
  }
  const handle = input.handle?.trim()
  if (!handle) return { ok: false, error: 'A handle is required.' }
  const status = input.status ?? 'new'
  if (!SELLER_LEAD_STATUSES.includes(status)) {
    return { ok: false, error: 'Invalid status.' }
  }
  try {
    const supabase = createServiceRoleClient()
    const { error } = await (supabase as any).from('seller_leads').insert({
      handle,
      source: input.source?.trim() || null,
      contact: input.contact?.trim() || null,
      game: input.game?.trim() || null,
      notes: input.notes?.trim() || null,
      status,
      next_follow_up: input.next_follow_up || null,
      // First touch: 'contacted'+ means we've reached out, stamp last_contacted.
      last_contacted: status !== 'new' ? new Date().toISOString() : null,
    })
    if (error) {
      console.error('[seller-leads] create failed:', error)
      return { ok: false, error: 'Failed to add lead.' }
    }
    revalidatePath('/admin/seller-leads')
    return { ok: true }
  } catch (err) {
    console.error('[seller-leads] create error:', err)
    return { ok: false, error: 'Failed to add lead.' }
  }
}

export interface UpdateSellerLeadInput {
  status?: SellerLeadStatus
  notes?: string | null
  contact?: string | null
  game?: string | null
  source?: string | null
  next_follow_up?: string | null
  /** When true, stamp last_contacted = now (used by a "mark contacted" action). */
  touchContacted?: boolean
}

/** Admin-only — edit a lead (status, notes, follow-up, etc.). */
export async function updateSellerLead(
  id: string,
  input: UpdateSellerLeadInput,
): Promise<Result> {
  try {
    await requireAdmin()
  } catch {
    return { ok: false, error: 'Not authorized.' }
  }
  if (input.status && !SELLER_LEAD_STATUSES.includes(input.status)) {
    return { ok: false, error: 'Invalid status.' }
  }
  const patch: Record<string, unknown> = {}
  if (input.status !== undefined) patch.status = input.status
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null
  if (input.contact !== undefined) patch.contact = input.contact?.trim() || null
  if (input.game !== undefined) patch.game = input.game?.trim() || null
  if (input.source !== undefined) patch.source = input.source?.trim() || null
  if (input.next_follow_up !== undefined) patch.next_follow_up = input.next_follow_up || null
  if (input.touchContacted) patch.last_contacted = new Date().toISOString()

  if (Object.keys(patch).length === 0) return { ok: true }

  try {
    const supabase = createServiceRoleClient()
    const { error } = await (supabase as any)
      .from('seller_leads')
      .update(patch)
      .eq('id', id)
    if (error) {
      console.error('[seller-leads] update failed:', error)
      return { ok: false, error: 'Failed to update lead.' }
    }
    revalidatePath('/admin/seller-leads')
    return { ok: true }
  } catch (err) {
    console.error('[seller-leads] update error:', err)
    return { ok: false, error: 'Failed to update lead.' }
  }
}

/** Admin-only — delete a lead (mistaken entry / cleanup). */
export async function deleteSellerLead(id: string): Promise<Result> {
  try {
    await requireAdmin()
  } catch {
    return { ok: false, error: 'Not authorized.' }
  }
  try {
    const supabase = createServiceRoleClient()
    const { error } = await (supabase as any)
      .from('seller_leads')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('[seller-leads] delete failed:', error)
      return { ok: false, error: 'Failed to delete lead.' }
    }
    revalidatePath('/admin/seller-leads')
    return { ok: true }
  } catch (err) {
    console.error('[seller-leads] delete error:', err)
    return { ok: false, error: 'Failed to delete lead.' }
  }
}
