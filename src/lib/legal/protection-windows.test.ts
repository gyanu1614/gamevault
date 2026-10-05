/**
 * The public protection / dispute / payout numbers come from ONE module, and
 * that module equals what the money layer enforces (the seeded defaults in
 * migration 20260923025457). The live-DB check is
 * src/test/guards/fee-legal-withdrawal-parity.guard.integration.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  COMPLETION_HOLD_HOURS,
  DISPUTE_WINDOW_DAYS,
  PAYOUT_DETAILS_FREEZE_HOURS,
  PROTECTION_WINDOW_HOURS,
  WITHDRAWAL_MIN_ACCOUNT_AGE_DAYS,
  hoursAsDays,
  hoursAsDaysTitle,
  protectionWindowSummary,
} from './protection-windows'
import { PAYMENT_PROCESSORS, PUBLIC_PAYMENT_PROVIDER_KEYS } from './payment-processors'
import { LEGAL_DOCS, LEGAL_ENTITY, getLegalDoc } from './documents'

const ROOT = join(__dirname, '../../..')
const MIGRATION = readFileSync(join(ROOT, 'supabase/migrations/20260923025457_order_completion_release.sql'), 'utf8')
const docText = (slug: string) => JSON.stringify(getLegalDoc(slug))

describe('protection windows mirror the money layer', () => {
  it('PROTECTION_WINDOW_HOURS equals the order_completion_windows seed', () => {
    const insert = /INSERT INTO public\.order_completion_windows[^;]*VALUES([^;]*?)ON CONFLICT/s.exec(MIGRATION)
    expect(insert, 'seed INSERT found').toBeTruthy()
    const seeded = Object.fromEntries(
      [...insert![1].matchAll(/\('(\w+)',\s*(\d+)\)/g)].map((m) => [m[1], Number(m[2])]),
    )
    expect(seeded).toEqual(PROTECTION_WINDOW_HOURS)
  })

  it('the platform_fee_settings defaults equal the dispute / hold / withdrawal constants', () => {
    const def = (col: string) => Number(new RegExp(`${col} integer NOT NULL DEFAULT (\\d+)`).exec(MIGRATION)?.[1])
    expect(def('dispute_window_days')).toBe(DISPUTE_WINDOW_DAYS)
    expect(def('completion_hold_hours')).toBe(COMPLETION_HOLD_HOURS)
    expect(def('withdrawal_min_account_age_days')).toBe(WITHDRAWAL_MIN_ACCOUNT_AGE_DAYS)
    expect(def('payout_details_freeze_hours')).toBe(PAYOUT_DETAILS_FREEZE_HOURS)
  })

  it('top-ups and gift cards share one window (the copy states them together)', () => {
    expect(PROTECTION_WINDOW_HOURS.top_up).toBe(PROTECTION_WINDOW_HOURS.gift_card)
    expect(PROTECTION_WINDOW_HOURS.currency).toBe(PROTECTION_WINDOW_HOURS.top_up)
  })
})

describe('hoursAsDays', () => {
  it('formats whole days and leftover hours', () => {
    expect(hoursAsDays(24)).toBe('1 day')
    expect(hoursAsDays(72)).toBe('3 days')
    expect(hoursAsDays(36)).toBe('36 hours')
    expect(hoursAsDaysTitle(24)).toBe('1 Day')
    expect(hoursAsDaysTitle(120)).toBe('5 Days')
  })

  it('the FAQ summary names every window', () => {
    const s = protectionWindowSummary()
    for (const h of new Set(Object.values(PROTECTION_WINDOW_HOURS))) expect(s).toContain(hoursAsDays(h))
  })
})

describe('legal documents render the shared numbers', () => {
  it('Buyer Terms, SafeDrop Terms and Refund Policy all state the dispute window', () => {
    for (const slug of ['buyer-terms', 'safedrop', 'refunds']) {
      expect(docText(slug), slug).toContain(`${DISPUTE_WINDOW_DAYS} days from delivery`)
    }
  })

  it('the SafeDrop and Refund tables carry the windows', () => {
    const W = PROTECTION_WINDOW_HOURS
    expect(docText('safedrop')).toContain(`["Game accounts","${hoursAsDays(W.account)}"]`)
    expect(docText('safedrop')).toContain(`["In-game currency","${hoursAsDays(W.currency)}"]`)
    expect(docText('refunds')).toContain(`"${hoursAsDays(W.items)} from delivery"`)
  })

  it('Refund Policy Stage 3 allows a dispute after completion, as order_dispute_open does', () => {
    const t = docText('refunds')
    expect(t).not.toMatch(/not yet Completed/)
    expect(t).toMatch(/including after the Order has completed/)
  })

  it('no document still promises a 14-day account window or paid warranty tiers', () => {
    const all = JSON.stringify(LEGAL_DOCS)
    expect(all).not.toMatch(/14-day protection/)
    expect(all).not.toMatch(/payout caps to be published/)
    expect(all).not.toMatch(/takes effect at public launch/)
  })

  it('Buyer Terms never tie the Seller being credited to the Buyer confirming', () => {
    expect(docText('buyer-terms')).not.toMatch(/credited only after|paid (out )?only after/i)
    expect(docText('refunds')).not.toMatch(/paid out only after/i)
  })
})

describe('payment processors', () => {
  it('no retired or planned provider is named anywhere in the legal pack', () => {
    const all = JSON.stringify(LEGAL_DOCS)
    for (const name of ['CoinGate', 'Tazapay', 'Glocash', 'Stripe']) expect(all).not.toContain(name)
  })

  it('every live processor is named on the Fees page and in the Privacy Policy', () => {
    for (const p of PAYMENT_PROCESSORS) {
      expect(docText('fees')).toContain(p.name)
      expect(docText('privacy')).toContain(p.name)
    }
    expect(PUBLIC_PAYMENT_PROVIDER_KEYS.has('coingate')).toBe(false)
  })

  it('the homepage FAQ names no retired provider', () => {
    const faq = readFileSync(join(ROOT, 'src/features/home/components/HomeFaq.tsx'), 'utf8')
    expect(faq).not.toMatch(/CoinGate/)
  })
})

describe('company details match the footer', () => {
  it('registered office, VAT number and phone are the footer values', () => {
    const footer = readFileSync(join(ROOT, 'src/components/footer.tsx'), 'utf8')
    expect(footer).toContain(`office: '${LEGAL_ENTITY.registeredOffice}'`)
    expect(footer).toContain(`vat: '${LEGAL_ENTITY.vatNumber}'`)
    expect(footer).toContain(`phone: '${LEGAL_ENTITY.phone}'`)
    expect(docText('company')).toContain(LEGAL_ENTITY.vatNumber)
  })
})
