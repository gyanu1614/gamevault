import { describe, it, expect } from 'vitest'
import { decidePublishStatus } from './publish-status'
import { UNVERIFIED_REVIEW_PRICE_USD } from '@/lib/fees'

const auto = { needs_moderation: false, auto_approve_single: true, is_verified: true }

describe('decidePublishStatus', () => {
  it('a draft stays a draft whatever the policy or price', () => {
    expect(decidePublishStatus({ ...auto, is_verified: false }, 'draft', 5000)).toBe('draft')
  })
  it('tier pre-moderation still wins', () => {
    expect(decidePublishStatus({ ...auto, needs_moderation: true }, 'active', 1)).toBe('pending_approval')
    expect(decidePublishStatus({ ...auto, auto_approve_single: false }, 'active', 1)).toBe('pending_approval')
  })
  it('a verified seller goes live at any price', () => {
    expect(decidePublishStatus(auto, 'active', UNVERIFIED_REVIEW_PRICE_USD * 50)).toBe('active')
  })
  it('an unverified seller goes live at or below the review price, is held above it', () => {
    const unverified = { ...auto, is_verified: false }
    expect(decidePublishStatus(unverified, 'active', UNVERIFIED_REVIEW_PRICE_USD)).toBe('active')
    expect(decidePublishStatus(unverified, 'active', 12.5)).toBe('active')
    expect(decidePublishStatus(unverified, 'active', UNVERIFIED_REVIEW_PRICE_USD + 0.01)).toBe('pending_approval')
  })
  it('no price given → the price rule does not apply (callers that only flip status)', () => {
    expect(decidePublishStatus({ ...auto, is_verified: false }, 'active')).toBe('active')
  })
  it('a missing is_verified is treated as unverified (fail closed)', () => {
    expect(decidePublishStatus({ needs_moderation: false, auto_approve_single: true }, 'active', 500)).toBe('pending_approval')
  })
})
