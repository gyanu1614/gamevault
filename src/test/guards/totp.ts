/**
 * Real two-factor sign-in for guard tests: enrol a TOTP factor on a signed-in
 * client and verify it, so that client's session becomes aal2 exactly as a
 * staff member's does on /admin/mfa. Every staff power requires aal2 (migration
 * 20261103125855_admin_mfa_required), so the fixture admin goes through this.
 */
import { createHmac } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(secret: string): Buffer {
  let bits = ''
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) {
    const value = BASE32.indexOf(ch)
    if (value === -1) throw new Error(`not base32: ${ch}`)
    bits += value.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

/** RFC 6238: the 6-digit code for this moment (30 s step, SHA-1). */
export function totpCode(secret: string, now: number = Date.now()): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)))
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const value = hmac.readUInt32BE(offset) & 0x7fffffff
  return String(value % 1_000_000).padStart(6, '0')
}

/** Local Auth rate-limits factor calls per IP; a parallel suite can hit that. */
async function withRetry<T extends { error: { status?: number; message: string } | null }>(
  call: () => Promise<T>,
  attempts = 6,
): Promise<T> {
  let result = await call()
  for (let i = 1; i < attempts && result.error?.status === 429; i++) {
    await new Promise((r) => setTimeout(r, 2_000 * i))
    result = await call()
  }
  return result
}

/**
 * Enrol and verify a TOTP factor. Afterwards `client` holds an aal2 session.
 * Returns the factor's secret, so a test can sign in again at aal1 and step up.
 */
export async function enrollVerifiedTotp(client: SupabaseClient): Promise<{ factorId: string; secret: string }> {
  const { data, error } = await withRetry(() => client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'guard-test' }))
  if (error || !data) throw new Error(`mfa.enroll: ${error?.message}`)
  const verified = await withRetry(() => client.auth.mfa.challengeAndVerify({ factorId: data.id, code: totpCode(data.totp.secret) }))
  if (verified.error) throw new Error(`mfa.verify: ${verified.error.message}`)
  return { factorId: data.id, secret: data.totp.secret }
}
