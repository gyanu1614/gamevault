import { describe, it, expect, beforeAll } from 'vitest'
// A plain placeholder, not a real address: secret scanners flag high-entropy
// literals, and the round-trip proves the same thing on any string.
const SAMPLE = 'example-payout-destination-value'

import { encryptPayoutSecret, decryptPayoutSecret, hashPayoutSecret, isEncryptedPayoutSecret, revealPayoutSecret, maskPayoutSecret } from './payout-encryption'

describe('payout-encryption (AES-256-GCM, PAYOUT_ENCRYPTION_KEY)', () => {
  beforeAll(() => {
    if (!process.env.PAYOUT_ENCRYPTION_KEY) process.env.PAYOUT_ENCRYPTION_KEY = 'x'.repeat(40)
  })
  it('round-trips, never repeats ciphertext, and prefixes v1:', () => {
    const a = encryptPayoutSecret(SAMPLE)
    const b = encryptPayoutSecret(SAMPLE)
    expect(a).not.toBe(b)
    expect(isEncryptedPayoutSecret(a)).toBe(true)
    expect(decryptPayoutSecret(a)).toBe(SAMPLE)
    expect(revealPayoutSecret(b)).toBe(SAMPLE)
    expect(revealPayoutSecret('legacy-plaintext')).toBe('legacy-plaintext')
    expect(revealPayoutSecret(null)).toBeNull()
  })
  it('hash is deterministic, keyed, and hex-64', () => {
    expect(hashPayoutSecret('a@b.co')).toBe(hashPayoutSecret('a@b.co'))
    expect(hashPayoutSecret('a@b.co')).not.toBe(hashPayoutSecret('a@b.com'))
    expect(hashPayoutSecret('a@b.co')).toMatch(/^[0-9a-f]{64}$/)
  })
  it('a tampered ciphertext fails authentication', () => {
    const c = encryptPayoutSecret('secret')
    const bad = c.slice(0, -4) + (c.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(() => decryptPayoutSecret(bad)).toThrow()
  })
  it('refuses to run without a key', () => {
    const k = process.env.PAYOUT_ENCRYPTION_KEY
    delete process.env.PAYOUT_ENCRYPTION_KEY
    try { expect(() => encryptPayoutSecret('x')).toThrow(/PAYOUT_ENCRYPTION_KEY/) } finally { process.env.PAYOUT_ENCRYPTION_KEY = k }
  })
  it('masks to the last six characters', () => {
    expect(maskPayoutSecret(SAMPLE)).toBe('…-value')
  })
})
