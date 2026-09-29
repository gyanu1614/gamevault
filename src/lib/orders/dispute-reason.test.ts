import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { disputeReasonFor } from './dispute-reason'

describe('disputeReasonFor', () => {
  it('maps the modal labels whatever their case', () => {
    expect(disputeReasonFor('Item Not As Described')).toBe('not_as_described')
    expect(disputeReasonFor('item not as described')).toBe('not_as_described')
    expect(disputeReasonFor('Did Not Receive Order')).toBe('item_not_received')
    expect(disputeReasonFor('Wrong Item Received')).toBe('wrong_item')
    expect(disputeReasonFor('Account Credentials Invalid')).toBe('account_issue')
    expect(disputeReasonFor('Other')).toBe('other')
  })

  it('unknown text falls back to other', () => {
    expect(disputeReasonFor('something else')).toBe('other')
    expect(disputeReasonFor(null)).toBe('other')
  })

  it('every category the dispute modal offers maps to a real reason', () => {
    const src = readFileSync('src/app/account/orders/[orderId]/_DisputeModal.tsx', 'utf8')
    const block = src.slice(src.indexOf('DISPUTE_CATEGORIES = ['), src.indexOf('] as const'))
    const labels = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      const reason = disputeReasonFor(label)
      if (label.toLowerCase() !== 'other') expect(reason, label).not.toBe('other')
    }
  })
})
