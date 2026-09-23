import { describe, it, expect } from 'vitest'
import { isCronAuthorized, secretsMatch } from './cron-auth'

const h = (authorization?: string) => ({ get: (n: string) => (n === 'authorization' ? authorization ?? null : null) })

describe('PAY-020 — cron bearer check is constant-time and fails closed', () => {
  it('accepts the exact bearer', () => {
    expect(isCronAuthorized(h('Bearer s3cret'), 's3cret')).toBe(true)
  })
  it('rejects a wrong, empty, prefix-only or missing bearer', () => {
    expect(isCronAuthorized(h('Bearer s3cre'), 's3cret')).toBe(false)
    expect(isCronAuthorized(h('Bearer s3cretX'), 's3cret')).toBe(false)
    expect(isCronAuthorized(h('Bearer '), 's3cret')).toBe(false)
    expect(isCronAuthorized(h('s3cret'), 's3cret')).toBe(false)
    expect(isCronAuthorized(h(undefined), 's3cret')).toBe(false)
  })
  it('an unset CRON_SECRET rejects everyone (no default token)', () => {
    expect(isCronAuthorized(h('Bearer '), '')).toBe(false)
    expect(isCronAuthorized(h('Bearer undefined'), undefined)).toBe(false)
  })
  it('secretsMatch never throws on length mismatch', () => {
    expect(secretsMatch('a', 'abc')).toBe(false)
    expect(secretsMatch('abc', 'abc')).toBe(true)
  })
})
