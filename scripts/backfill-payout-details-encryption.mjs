#!/usr/bin/env node
/**
 * One-off backfill (fee engine PR 7 follow-up): encrypt any seller_payout_details
 * row still carrying a plaintext address / Payoneer email (*_plain columns,
 * written before 20260923184455) into *_enc + *_hash, then null the plaintext.
 *
 *   PAYOUT_ENCRYPTION_KEY=… NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     node scripts/backfill-payout-details-encryption.mjs [--dry-run]
 *
 * Idempotent: rows with no *_plain value are skipped. Never logs a secret.
 */
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const master = process.env.PAYOUT_ENCRYPTION_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
if (!master || master.length < 32) throw new Error('PAYOUT_ENCRYPTION_KEY (>= 32 chars) is required')
const dry = process.argv.includes('--dry-run')

// Same construction as src/lib/crypto/payout-encryption.ts (kept in step by hand).
const enc = (plaintext) => {
  const salt = crypto.randomBytes(64), iv = crypto.randomBytes(16)
  const k = crypto.pbkdf2Sync(master, salt, 100_000, 32, 'sha256')
  const c = crypto.createCipheriv('aes-256-gcm', k, iv)
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()])
  return 'v1:' + Buffer.concat([salt, iv, ct, c.getAuthTag()]).toString('base64')
}
const hash = (s) => crypto.createHmac('sha256', master).update(s, 'utf8').digest('hex')

const svc = createClient(url, key, { auth: { persistSession: false } })
const { data: rows, error } = await svc.from('seller_payout_details').select('seller_id, crypto_address_plain, payoneer_email_plain')
  .or('crypto_address_plain.not.is.null,payoneer_email_plain.not.is.null')
if (error) throw error
console.log(`${rows.length} row(s) with plaintext payout details${dry ? ' (dry run)' : ''}`)
let done = 0
for (const r of rows) {
  const patch = {}
  if (r.crypto_address_plain) {
    const a = String(r.crypto_address_plain).trim()
    Object.assign(patch, { crypto_address_enc: enc(a), crypto_address_hash: hash(a), crypto_address_plain: null })
  }
  if (r.payoneer_email_plain) {
    const e = String(r.payoneer_email_plain).trim().toLowerCase()
    Object.assign(patch, { payoneer_email_enc: enc(e), payoneer_email_hash: hash(e), payoneer_email_plain: null })
  }
  if (dry) { console.log(`would encrypt ${r.seller_id}: ${Object.keys(patch).filter((k) => k.endsWith('_enc')).join(', ')}`); continue }
  const { error: ue } = await svc.from('seller_payout_details').update(patch).eq('seller_id', r.seller_id)
  if (ue) { console.error(`FAILED ${r.seller_id}: ${ue.message}`); continue }
  done += 1
}
console.log(dry ? 'dry run complete' : `encrypted ${done}/${rows.length}`)
