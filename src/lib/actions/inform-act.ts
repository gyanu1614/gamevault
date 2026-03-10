'use server'

/**
 * P6.4 — INFORM Consumers Act Server Actions
 *
 * The INFORM Consumers Act (US, 2023) requires online marketplaces to collect
 * and verify identifying information from "high-volume third-party sellers":
 *  • 200+ discrete sales OR $5,000+ gross in a 12-month period.
 *
 * This module handles:
 *  1. Threshold detection — marks sellers as 'required' when they cross the limit
 *  2. Disclosure submission — sellers fill out the form
 *  3. Admin certification — admin reviews and certifies or rejects
 *  4. Suspension flow — sellers 10+ days overdue after notification get suspended
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'

// ── Constants ──────────────────────────────────────────────────────────────

const INFORM_SALES_THRESHOLD    = parseInt(process.env.INFORM_SALES_THRESHOLD    || '200')
const INFORM_REVENUE_THRESHOLD  = parseFloat(process.env.INFORM_REVENUE_THRESHOLD || '5000')

// ── Types ──────────────────────────────────────────────────────────────────

export interface InformDisclosure {
  id:               string
  seller_id:        string
  legal_name:       string
  address_line1:    string
  address_line2:    string | null
  city:             string
  state_province:   string
  postal_code:      string
  country:          string
  tax_id_last4:     string
  bank_last4:       string | null
  contact_email:    string
  contact_phone:    string
  consented_at:     string
  consent_ip:       string | null
  status:           'submitted' | 'certified' | 'rejected' | 'needs_update'
  submitted_at:     string | null
  certified_at:     string | null
  certified_by:     string | null
  rejection_reason: string | null
  version:          number
  superseded_by:    string | null
  // Joined
  username?:        string | null
  email?:           string | null
  total_sales?:     number
  lifetime_earnings?: number
}

export interface SubmitDisclosureData {
  legalName:      string
  addressLine1:   string
  addressLine2?:  string
  city:           string
  stateProvince:  string
  postalCode:     string
  country:        string
  taxIdLast4:     string
  bankLast4?:     string
  contactEmail:   string
  contactPhone:   string
  consentIp?:     string
}

// ── Threshold check ────────────────────────────────────────────────────────

/**
 * Scans all sellers and marks any who exceed the INFORM threshold as 'required'
 * if they haven't already submitted. Called by admin or a scheduled job.
 */
export async function runInformThresholdCheck(): Promise<{
  success: boolean
  marked: number
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    // Find sellers over threshold who are still 'not_required'
    const { data: sellers } = await supabase
      .from('profiles')
      .select('id, total_sales, lifetime_earnings, inform_status')
      .eq('role', 'seller')
      .eq('inform_status', 'not_required')

    const overThreshold = ((sellers as any[] | null) ?? []).filter(
      s =>
        (s.total_sales       ?? 0) >= INFORM_SALES_THRESHOLD ||
        (s.lifetime_earnings ?? 0) >= INFORM_REVENUE_THRESHOLD
    )

    if (overThreshold.length === 0) return { success: true, marked: 0 }

    const ids = overThreshold.map((s: any) => s.id)
    await (supabase.from('profiles') as any)
      .update({ inform_status: 'required' })
      .in('id', ids)

    // Notify admins about sellers crossing INFORM threshold
    if (ids.length > 0) {
      try {
        const { notifyAdmins } = await import('@/lib/utils/notifications')
        await notifyAdmins({
          permission: 'sellers.review',
          type: 'inform_threshold_crossed',
          title: 'INFORM Act Compliance Required',
          message: `${ids.length} seller(s) have crossed the INFORM Act threshold and need to submit compliance info`,
          link: `/admin/inform`,
        })
        console.log(`[inform] Notified admins about ${ids.length} sellers crossing threshold`)
      } catch (error) {
        console.error('[inform] Failed to notify admins:', error)
      }
    }

    return { success: true, marked: ids.length }
  } catch (err: any) {
    console.error('[inform] runInformThresholdCheck error:', err)
    return { success: false, marked: 0, error: err.message }
  }
}

// ── Seller: check own status ───────────────────────────────────────────────

export async function getMyInformStatus(): Promise<{
  success:    boolean
  status?:    string
  disclosure?: InformDisclosure
  required?:  boolean
  error?:     string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: profile } = await (supabase.from('profiles') as any)
      .select('inform_status, total_sales, lifetime_earnings')
      .eq('id', user.id)
      .single()

    const status   = profile?.inform_status ?? 'not_required'
    const required = status !== 'not_required'

    if (!required) return { success: true, status, required: false }

    // Fetch latest disclosure
    const { data: latest } = await supabase
      .from('inform_disclosures')
      .select('*')
      .eq('seller_id', user.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      success:     true,
      status,
      required:    true,
      disclosure:  (latest as InformDisclosure | null) ?? undefined,
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ── Seller: submit disclosure ──────────────────────────────────────────────

export async function submitInformDisclosure(data: SubmitDisclosureData): Promise<{
  success:  boolean
  error?:   string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Validate last-4 digits only
    if (!/^\d{4}$/.test(data.taxIdLast4)) {
      throw new Error('Tax ID must be last 4 digits (numbers only)')
    }
    if (data.bankLast4 && !/^\d{4}$/.test(data.bankLast4)) {
      throw new Error('Bank last 4 must be 4 digits')
    }

    // Determine next version number
    const { count } = await supabase
      .from('inform_disclosures')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', user.id)

    const nextVersion = (count ?? 0) + 1

    const { error: insertErr } = await (supabase.from('inform_disclosures') as any).insert({
      seller_id:      user.id,
      legal_name:     data.legalName,
      address_line1:  data.addressLine1,
      address_line2:  data.addressLine2  ?? null,
      city:           data.city,
      state_province: data.stateProvince,
      postal_code:    data.postalCode,
      country:        data.country,
      tax_id_last4:   data.taxIdLast4,
      bank_last4:     data.bankLast4     ?? null,
      contact_email:  data.contactEmail,
      contact_phone:  data.contactPhone,
      consent_ip:     data.consentIp     ?? null,
      status:         'submitted',
      version:        nextVersion,
    })

    if (insertErr) throw new Error(insertErr.message)

    // Update profile inform_status
    await (supabase.from('profiles') as any)
      .update({ inform_status: 'submitted' })
      .eq('id', user.id)

    // Notify admins about new INFORM disclosure submission
    try {
      const { notifyAdmins } = await import('@/lib/utils/notifications')
      await notifyAdmins({
        permission: 'sellers.review',
        type: 'inform_disclosure_submitted',
        title: 'New INFORM Act Disclosure',
        message: `${data.legalName} has submitted their INFORM Act disclosure for review`,
        link: `/admin/inform`,
      })
      console.log('[inform] Notified admins about disclosure submission')
    } catch (error) {
      console.error('[inform] Failed to notify admins:', error)
      // Non-fatal
    }

    return { success: true }
  } catch (err: any) {
    console.error('[inform] submitInformDisclosure error:', err)
    return { success: false, error: err.message }
  }
}

// ── Admin: list all disclosures ────────────────────────────────────────────

export async function getInformDisclosures(statusFilter?: string): Promise<{
  success:      boolean
  disclosures?: InformDisclosure[]
  error?:       string
}> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    let query = supabase
      .from('inform_disclosures')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(200)

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data: rawDiscs, error } = await query
    if (error) throw new Error(error.message)

    const discs = (rawDiscs as any[] | null) ?? []
    if (discs.length === 0) return { success: true, disclosures: [] }

    // Join seller profiles
    const sellerIds = Array.from(new Set(discs.map((d: any) => d.seller_id)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, email, total_sales, lifetime_earnings')
      .in('id', sellerIds)

    const pm: Record<string, any> = {}
    for (const p of (profiles as any[] | null) ?? []) pm[p.id] = p

    const enriched: InformDisclosure[] = discs.map((d: any) => ({
      ...d,
      username:         pm[d.seller_id]?.username         ?? null,
      email:            pm[d.seller_id]?.email            ?? null,
      total_sales:      pm[d.seller_id]?.total_sales      ?? 0,
      lifetime_earnings: pm[d.seller_id]?.lifetime_earnings ?? 0,
    }))

    return { success: true, disclosures: enriched }
  } catch (err: any) {
    console.error('[inform] getInformDisclosures error:', err)
    return { success: false, error: err.message }
  }
}

// ── Admin: get sellers who need to submit (above threshold, not yet submitted) ──

export async function getInformRequiredSellers(): Promise<{
  success:  boolean
  sellers?: Array<{
    id: string; username: string | null; email: string | null
    total_sales: number; lifetime_earnings: number; inform_status: string
  }>
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const { data } = await supabase
      .from('profiles')
      .select('id, username, email, total_sales, lifetime_earnings, inform_status')
      .eq('role', 'seller')
      .in('inform_status', ['required', 'rejected'])
      .order('lifetime_earnings', { ascending: false })
      .limit(100)

    return { success: true, sellers: (data as any[] | null) ?? [] }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ── Admin: certify or reject a disclosure ─────────────────────────────────

export async function certifyInformDisclosure(
  disclosureId: string,
  action: 'certified' | 'rejected',
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const admin = await requireAdmin()

    const updatePayload: Record<string, any> = {
      status:       action,
      certified_at: new Date().toISOString(),
      certified_by: admin.userId,
    }
    if (action === 'rejected' && rejectionReason) {
      updatePayload.rejection_reason = rejectionReason
    }

    const { data: disc, error: fetchErr } = await supabase
      .from('inform_disclosures')
      .select('seller_id')
      .eq('id', disclosureId)
      .single()

    if (fetchErr || !disc) throw new Error('Disclosure not found')

    const { error } = await (supabase.from('inform_disclosures') as any)
      .update(updatePayload)
      .eq('id', disclosureId)

    if (error) throw new Error(error.message)

    // Update seller's inform_status on their profile
    const newProfileStatus = action === 'certified' ? 'certified' : 'rejected'
    await (supabase.from('profiles') as any)
      .update({ inform_status: newProfileStatus })
      .eq('id', (disc as any).seller_id)

    return { success: true }
  } catch (err: any) {
    console.error('[inform] certifyInformDisclosure error:', err)
    return { success: false, error: err.message }
  }
}
