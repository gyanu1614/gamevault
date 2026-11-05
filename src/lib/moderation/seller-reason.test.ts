import { describe, expect, it } from 'vitest'
import { sellerFacingReason } from './seller-reason'

describe('sellerFacingReason', () => {
  it('a rejected listing shows the rejection reason', () => {
    expect(sellerFacingReason({ status: 'rejected', rejection_reason: 'Price is far off the market', moderation_notes: null }))
      .toEqual({ label: 'Reason', text: 'Price is far off the market' })
  })

  it('a rejected listing falls back to the note when older rows have no reason', () => {
    expect(sellerFacingReason({ status: 'rejected', rejection_reason: null, moderation_notes: 'Wrong game' }))
      .toEqual({ label: 'Reason', text: 'Wrong game' })
  })

  it('a change request shows what was asked', () => {
    expect(sellerFacingReason({ status: 'changes_requested', rejection_reason: null, moderation_notes: 'Add a clear photo' }))
      .toEqual({ label: 'Requested', text: 'Add a clear photo' })
  })

  it('a take-down shows the reason without the staff prefix', () => {
    expect(sellerFacingReason({ status: 'suspended', rejection_reason: null, moderation_notes: 'Taken down: No offsite trading' }))
      .toEqual({ label: 'Reason', text: 'No offsite trading' })
  })

  it('an automatic hide says it is under review and hides the report count', () => {
    expect(sellerFacingReason({ status: 'suspended', rejection_reason: null, moderation_notes: 'Auto-hidden: 3 buyer reports, awaiting review' }))
      .toEqual({ label: 'Reason', text: 'Hidden while our team reviews buyer reports.' })
  })

  it.each(['active', 'paused', 'draft', 'sold', 'archived', 'pending_approval'])('shows nothing for a %s listing', (status) => {
    expect(sellerFacingReason({ status, rejection_reason: 'old', moderation_notes: 'old' })).toBeNull()
  })

  it('shows nothing when no text was saved', () => {
    expect(sellerFacingReason({ status: 'rejected', rejection_reason: '  ', moderation_notes: null })).toBeNull()
  })
})
