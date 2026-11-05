import { describe, expect, it } from 'vitest'
import { identityStateFrom } from './state'

describe('identityStateFrom', () => {
  it('a verified seller is verified whatever the last check said', () => {
    expect(identityStateFrom(true, null)).toBe('verified')
    expect(identityStateFrom(true, 'declined')).toBe('verified')
  })

  it('no check yet is not started', () => {
    expect(identityStateFrom(false, null)).toBe('not_started')
  })

  it('a check that was opened and never finished can simply be started again', () => {
    expect(identityStateFrom(false, 'started')).toBe('not_started')
  })

  it('a check with the reviewers is in review', () => {
    expect(identityStateFrom(false, 'in_review')).toBe('in_review')
  })

  it('a declined check needs attention', () => {
    expect(identityStateFrom(false, 'declined')).toBe('needs_attention')
  })

  it('treats a missing flag as unverified, like the withdrawal gate', () => {
    expect(identityStateFrom(null, null)).toBe('not_started')
  })
})
