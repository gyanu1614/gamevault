/**
 * Fee-spec worked examples (spec §8) — these exact numbers are the
 * acceptance tests for the whole fee structure. If any of these fail,
 * the money math has drifted from the published Fees & Charges page.
 */

import { describe, expect, it } from 'vitest'
import {
  buyerFee,
  cashRefundAmount,
  commissionAmount,
  commissionPct,
  netProceeds,
  payoutFee,
  protectionWindowHours,
  round2,
  storeCreditRefundAmount,
} from './index'

const CURRENCY = { categoryMetaType: 'currency', categorySlug: 'buy-vbucks', gameSlug: 'fortnite' }
const ACCOUNT_MID = { categoryMetaType: 'account', categorySlug: 'buy-accounts', gameSlug: 'fortnite' }

describe('worked example A — $100 standard currency sale', () => {
  it('buyer pays $107.00', () => {
    const fee = buyerFee(100)
    expect(fee.amount).toBe(7)
    expect(round2(100 + fee.amount)).toBe(107)
  })
  it('commission 5% = $5.00, seller nets $95.00', () => {
    expect(commissionPct(CURRENCY)).toBe(5)
    expect(commissionAmount(100, CURRENCY)).toBe(5)
    expect(netProceeds(100, CURRENCY)).toBe(95)
  })
  it('DropMarket gross = $12.00 (buyer fee + commission)', () => {
    expect(round2(buyerFee(100).amount + commissionAmount(100, CURRENCY))).toBe(12)
  })
  it('48h payout hold', () => {
    expect(protectionWindowHours(CURRENCY)).toBe(48)
  })
})

describe('worked example B — $300 mid-risk account sale', () => {
  it('buyer pays $321.00', () => {
    expect(round2(300 + buyerFee(300).amount)).toBe(321)
  })
  it('commission 15% = $45.00, seller nets $255.00', () => {
    expect(commissionPct(ACCOUNT_MID)).toBe(15)
    expect(commissionAmount(300, ACCOUNT_MID)).toBe(45)
    expect(netProceeds(300, ACCOUNT_MID)).toBe(255)
  })
  it('DropMarket gross = $66.00', () => {
    expect(round2(buyerFee(300).amount + commissionAmount(300, ACCOUNT_MID))).toBe(66)
  })
  it('7-day (168h) hold for mid-risk accounts', () => {
    expect(protectionWindowHours(ACCOUNT_MID)).toBe(168)
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

describe('spec rules', () => {
  it('Roblox in-game economies pay 10% on currency', () => {
    expect(commissionPct({ categoryMetaType: 'currency', gameSlug: 'steal-a-brainrot' })).toBe(10)
  })
  it('Robux itself is standard 5%', () => {
    expect(commissionPct({ categoryMetaType: 'currency', gameSlug: 'roblox' })).toBe(5)
  })
  it('GTA accounts are high risk: 20% and 14 days', () => {
    const gta = { categoryMetaType: 'account', gameSlug: 'gta-v' }
    expect(commissionPct(gta)).toBe(20)
    expect(protectionWindowHours(gta)).toBe(14 * 24)
  })
  it('top-ups: 5% and 48h', () => {
    const t = { categoryMetaType: 'top_up', gameSlug: 'fortnite' }
    expect(commissionPct(t)).toBe(5)
    expect(protectionWindowHours(t)).toBe(48)
  })
  it('crypto payout: 3% + $10', () => {
    expect(payoutFee(100, 'crypto').fee).toBe(13)
    expect(payoutFee(100, 'crypto').net).toBe(87)
  })
})
