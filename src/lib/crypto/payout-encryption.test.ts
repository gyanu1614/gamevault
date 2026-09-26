import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'

import { encryptPayoutSecret, decryptPayoutSecret, hashPayoutSecret, isEncryptedPayoutSecret, revealPayoutSecret, maskPayoutSecret } from './payout-encryption'
import { validatePayoutAddress } from './address-validation'

// Nothing secret-shaped lives in this file: secret scanners flag high-entropy
// literals (GitGuardian flagged a sample TRON address here on PR #91), so the
// key and the sample destination are both generated per run.

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function base58(bytes: Buffer): string {
  let n = BigInt(`0x${bytes.toString('hex')}`)
  let out = ''
  while (n > 0n) { out = BASE58[Number(n % 58n)] + out; n /= 58n }
  for (const b of bytes) { if (b !== 0) break; out = `1${out}` }
  return out
}
/** A valid-format TRON address for a random (unowned) payload: 0x41 + 20 bytes + sha256d checksum, Base58. */
function randomTronAddress(): string {
  const payload = Buffer.concat([Buffer.from([0x41]), randomBytes(20)])
  const checksum = createHash('sha256').update(createHash('sha256').update(payload).digest()).digest().subarray(0, 4)
  return base58(Buffer.concat([payload, checksum]))
}

const SAMPLE = randomTronAddress()

describe('payout-encryption (AES-256-GCM, PAYOUT_ENCRYPTION_KEY)', () => {
  const envKey = process.env.PAYOUT_ENCRYPTION_KEY
  beforeAll(() => {
    process.env.PAYOUT_ENCRYPTION_KEY = randomBytes(32).toString('hex')
  })
  afterAll(() => {
    if (envKey === undefined) delete process.env.PAYOUT_ENCRYPTION_KEY
    else process.env.PAYOUT_ENCRYPTION_KEY = envKey
  })
  it('the generated sample is a valid-format TRON address', () => {
    expect(validatePayoutAddress('usdt', 'tron', SAMPLE)).toEqual({ valid: true })
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
    expect(maskPayoutSecret(SAMPLE)).toBe(`…${SAMPLE.slice(-6)}`)
  })
})
