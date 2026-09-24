/**
 * Payout-secret encryption (fee engine PR 7 follow-up).
 *
 * Same posture as delivery codes (src/lib/crypto/delivery-encryption.ts):
 * AES-256-GCM, a fresh random salt + IV per value, PBKDF2-derived key,
 * base64(salt | iv | ciphertext | tag). Differences, on purpose:
 *   · the key is PAYOUT_ENCRYPTION_KEY and it is REQUIRED — no dev fallback;
 *     a missing key throws before anything is written or read;
 *   · values carry a `v1:` prefix so a backfill can tell ciphertext from the
 *     plaintext rows written before this module existed;
 *   · hashPayoutSecret() is a keyed HMAC-SHA256 of the normalised value for
 *     equality (change detection, one Payoneer account per seller) — the
 *     database never sees the plaintext and cannot reverse the hash.
 * Decrypt only on the server, only into a server action's response.
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32
const ITERATIONS = 100_000
const PREFIX = 'v1:'

function masterKey(): string {
  const key = process.env.PAYOUT_ENCRYPTION_KEY
  if (!key) throw new Error('PAYOUT_ENCRYPTION_KEY is not set — payout details cannot be read or written')
  if (key.length < 32) throw new Error('PAYOUT_ENCRYPTION_KEY must be at least 32 characters')
  return key
}

function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey(), salt, ITERATIONS, KEY_LENGTH, 'sha256')
}

export function isEncryptedPayoutSecret(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptPayoutSecret(plaintext: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(salt), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([salt, iv, encrypted, tag]).toString('base64')
}

export function decryptPayoutSecret(value: string): string {
  if (!isEncryptedPayoutSecret(value)) throw new Error('payout secret is not encrypted (missing v1: prefix)')
  const combined = Buffer.from(value.slice(PREFIX.length), 'base64')
  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH, combined.length - TAG_LENGTH)
  const tag = combined.subarray(combined.length - TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(salt), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/** Best-effort decrypt for display: a legacy plaintext value is returned as is. */
export function revealPayoutSecret(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  return isEncryptedPayoutSecret(value) ? decryptPayoutSecret(value) : value
}

/** Keyed hash of the normalised value (trim; emails lower-cased by the caller). */
export function hashPayoutSecret(normalised: string): string {
  return crypto.createHmac('sha256', masterKey()).update(normalised, 'utf8').digest('hex')
}

/** Shown to admins/sellers where the full value is not needed: last 6 chars. */
export function maskPayoutSecret(plaintext: string | null | undefined): string {
  if (!plaintext) return ''
  return plaintext.length <= 8 ? '••••' : `…${plaintext.slice(-6)}`
}
