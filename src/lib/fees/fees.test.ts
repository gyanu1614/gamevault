/**
 * Fee-grid worked examples — these exact numbers are the acceptance tests for
 * the whole fee structure (grid approved 8 Sep 2026: currency 10, items 10,
 * accounts 15 + per-game overrides, top-up 5 flat; rank multipliers
 * 1.00/0.95/0.90/0.85/0.80, top-up exempt). If any of these fail, the money
 * math has drifted from the published fee schedule.
 */

import { describe, expect, it } from 'vitest'
import {
  buyerFee,
  cashRefundAmount,
  commissionAmount,
  commissionPct,
  DEFAULT_FEE_CONFIG,
  netProceeds,
  payoutFee,
  protectionWindowHours,
  round2,
  sellerFeeFields,
  storeCreditRefundAmount,
} from './index'

const CURRENCY = { categoryMetaType: 'currency', categorySlug: 'buy-vbucks', gameSlug: 'fortnite' }
const ITEMS = { categoryMetaType: 'item', categorySlug: 'buy-items', gameSlug: 'fortnite' }
const ACCOUNT = { categoryMetaType: 'account', categorySlug: 'buy-accounts', gameSlug: 'fortnite' }
const TOPUP = { categoryMetaType: 'top_up', gameSlug: 'rainbow-six-siege' }

describe('worked example A — $100 currency sale (bronze seller)', () => {
  it('buyer pays $107.00', () => {
    const fee = buyerFee(100)
    expect(fee.amount).toBe(7)
    expect(round2(100 + fee.amount)).toBe(107)
  })
  it('commission 10% = $10.00, seller nets $90.00', () => {
    expect(commissionPct(CURRENCY)).toBe(10)
    expect(commissionAmount(100, CURRENCY)).toBe(10)
    expect(netProceeds(100, CURRENCY)).toBe(90)
  })
  it('48h payout hold', () => {
    expect(protectionWindowHours(CURRENCY)).toBe(48)
  })
})

describe('worked example B — $300 account sale', () => {
  it('commission 15% = $45.00, seller nets $255.00', () => {
    expect(commissionPct(ACCOUNT)).toBe(15)
    expect(commissionAmount(300, ACCOUNT)).toBe(45)
    expect(netProceeds(300, ACCOUNT)).toBe(255)
  })
  it('7-day (168h) hold for mid-risk accounts', () => {
    expect(protectionWindowHours(ACCOUNT)).toBe(168)
  })
})

describe('worked example C — $255 fiat payout', () => {
  it('fee $5.83, seller receives $249.17', () => {
    const { fee, net } = payoutFee(255, 'fiat')
    expect(fee).toBe(5.83)
    expect(net).toBe(249.17)
  })
})

describe('worked example D — store-credit refund of example A', () => {
  it('buyer credited $107.00 instantly', () => {
    expect(storeCreditRefundAmount(107)).toBe(107)
  })
})

describe('worked example E — cash refund of example A (PSP fee $3.75)', () => {
  it('buyer receives $103.25', () => {
    expect(cashRefundAmount(107, 3.75)).toBe(103.25)
  })
})

describe('category grid', () => {
  it('items are 10%', () => {
    expect(commissionPct(ITEMS)).toBe(10)
  })
  it('GTA accounts carry a 20% game override and 14-day hold', () => {
    const gta = { categoryMetaType: 'account', gameSlug: 'gta-v' }
    expect(commissionPct(gta)).toBe(20)
    expect(protectionWindowHours(gta)).toBe(14 * 24)
  })
  it('top-ups: 5% and 48h', () => {
    expect(commissionPct(TOPUP)).toBe(5)
    expect(protectionWindowHours(TOPUP)).toBe(48)
  })
  it('crypto payout: 3% + $10', () => {
    expect(payoutFee(100, 'crypto').fee).toBe(13)
    expect(payoutFee(100, 'crypto').net).toBe(87)
  })
})

describe('rank fee multipliers', () => {
  it('bronze/no tier pays the base rate', () => {
    expect(commissionPct({ ...ITEMS, sellerTier: 'bronze' })).toBe(10)
    expect(commissionPct(ITEMS)).toBe(10)
  })
  it('the ladder is 10 / 9.5 / 9 / 8.5 / 8 on items', () => {
    expect(commissionPct({ ...ITEMS, sellerTier: 'silver' })).toBe(9.5)
    expect(commissionPct({ ...ITEMS, sellerTier: 'gold' })).toBe(9)
    expect(commissionPct({ ...ITEMS, sellerTier: 'diamond' })).toBe(8.5)
    expect(commissionPct({ ...ITEMS, sellerTier: 'legendary' })).toBe(8)
  })
  it('applies to accounts (15 → 12 at legendary), including game overrides', () => {
    expect(commissionPct({ ...ACCOUNT, sellerTier: 'legendary' })).toBe(12)
    expect(commissionPct({ categoryMetaType: 'account', gameSlug: 'gta-v', sellerTier: 'legendary' })).toBe(16)
  })
  it('does NOT apply to top-ups (flat 5% for every rank)', () => {
    expect(commissionPct({ ...TOPUP, sellerTier: 'legendary' })).toBe(5)
  })
  it('unknown tier strings fall back to no discount', () => {
    expect(commissionPct({ ...ITEMS, sellerTier: 'quartz' })).toBe(10)
  })
})

describe('founding-seller discount (2 pts, after the multiplier)', () => {
  it('is off by default', () => {
    expect(commissionPct(CURRENCY)).toBe(10)
    expect(commissionPct({ ...CURRENCY, isFounding: false })).toBe(10)
  })
  it('takes 2 points off the resolved rate', () => {
    expect(commissionPct({ ...ITEMS, isFounding: true })).toBe(8)
    expect(commissionPct({ ...ACCOUNT, isFounding: true })).toBe(13)
    expect(commissionPct({ ...ITEMS, sellerTier: 'legendary', isFounding: true })).toBe(6)
  })
  it('flows through to commissionAmount and netProceeds', () => {
    expect(commissionAmount(100, { ...ITEMS, isFounding: true })).toBe(8)
    expect(netProceeds(100, { ...ITEMS, isFounding: true })).toBe(92)
  })
})

describe('per-seller admin override', () => {
  it('replaces every other rule when set', () => {
    expect(
      commissionPct({ ...ACCOUNT, sellerTier: 'legendary', isFounding: true, feeOverridePct: 5 }),
    ).toBe(5)
  })
  it('sellerFeeFields enforces expiry', () => {
    const future = new Date(Date.now() + 86400_000).toISOString()
    const past = new Date(Date.now() - 86400_000).toISOString()
    expect(
      sellerFeeFields({ seller_tier: 'gold', fee_override_pct: 4, fee_override_expires_at: future })
        .feeOverridePct,
    ).toBe(4)
    expect(
      sellerFeeFields({ seller_tier: 'gold', fee_override_pct: 4, fee_override_expires_at: past })
        .feeOverridePct,
    ).toBeNull()
    expect(
      sellerFeeFields({ seller_tier: 'gold', fee_override_pct: 4, fee_override_expires_at: null })
        .feeOverridePct,
    ).toBe(4)
    expect(sellerFeeFields({ seller_tier: 'gold' }).feeOverridePct).toBeNull()
  })
})

describe('config snapshot plumbing', () => {
  it('a custom snapshot (admin-edited values) is honoured', () => {
    const cfg = {
      ...DEFAULT_FEE_CONFIG,
      categories: {
        ...DEFAULT_FEE_CONFIG.categories,
        items: { basePct: 12, rankDiscount: true },
      },
    }
    expect(commissionPct(ITEMS, cfg)).toBe(12)
    expect(commissionPct({ ...ITEMS, sellerTier: 'legendary' }, cfg)).toBe(9.6)
  })
})
