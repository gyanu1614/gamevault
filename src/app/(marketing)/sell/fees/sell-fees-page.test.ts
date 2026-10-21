import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { PublicFeeSchedule, PublicWithdrawalTerms } from '@/lib/fees/public-rates'
import { feeFacts, sellFeesFaq, payoutRails } from './_fees-content'

const DIR = join(process.cwd(), 'src/app/(marketing)/sell/fees')

const schedule = {
  categories: [
    { type: 'currency', label: 'In-game currency', pct: 5, nextPct: null },
    { type: 'items', label: 'In-game items', pct: 10, nextPct: null },
    { type: 'account', label: 'Game accounts', pct: null, nextPct: null },
  ],
  overrides: [],
  ranks: [],
  rankFloorPct: 8,
  founding: { discountPct: 50, months: 12 },
  noticeDays: 14,
  effectiveFrom: '2026-10-07T00:00:00+00:00',
  nextChange: null,
  generatedAt: '2026-10-15T00:00:00+00:00',
} as unknown as PublicFeeSchedule

const terms = {
  methods: [
    { name: 'payoneer', displayName: 'Payoneer', type: 'fiat', feePct: 3, feeFixed: 0, feeMin: 5, minWithdrawal: 50, maxWithdrawal: null },
    { name: 'usdt_trc20', displayName: 'USDT (TRC-20)', type: 'crypto', feePct: 3, feeFixed: 5, feeMin: 0, minWithdrawal: 50, maxWithdrawal: null },
    { name: 'usdt_erc20', displayName: 'USDT (ERC-20)', type: 'crypto', feePct: 3, feeFixed: 5, feeMin: 0, minWithdrawal: 75, maxWithdrawal: null },
    { name: 'btc', displayName: 'Bitcoin (BTC)', type: 'crypto', feePct: 3, feeFixed: 5, feeMin: 0, minWithdrawal: 50, maxWithdrawal: null },
  ],
  completionHoldHours: 24,
  disputeWindowDays: 7,
  minAccountAgeDays: 30,
  payoutFreezeHours: 48,
  windows: [],
  generatedAt: '2026-10-15T00:00:00+00:00',
} as unknown as PublicWithdrawalTerms

// Owner, 2026-10-15: /sell/fees in the new UI. The numbers stay live from
// the fee tables; nothing on the page is typed by hand.
describe('/sell/fees', () => {
  it('the hero facts are computed from the live schedule and payout terms', () => {
    const facts = feeFacts(schedule, terms)
    expect(facts.map((f) => f.title)).toEqual(['No Listing Fee', 'Commission From 5%', 'Withdraw From $50', 'Rates From 7 October 2026'])
    expect(facts[2].body).toBe('Payoneer, USDT and Bitcoin.')
  })

  it('payout rails collapse network variants into one name each', () => {
    expect(payoutRails(terms.methods)).toEqual(['Payoneer', 'USDT', 'Bitcoin'])
  })

  it('the FAQ states the live notice period, and the markup uses the same list', () => {
    const faq = sellFeesFaq(schedule, terms)
    expect(faq.find((f) => /notice/.test(f.q))?.a).toMatch(/14 days' notice/)
    const page = readFileSync(join(DIR, 'page.tsx'), 'utf8')
    expect(page).toMatch(/faqPage\(faq\)/)
    expect(page).toMatch(/items=\{faq\}/)
  })

  it('no em dash in any visible string of the page', () => {
    for (const f of readdirSync(DIR).filter((n) => /\.tsx?$/.test(n) && !n.endsWith('.test.ts'))) {
      const code = readFileSync(join(DIR, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      expect(code, f).not.toMatch(/[—–]/)
    }
  })
})
