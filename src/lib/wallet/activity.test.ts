import { describe, expect, it } from 'vitest'
import type { WithdrawalRequest } from '@/lib/actions/withdrawals'
import { filterActivity, groupByDay, signedMoney, toActivity, type PurchaseInput, type SaleInput } from './activity'

const sale = (over: Partial<SaleInput> = {}): SaleInput => ({
  id: 's1',
  orderId: 'o1',
  orderNumber: 'DM-1',
  buyerUsername: 'pat',
  netAmount: 49.99,
  status: 'completed',
  createdAt: '2026-11-06T10:00:00Z',
  listingTitle: 'Frost Dragon',
  gameName: 'Adopt Me',
  gameImageUrl: 'game.png',
  listingImageUrl: null,
  ...over,
})
const purchase = (over: Partial<PurchaseInput> = {}): PurchaseInput => ({
  id: 'p1',
  orderId: 'o2',
  orderNumber: 'DM-2',
  amount: 20,
  status: 'completed',
  createdAt: '2026-11-05T10:00:00Z',
  title: 'Robux',
  gameName: 'Roblox',
  ...over,
})
const request = (over: Partial<WithdrawalRequest> = {}) =>
  ({ id: 'w1', amount: 100, net_amount: 92, status: 'pending', created_at: '2026-11-06T12:00:00Z', method_name: 'usdt_tron', method: { display_name: 'USDT (TRC-20)' }, ...over }) as WithdrawalRequest

describe('toActivity', () => {
  it('puts every movement in one list, newest first', () => {
    const rows = toActivity({ sales: [sale()], purchases: [purchase()], requests: [request()] })
    expect(rows.map((r) => r.kind)).toEqual(['withdrawal', 'sale', 'purchase'])
  })

  it('money in is positive, money out negative', () => {
    const rows = toActivity({ sales: [sale()], purchases: [purchase()], requests: [request()] })
    expect(rows.find((r) => r.kind === 'sale')!.amount).toBe(49.99)
    expect(rows.find((r) => r.kind === 'purchase')!.amount).toBe(-20)
    expect(rows.find((r) => r.kind === 'withdrawal')!.amount).toBe(-100)
  })

  it('a sale and a purchase open their order; a withdrawal opens its details', () => {
    const rows = toActivity({ sales: [sale()], requests: [request()] })
    expect(rows.find((r) => r.kind === 'sale')!.href).toBe('/account/orders/o1')
    expect(rows.find((r) => r.kind === 'withdrawal')!.href).toBeNull()
    expect(rows.find((r) => r.kind === 'withdrawal')!.request?.id).toBe('w1')
  })

  it('says what a withdrawal pays and where', () => {
    const row = toActivity({ requests: [request()] })[0]
    expect(row.title).toBe('Withdrawal To USDT (TRC-20)')
    expect(row.sub).toBe('You receive $92.00')
  })

  it('marks what never moved', () => {
    expect(toActivity({ sales: [sale({ status: 'refunded' })] })[0].voided).toBe(true)
    expect(toActivity({ requests: [request({ status: 'rejected' })] })[0].voided).toBe(true)
    expect(toActivity({ sales: [sale()] })[0].voided).toBe(false)
  })

  it('prefers the item picture, then the game picture', () => {
    expect(toActivity({ sales: [sale({ listingImageUrl: 'item.png' })] })[0].imageUrl).toBe('item.png')
    expect(toActivity({ sales: [sale()] })[0].imageUrl).toBe('game.png')
  })
})

describe('filterActivity', () => {
  const rows = toActivity({ sales: [sale()], purchases: [purchase()], requests: [request()] })
  it('narrows by kind', () => {
    expect(filterActivity(rows, 'sales', '').map((r) => r.kind)).toEqual(['sale'])
    expect(filterActivity(rows, 'withdrawals', '').map((r) => r.kind)).toEqual(['withdrawal'])
    expect(filterActivity(rows, 'purchases', '').map((r) => r.kind)).toEqual(['purchase'])
    expect(filterActivity(rows, 'all', '')).toHaveLength(3)
  })
  it('searches the title, game, buyer and order number', () => {
    expect(filterActivity(rows, 'all', 'frost')).toHaveLength(1)
    expect(filterActivity(rows, 'all', 'ROBLOX')).toHaveLength(1)
    expect(filterActivity(rows, 'all', 'pat')).toHaveLength(1)
    expect(filterActivity(rows, 'all', 'dm-2')).toHaveLength(1)
    expect(filterActivity(rows, 'all', 'nothing')).toHaveLength(0)
  })
})

describe('signedMoney', () => {
  it('writes the sign the way a statement does', () => {
    expect(signedMoney(49.9)).toBe('+$49.90')
    expect(signedMoney(-100)).toBe('−$100.00')
  })
})

describe('groupByDay', () => {
  const now = new Date(2026, 10, 6, 15)
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 9).toISOString()
  const rowsOn = (...dates: string[]) => toActivity({ sales: dates.map((createdAt, i) => sale({ id: `s${i}`, createdAt })) })

  it('names today and yesterday', () => {
    const days = groupByDay(rowsOn(at(2026, 10, 6), at(2026, 10, 5)), now)
    expect(days.map((d) => d.label)).toEqual(['Today', 'Yesterday'])
  })
  it('dates the rest, with the year only when it differs', () => {
    const days = groupByDay(rowsOn(at(2026, 9, 2), at(2025, 9, 2)), now)
    expect(days.map((d) => d.label)).toEqual(['Oct 2', 'Oct 2, 2025'])
  })
  it('keeps one day together', () => {
    const days = groupByDay(rowsOn(at(2026, 10, 6), at(2026, 10, 6)), now)
    expect(days).toHaveLength(1)
    expect(days[0].rows).toHaveLength(2)
  })
})
