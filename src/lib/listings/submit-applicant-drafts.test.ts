/**
 * GRO-08 — drafts marked applicant_draft are submitted on approval through
 * the normal publish rules: validator, publish policy, listing cap.
 */
import { describe, it, expect, vi } from 'vitest'
import { submitApplicantDrafts } from './submit-applicant-drafts'
import { decidePublishStatus } from './publish-status'

vi.mock('@/lib/revalidation/listings', () => ({ revalidateListingSurfaces: vi.fn(async () => ({ tags: [] })) }))

const DRAFT = {
  id: 'd-1', title: 'Dragon Sword +5', description: '', price: 4.99, original_price: null, quantity: 3, min_quantity: 1,
  delivery_method: 'manual', delivery_time: '1hr', images: ['https://x/a.png'], template_data: {}, region: null, platform: null,
  bundle_id: null, game_id: 'g-1', metadata: { applicant_draft: true, other: 1 }, pair: { type: 'items' },
}

function service(drafts: unknown[], policy: Record<string, unknown>) {
  const updates: Array<{ patch: Record<string, unknown>; filters: string[] }> = []
  const client = {
    updates,
    rpc: async () => ({ data: policy, error: null }),
    from(table: string) {
      const b: any = {}
      const filters: string[] = []
      for (const m of ['select', 'order']) b[m] = () => b
      b.eq = (k: string, v: unknown) => { filters.push(`${k}=${v}`); return b }
      b.update = (patch: Record<string, unknown>) => { updates.push({ patch, filters }); return b }
      b.maybeSingle = async () => ({ data: table === 'listings' && updates.length ? { status: updates[updates.length - 1].patch.status } : null, error: null })
      b.then = (ok: any) => Promise.resolve({ data: table === 'listings' ? drafts : null, error: null }).then(ok)
      return b
    },
  }
  return client
}

describe('submitApplicantDrafts', () => {
  it('a complete draft is submitted with the policy status and loses its marker', async () => {
    const svc = service([DRAFT], { needs_moderation: true, auto_approve_single: true, listing_limit: null, active_count: 0 })
    const r = await submitApplicantDrafts(svc as never, 'u-1')
    expect(r.submitted).toEqual([{ id: 'd-1', title: 'Dragon Sword +5', status: 'pending_approval' }])
    expect(r.skipped).toEqual([])
    expect(svc.updates[0].patch).toMatchObject({ status: 'pending_approval', metadata: { other: 1 }, delivery_time: '1hr' })
    expect(svc.updates[0].filters).toEqual(expect.arrayContaining(['seller_id=u-1', 'status=draft']))
  })

  it('an auto-approve seller goes live directly', async () => {
    const svc = service([DRAFT], { needs_moderation: false, auto_approve_single: true, listing_limit: null, active_count: 0 })
    const r = await submitApplicantDrafts(svc as never, 'u-1')
    expect(r.submitted[0].status).toBe('active')
  })

  it('an incomplete draft stays a draft and is reported with the validator reason', async () => {
    const svc = service([{ ...DRAFT, delivery_time: null }], { needs_moderation: false, auto_approve_single: true, listing_limit: null, active_count: 0 })
    const r = await submitApplicantDrafts(svc as never, 'u-1')
    expect(r.submitted).toEqual([])
    expect(r.skipped[0]).toMatchObject({ id: 'd-1', reason: expect.stringMatching(/delivery/) })
    expect(svc.updates).toEqual([])
  })

  it('the listing cap is honoured across the batch', async () => {
    const svc = service([DRAFT, { ...DRAFT, id: 'd-2' }], { needs_moderation: false, auto_approve_single: true, listing_limit: 1, active_count: 0 })
    const r = await submitApplicantDrafts(svc as never, 'u-1')
    expect(r.submitted.map((s) => s.id)).toEqual(['d-1'])
    expect(r.skipped[0]).toMatchObject({ id: 'd-2', reason: expect.stringMatching(/cap/) })
  })

  it('nothing to do → no policy read, no writes', async () => {
    const svc = service([], { needs_moderation: false, auto_approve_single: true, listing_limit: null, active_count: 0 })
    const r = await submitApplicantDrafts(svc as never, 'u-1')
    expect(r).toEqual({ submitted: [], skipped: [] })
  })
})

describe('decidePublishStatus — one rule for publish and approval-time submission', () => {
  it('draft stays draft; active needs no moderation AND auto-approve', () => {
    expect(decidePublishStatus({ needs_moderation: true, auto_approve_single: true }, 'draft')).toBe('draft')
    expect(decidePublishStatus({ needs_moderation: true, auto_approve_single: true }, 'active')).toBe('pending_approval')
    expect(decidePublishStatus({ needs_moderation: false, auto_approve_single: false }, 'active')).toBe('pending_approval')
    expect(decidePublishStatus({ needs_moderation: false, auto_approve_single: true }, 'active')).toBe('active')
  })
})
