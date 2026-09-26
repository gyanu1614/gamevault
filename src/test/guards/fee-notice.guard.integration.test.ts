/**
 * Fee engine PR 7, Part 5 — seller fee notice (integration).
 *
 *   · the template carries every fact from the spec (schedule start, founding
 *     half-price, payout fees/minimums, seller gate, hold, dispute window) and
 *     never says "escrow";
 *   · dry run lists the recipient and renders the email without sending;
 *   · send claims BEFORE sending and is at-most-once: a second run sends
 *     nothing to an already-claimed seller; a provider failure is recorded on
 *     the claim row and is not retried automatically.
 * Email transport is mocked (CLAUDE.md) — nothing leaves the test.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from './throwaway'

const sent: Array<{ to: string; subject: string; html: string }> = []
let failNext = false

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  const stubs = Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
  return {
    ...stubs,
    escapeHtmlText: real.escapeHtmlText,
    sendTransactionalEmail: async (m: { to: string; subject: string; html: string }) => {
      if (failNext) { failNext = false; return { success: false, error: { message: 'resend down' } } }
      sent.push(m)
      return { success: true, data: { id: `msg_${sent.length}` } }
    },
  }
})
let adminId = ''
vi.mock('@/lib/actions/admin-permissions', () => ({
  requireRole: async () => ({ userId: adminId, role: 'admin' }),
  requireAdmin: async () => ({ userId: adminId, role: 'admin' }),
  requirePermission: async () => ({ userId: adminId, role: 'admin' }),
}))

let fx: Fixture | null = null
let ready = false

describe.skipIf(!hasEnv)('PR 7 Part 5 — fee notice: facts, dry run, at-most-once send (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    adminId = fx.admin.id
    ready = !(await fx.svc.rpc('seller_notice_claim' as any, { p_notice_key: 'probe', p_user_id: fx.admin.id, p_email: 'probe@example.com' })).error
    await fx.svc.from('seller_notice_sends' as any).delete().eq('notice_key', 'probe')
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    await fx.svc.from('seller_notice_sends' as any).delete().in('user_id', [fx.seller.id, fx.buyer.id, fx.admin.id])
    await fx.cleanup()
  }, 60_000)

  it('migration is applied', () => {
    expect(ready, 'apply 20260923033757_seller_notice_sends first').toBe(true)
  })

  it('the template carries every fact and no forbidden wording', async () => {
    const { buildFeeNoticeEmail } = await import('@/lib/email/fee-notice')
    const facts = {
      ratesStartAt: '2026-10-08T00:00:00.000Z', foundingPeriodText: 'first year', foundingDiscountPct: 50,
      methods: [{ displayName: 'Crypto (USDT)', feeText: '3% + $5', minWithdrawal: 50 }, { displayName: 'Payoneer', feeText: '3% (minimum fee $5)', minWithdrawal: 100 }],
      minAccountAgeDays: 30, completionHoldHours: 24, disputeWindowDays: 7, payoutFreezeHours: 48,
      sellFeesUrl: 'https://dropmarket.gg/sell/fees', settingsUrl: 'https://dropmarket.gg/account/settings?tab=payouts',
    }
    const { subject, html } = buildFeeNoticeEmail('Ava <b>', facts)
    expect(subject).toContain('8 October 2026')
    expect(html).toContain('8 October 2026')
    expect(html).toContain('half-price')
    expect(html).toContain('first year')
    expect(html).toContain('3% + $5')
    expect(html).toContain('min $50')
    expect(html).toContain('3% (minimum fee $5)')
    expect(html).toContain('min $100')
    expect(html).toContain('30 days')
    expect(html).toContain('1 day</strong> later')
    expect(html).toContain('7 days')
    expect(html).toContain('https://dropmarket.gg/sell/fees')
    expect(html).toContain('Ava &lt;b&gt;') // escaped
    expect(html.toLowerCase()).not.toMatch(/\bescrow\b|holding funds|we hold/)
  })

  it('facts come from the database (start date from the PR 4 rules, terms from the tables)', async () => {
    const { loadFeeNoticeFacts } = await import('@/lib/actions/fee-notice')
    const f = await loadFeeNoticeFacts()
    const { data: rule } = await (fx!.svc as any).from('fee_rules').select('starts_at').like('note', 'PR4:%').order('starts_at').limit(1).maybeSingle()
    if (rule) expect(f.ratesStartAt).toBe(new Date(rule.starts_at).toISOString())
    expect(f.methods.map((m) => m.displayName).sort()).toEqual(['Crypto (USDT)', 'Payoneer'])
    expect(f.methods.find((m) => m.displayName === 'Payoneer')).toMatchObject({ feeText: '3% (minimum fee $5)', minWithdrawal: 100 })
    expect(f.methods.find((m) => m.displayName === 'Crypto (USDT)')).toMatchObject({ feeText: '3% + $5', minWithdrawal: 50 })
    expect(f).toMatchObject({ minAccountAgeDays: 30, completionHoldHours: 24, disputeWindowDays: 7, payoutFreezeHours: 48 })
  })

  it('dry run lists the seller and renders the email without sending', async () => {
    const { previewFeeNotice } = await import('@/lib/actions/fee-notice')
    const p = await previewFeeNotice()
    expect(p.success).toBe(true)
    expect(p.recipients?.some((r) => r.id === fx!.seller.id)).toBe(true)
    expect(p.recipients?.some((r) => r.id === fx!.buyer.id)).toBe(false) // not a seller
    expect(p.html).toContain('Changes to your seller fees')
    expect(sent).toHaveLength(0)
  })

  it('send is at-most-once per seller; a provider failure is recorded, not retried', async () => {
    const { sendFeeNotice, previewFeeNotice } = await import('@/lib/actions/fee-notice')
    const before = sent.length
    const email = await sellerEmail()
    const r1 = await sendFeeNotice({ confirm: 'SEND' })
    expect(r1.success).toBe(true)
    const mine = sent.slice(before).filter((m) => m.to === email)
    expect(mine).toHaveLength(1)
    const { data: row } = await (fx!.svc as any).from('seller_notice_sends').select('*').eq('notice_key', r1.noticeKey).eq('user_id', fx!.seller.id).single()
    expect(row.sent_at).toBeTruthy()
    expect(row.provider_id).toMatch(/^msg_/)
    expect(row.claimed_by).toBe(fx!.admin.id)

    // Second run: the seller is claimed → nothing sent to them again.
    const before2 = sent.length
    const r2 = await sendFeeNotice({ confirm: 'SEND' })
    expect(r2.success).toBe(true)
    expect(sent.slice(before2).filter((m) => m.to === row.email)).toHaveLength(0)
    const p = await previewFeeNotice()
    expect(p.recipients?.some((x) => x.id === fx!.seller.id)).toBe(false)
    expect(p.alreadySent).toBeGreaterThanOrEqual(1)

    // Wrong confirmation word never sends.
    const r3 = await sendFeeNotice({ confirm: 'send' as any })
    expect(r3.success).toBe(false)

    // Provider failure: claim stays, error recorded, no automatic retry.
    await (fx!.svc as any).from('seller_notice_sends').delete().eq('notice_key', r1.noticeKey).eq('user_id', fx!.seller.id)
    failNext = true
    const before3 = sent.length
    const r4 = await sendFeeNotice({ confirm: 'SEND' })
    expect(r4.failed).toBeGreaterThanOrEqual(1)
    expect(sent.length - before3).toBe(0)
    const { data: failedRow } = await (fx!.svc as any).from('seller_notice_sends').select('*').eq('notice_key', r1.noticeKey).eq('user_id', fx!.seller.id).single()
    expect(failedRow.error).toContain('resend down')
    expect(failedRow.sent_at).toBeNull()
    const r5 = await sendFeeNotice({ confirm: 'SEND' })
    expect(r5.success).toBe(true)
    expect(sent.slice(before3).filter((m) => m.to === row.email)).toHaveLength(0) // still claimed → not retried
  })

  it('the claim RPC answers true exactly once per (key, seller)', async () => {
    const key = `guard:${Math.random().toString(36).slice(2, 8)}`
    const a = await fx!.svc.rpc('seller_notice_claim' as any, { p_notice_key: key, p_user_id: fx!.seller.id, p_email: 'X@Example.com' })
    const b = await fx!.svc.rpc('seller_notice_claim' as any, { p_notice_key: key, p_user_id: fx!.seller.id, p_email: 'x@example.com' })
    expect(a.data).toBe(true)
    expect(b.data).toBe(false)
    const { data: row } = await (fx!.svc as any).from('seller_notice_sends').select('email').eq('notice_key', key).eq('user_id', fx!.seller.id).single()
    expect(row.email).toBe('x@example.com')
    await fx!.svc.from('seller_notice_sends' as any).delete().eq('notice_key', key)
  })
})

async function sellerEmail(): Promise<string> {
  const { data } = await fx!.svc.from('profiles').select('email').eq('id', fx!.seller.id).single()
  return String((data as any)?.email ?? '').toLowerCase()
}
