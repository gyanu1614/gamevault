import { describe, expect, it } from 'vitest'
import { inboxOrderLabel } from './inbox-row'

describe('inboxOrderLabel', () => {
  it('names the currency, not the amount', () => {
    expect(inboxOrderLabel({ categoryType: 'currency', categoryName: 'Currency', currencyName: 'Robux' })).toBe(
      'Order For Robux',
    )
    expect(inboxOrderLabel({ categoryType: 'currency', categoryName: 'Currency', currencyName: 'V-Bucks' })).toBe(
      'Order For V-Bucks',
    )
  })

  it('falls back to the category name, then a generic label, for currency', () => {
    expect(inboxOrderLabel({ categoryType: 'currency', categoryName: 'Credits' })).toBe('Order For Credits')
    expect(inboxOrderLabel({ categoryType: 'currency', categoryName: null })).toBe('Order For Currency')
  })

  it('uses fixed labels for items and accounts', () => {
    expect(inboxOrderLabel({ categoryType: 'items', categoryName: 'Pets' })).toBe('Order For Items')
    expect(inboxOrderLabel({ categoryType: 'account', categoryName: 'Accounts' })).toBe('Order For Accounts')
  })

  it('uses the category name for other types, null when unknown', () => {
    expect(inboxOrderLabel({ categoryType: 'top_up', categoryName: 'Top Ups' })).toBe('Order For Top Ups')
    expect(inboxOrderLabel({ categoryType: null, categoryName: null })).toBeNull()
  })
})
