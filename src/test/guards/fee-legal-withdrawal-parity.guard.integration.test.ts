/**
 * Fee engine PR 7 — the numbers the legal document quotes for withdrawals must
 * equal the data the RPCs charge from. /fees is static copy (documents.ts);
 * withdrawal_methods / platform_fee_settings / order_completion_windows are
 * the truth. If an admin changes a number, this test fails until the legal
 * text is updated — the legal document may not silently drift from the code.
 * Also: no "escrow" / "holding funds" wording in the PR 7 copy.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { LEGAL_DOCS } from '@/lib/legal/documents'
import { hasEnv, URL, SVC } from './throwaway'

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

  it('/fees Withdrawals quotes every active method with its exact fee and minimum', () => {
    const text = sectionText('fees', 'Withdrawals')
    const crypto = methods.find((x) => x.method_name === 'usdt_trc20')
    const payoneer = methods.find((x) => x.method_name === 'payoneer')
    expect(crypto, 'usdt_trc20 must exist and be active').toBeTruthy()
    expect(payoneer, 'payoneer must exist and be active').toBeTruthy()
    // Crypto: "3% + $5 per payout; minimum withdrawal $50."
    expect(text).toContain(`${fmt(crypto.fee_percentage)}% + $${fmt(crypto.fee_fixed)} per payout; minimum withdrawal $${fmt(crypto.min_withdrawal)}`)
    // Payoneer: "3% per payout with a $5 minimum fee; minimum withdrawal $100."
    expect(text).toContain(`${fmt(payoneer.fee_percentage)}% per payout with a $${fmt(payoneer.fee_min)} minimum fee; minimum withdrawal $${fmt(payoneer.min_withdrawal)}`)
    // Hold, gate, freeze.
    expect(text).toContain(`${settings.completion_hold_hours} hours after the Buyer confirms receipt`)
    expect(text).toContain(`withdrawals open ${settings.withdrawal_min_account_age_days} days after`)
    expect(text).toContain(`pauses withdrawals for ${settings.payout_details_freeze_hours} hours`)
    // Every crypto method shares one term (the copy says "USDT" once).
    for (const m of methods.filter((x) => x.method_type === 'crypto')) {
      expect(Number(m.fee_percentage)).toBe(Number(crypto.fee_percentage))
      expect(Number(m.fee_fixed)).toBe(Number(crypto.fee_fixed))
      expect(Number(m.min_withdrawal)).toBe(Number(crypto.min_withdrawal))
    }
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
