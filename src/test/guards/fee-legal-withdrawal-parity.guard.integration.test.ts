/**
 * Fee engine PR 7 — the numbers the legal documents quote must equal the
 * data the RPCs charge from (withdrawal_methods / platform_fee_settings /
 * order_completion_windows). /fees Withdrawals renders its numbers live from
 * those tables (lib/fees/withdrawal-legal); the protection-window tables are
 * still copy, so an admin change fails this test until the text follows.
 * Also: no "escrow" / "holding funds" wording in the PR 7 copy.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { LEGAL_DOCS } from '@/lib/legal/documents'
import { hasEnv, URL, SVC } from './throwaway'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))

let svc: SupabaseClient
const fmt = (n: number) => Number(n).toFixed(2).replace(/\.?0+$/, '')
const hoursWord = (h: number) => (h % 24 === 0 ? `${h / 24} day${h === 24 ? '' : 's'}` : `${h} hours`)

function docText(slug: string): string {
  const doc = LEGAL_DOCS.find((d: any) => d.slug === slug) as any
  return JSON.stringify(doc)
}
function sectionText(slug: string, heading: string): string {
  const doc = LEGAL_DOCS.find((d: any) => d.slug === slug) as any
  const sec = doc.sections.find((s: any) => s.h === heading)
  if (!sec) throw new Error(`${slug}: no section "${heading}"`)
  return JSON.stringify(sec)
}

describe.skipIf(!hasEnv)('PR 7 — legal withdrawal copy == fee data (integration)', () => {
  let methods: any[] = []
  let settings: any = null
  let windows: any[] = []

  beforeAll(async () => {
    svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    const [m, s, w] = await Promise.all([
      svc.from('withdrawal_methods').select('*').eq('is_active', true).eq('coming_soon', false),
      svc.from('platform_fee_settings').select('*').eq('id', true).single(),
      (svc as any).from('order_completion_windows').select('*'),
    ])
    methods = m.data ?? []
    settings = s.data
    windows = w.data ?? []
  })

  it('/fees Withdrawals types in no payout number; the live block quotes every active method', async () => {
    // 2026-10-23: the typed-in copy said a $100 Payoneer minimum while the
    // live table said $50. The numbers now render from the table itself.
    const text = sectionText('fees', 'Withdrawals')
    expect(text).not.toMatch(/\$\d|\d+%|\d+ hours|\d+ days/)
    const { getPublicWithdrawalTerms } = await import('@/lib/fees/public-rates')
    const { withdrawalTermsBlocks } = await import('@/lib/fees/withdrawal-legal')
    const live = JSON.stringify(withdrawalTermsBlocks(await getPublicWithdrawalTerms()))
    expect(methods.length, 'at least one active payout method').toBeGreaterThan(0)
    for (const m of methods) {
      expect(live, m.method_name).toContain(m.display_name)
      expect(live, m.method_name).toContain(`$${fmt(m.min_withdrawal)}`)
    }
    expect(live).toContain(`${settings.completion_hold_hours} hours after the Buyer confirms receipt`)
    expect(live).toContain(`withdrawals open ${settings.withdrawal_min_account_age_days} days after`)
    expect(live).toContain(`pauses withdrawals for ${hoursWord(settings.payout_details_freeze_hours)}`)
  })

  it('SafeDrop / refunds protection-window tables match order_completion_windows', () => {
    const byType = Object.fromEntries(windows.map((w) => [w.category_type, Number(w.auto_complete_hours)]))
    const safedrop = sectionText('safedrop', '2. What SafeDrop covers')
    expect(safedrop).toContain(`["In-game currency","${hoursWord(byType.currency)}"]`)
    expect(safedrop).toContain(`["Items","${hoursWord(byType.items)}"]`)
    expect(safedrop).toContain(`["Top-ups / gift cards","${hoursWord(byType.top_up)}"]`)
    expect(safedrop).toContain(`["Game accounts","${hoursWord(byType.account)}"]`)
    expect(safedrop).toContain(`${settings.dispute_window_days} days from delivery`)
    const refunds = docText('refunds')
    expect(refunds).toContain(`"${hoursWord(byType.account)} from delivery"`)
    expect(refunds).toContain(`"${hoursWord(byType.currency)} from delivery"`)
    expect(refunds).toContain(`"${hoursWord(byType.items)} from delivery"`)
    expect(refunds).toContain(`${settings.dispute_window_days} days from delivery`)
    expect(docText('buyer-terms')).toContain(`${settings.dispute_window_days} days from delivery`)
  })

  it('PR 7 copy never says "escrow" or "holding funds"', () => {
    for (const slug of ['fees', 'safedrop', 'refunds', 'buyer-terms']) {
      const text = docText(slug).toLowerCase()
      const sec = slug === 'fees' ? sectionText('fees', 'Withdrawals').toLowerCase() : text
      expect(sec, `${slug} mentions escrow`).not.toMatch(/\bescrow\b/)
      expect(sec, `${slug} says "holding funds"`).not.toMatch(/holding funds|hold(s|ing)? your funds|we hold/)
    }
  })
})
