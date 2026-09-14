/**
 * DB-017 backfill — record the referrer's purchase commission for every
 * COMPLETED order whose buyer was referred, where no commission row exists.
 * recordReferralCommission had no caller until fix/money-atomicity, so every
 * such order to date is missing its row and /account/referral showed zero.
 *
 * Amount = orders.platform_fee × 0.10 (REFERRAL_COMMISSION_RATE, same as
 * src/lib/referral/commission.ts), status 'pending' — the payout flow is
 * unchanged; this only records what was earned.
 *
 *   node scripts/backfill-referral-commissions.mjs --dry-run   # counts + totals only, writes nothing
 *   node scripts/backfill-referral-commissions.mjs             # inserts, one row per order
 *
 * Reads .env.local (production service key). Re-runnable: the partial unique
 * index referral_earnings_one_commission_per_order (migration 20260914100000)
 * makes a duplicate insert a no-op (23505 is counted as "already recorded").
 * Owner runs this; never from a test.
 */

import { createClient } from '@supabase/supabase-js'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const REFERRAL_COMMISSION_RATE = 0.10
const dryRun = process.argv.includes('--dry-run')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const svc = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function selectAll(build, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

const orders = await selectAll(() =>
  svc.from('orders').select('id, buyer_id, platform_fee, completed_at')
    .eq('status', 'completed').gt('platform_fee', 0).order('completed_at', { ascending: true }))

const buyerIds = [...new Set(orders.map((o) => o.buyer_id).filter(Boolean))]
const referred = new Map()
for (let i = 0; i < buyerIds.length; i += 200) {
  const { data, error } = await svc.from('profiles').select('id, referred_by').in('id', buyerIds.slice(i, i + 200)).not('referred_by', 'is', null)
  if (error) throw new Error(error.message)
  for (const p of data ?? []) referred.set(p.id, p.referred_by)
}

const candidates = orders.filter((o) => referred.has(o.buyer_id) && referred.get(o.buyer_id) !== o.buyer_id)
const existing = new Set()
for (let i = 0; i < candidates.length; i += 200) {
  const { data, error } = await svc.from('referral_earnings').select('order_id')
    .eq('type', 'purchase_commission').in('order_id', candidates.slice(i, i + 200).map((o) => o.id))
  if (error) throw new Error(error.message)
  for (const r of data ?? []) existing.add(r.order_id)
}

const todo = candidates
  .map((o) => ({ ...o, amount: Number((Number(o.platform_fee) * REFERRAL_COMMISSION_RATE).toFixed(2)) }))
  .filter((o) => !existing.has(o.id) && o.amount > 0)

const total = todo.reduce((s, o) => s + o.amount, 0)
const byReferrer = new Map()
for (const o of todo) {
  const r = referred.get(o.buyer_id)
  byReferrer.set(r, (byReferrer.get(r) ?? 0) + o.amount)
}

console.log(`completed orders with platform_fee > 0: ${orders.length}`)
console.log(`  …with a referred buyer:               ${candidates.length}`)
console.log(`  …already recorded:                    ${existing.size}`)
console.log(`  …to record now:                       ${todo.length}   total $${total.toFixed(2)} across ${byReferrer.size} referrer(s)`)
for (const [r, amt] of byReferrer) console.log(`     referrer ${r}: $${amt.toFixed(2)}`)

if (dryRun) {
  console.log('\n--dry-run: nothing written.')
  process.exit(0)
}

let inserted = 0, dup = 0, failed = 0
for (const o of todo) {
  const { error } = await svc.from('referral_earnings').insert({
    referrer_id: referred.get(o.buyer_id), referred_user_id: o.buyer_id, order_id: o.id,
    type: 'purchase_commission', amount: o.amount, status: 'pending',
  })
  if (!error) inserted++
  else if (error.code === '23505') dup++
  else { failed++; console.error(`order ${o.id}: ${error.message}`) }
}
console.log(`\ninserted ${inserted}, already recorded ${dup}, failed ${failed}`)
process.exit(failed ? 1 : 0)
