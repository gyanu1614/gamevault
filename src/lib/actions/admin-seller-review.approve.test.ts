/**
 * ACC-02 — approveApplication computes identity BEFORE granting the role.
 * A gap returns requiresAcknowledgement with nothing written; acknowledging
 * it approves with profiles.kyc_status = 'pending'; a verified identity
 * approves with kyc_status = 'approved'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  docs: [] as Array<{ document_type: string; verified: boolean; file_path: string }>,
  profileUpdates: [] as Array<Record<string, unknown>>,
  appUpdates: [] as Array<Record<string, unknown>>,
  audits: [] as Array<Record<string, unknown>>,
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendApplicationApprovedEmail: vi.fn(async () => ({ success: true })) }))
vi.mock('@/lib/admin/activity-log', () => ({ logAdminActivity: vi.fn(async () => undefined) }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async (a: Record<string, unknown>) => { h.audits.push(a) }) }))
vi.mock('@/lib/revalidation/listings', () => ({ revalidateSellerStorefront: vi.fn(async () => undefined) }))
vi.mock('@/lib/seller/entry-tier', () => ({ getEntryTier: async () => 'bronze' }))
vi.mock('./admin-permissions', () => ({
  requireRole: async () => ({ userId: 'admin-1', role: 'admin', email: 'a@x' }),
  requireAdmin: async () => ({ userId: 'admin-1', role: 'admin', email: 'a@x' }),
}))
vi.mock('@/lib/listings/submit-applicant-drafts', () => ({ submitApplicantDrafts: vi.fn(async () => ({ submitted: [], skipped: [] })) }))

function chain(table: string, kind: 'session' | 'service') {
  const b: any = {}
  for (const m of ['select', 'eq', 'in', 'order', 'limit']) b[m] = () => b
  const row = () => {
    if (table === 'seller_applications') return { user_id: 'user-1', display_name: 'Shop', shop_name: 'Shop', full_legal_name: 'U', alternate_email: null, profiles: { email: 'u@x', full_name: 'U', username: 'u', is_founding_applicant: false } }
    if (table === 'profiles') return null // shop_slug uniqueness probe: none exists → also badges probe
    return null
  }
  b.single = async () => ({ data: row(), error: null })
  b.maybeSingle = async () => ({ data: row(), error: null })
  b.update = (patch: Record<string, unknown>) => {
    if (table === 'profiles') h.profileUpdates.push(patch)
    if (table === 'seller_applications') h.appUpdates.push(patch)
    return b
  }
  b.insert = () => b
  b.then = (ok: any) => Promise.resolve({ data: table === 'seller_kyc_documents' ? h.docs : null, error: null }).then(ok)
  void kind
  return b
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: (t: string) => chain(t, 'session') }) }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: (t: string) => chain(t, 'service') }) }))

import { approveApplication } from '@/lib/actions/admin-seller-review'

beforeEach(() => { h.docs = []; h.profileUpdates = []; h.appUpdates = []; h.audits = [] })

describe('approveApplication — identity before role (ACC-02)', () => {
  it('ID + selfie missing → requiresAcknowledgement, nothing granted', async () => {
    const res = await approveApplication('app-1', 'notes')
    expect(res.success).toBe(false)
    expect(res.requiresAcknowledgement).toBe(true)
    expect(res.kycGap).toMatchObject({ verified: false, missing: ['Government ID', 'Selfie with ID'] })
    expect(h.profileUpdates).toEqual([])
    expect(h.appUpdates).toEqual([])
  })

  it('uploaded but unverified → still a gap', async () => {
    h.docs = [{ document_type: 'id_front', verified: false, file_path: 'a' }, { document_type: 'selfie_with_id', verified: false, file_path: 'b' }]
    const res = await approveApplication('app-1')
    expect(res.requiresAcknowledgement).toBe(true)
    expect(res.kycGap?.unverified).toEqual(['Government ID', 'Selfie with ID'])
    expect(h.profileUpdates).toEqual([])
  })

  it('acknowledged gap → approved, kyc_status pending, identity_verified false, audit records the acknowledgement', async () => {
    const res = await approveApplication('app-1', undefined, false, { acknowledgeKycGap: true })
    expect(res.success).toBe(true)
    expect(h.profileUpdates[0]).toMatchObject({ role: 'seller', kyc_status: 'pending' })
    expect(h.appUpdates[0]).toMatchObject({ status: 'approved', identity_verified: false })
    expect(h.audits[0]).toMatchObject({ new_data: expect.objectContaining({ kyc_gap_acknowledged: true }) })
  })

  it('verified ID + selfie → approved with kyc_status approved and identity_verified true', async () => {
    h.docs = [{ document_type: 'id_front', verified: true, file_path: 'a' }, { document_type: 'selfie_with_id', verified: true, file_path: 'b' }]
    const res = await approveApplication('app-1')
    expect(res.success).toBe(true)
    expect(h.profileUpdates[0]).toMatchObject({ role: 'seller', kyc_status: 'approved' })
    expect(h.appUpdates[0]).toMatchObject({ identity_verified: true })
  })
})
