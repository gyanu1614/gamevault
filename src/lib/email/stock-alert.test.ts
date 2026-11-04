import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/email', async (orig) => ({ ...(await orig<typeof import('@/lib/email')>()), sendTransactionalEmail: vi.fn() }))

import { stockAlertHtml, stockAlertSubject } from './stock-alert'

const base = { name: 'sam', itemName: 'Frost Dragon', gameName: 'Adopt Me', url: 'https://dropmarket.gg/adopt-me/buy-items/item/frost-dragon', imageUrl: null }

describe('stock alert email', () => {
  it('names the item in the subject', () => {
    expect(stockAlertSubject('Frost Dragon')).toBe('Frost Dragon is on DropMarket now')
  })

  it('links the item page and says the alert is one-time', () => {
    const html = stockAlertHtml(base)
    expect(html).toContain(base.url)
    expect(html).toContain('Buy Frost Dragon')
    expect(html).toContain('one-time alert')
  })

  it('escapes names that came from user or catalogue data', () => {
    const html = stockAlertHtml({ ...base, name: '<img src=x onerror=alert(1)>', itemName: 'Pet <b>' })
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('Pet <b>')
  })
})
