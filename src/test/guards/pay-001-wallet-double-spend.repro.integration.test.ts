/**
 * PAY-001 (audit pass 6, 2026-09-20) — FAILING REPRO, do not "fix" the test.
 *
 * wallet_spend's balance guard is a read over the derived aggregate
 * user_wallet_balance() with NO row lock and nothing to conflict on
 * (baseline_live_schema.sql, wallet_spend: "Balance guard (derived)").
 * Two concurrent spends with DIFFERENT idempotency keys — exactly what two
 * checkout tabs on two DIFFERENT listings produce
 * (checkout.ts spendWallet key `checkout_wallet:<orderId>`) — both read the
 * same pre-spend balance, both pass the guard, both post. The wallet goes
 * negative.
 *
 * The one_pending_order_per_buyer_listing index does not help: it is scoped
 * per (buyer, listing); these are different listings.
 *
 * The race is made DETERMINISTIC with a held psql transaction: session A
 * calls wallet_spend and stays uncommitted while session B (autocommit)
 * runs its own wallet_spend. Under READ COMMITTED, B's aggregate cannot see
 * A's uncommitted debit, and nothing A holds blocks B's inserts (distinct
 * idempotency keys), so both pass the guard. A then commits: balance -1000.
 *
 * Expected once fixed (e.g. per-wallet advisory/row lock taken inside
 * wallet_spend before the guard): B blocks until A commits, re-reads a zero
 * balance, and raises check_violation — one success, final balance 0. That
 * is what this test asserts, so it FAILS on current main and passes after
 * the fix.
 *
 * Local stack only (direct psql session), via .env.test — never .env.local.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn, execFileSync } from 'node:child_process'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

const CUR = 'USD'
const tag = () => Math.random().toString(36).slice(2, 8)
const RUN = `test:ledger:pay-001:${tag()}`

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const targetHost = (() => {
  try {
    return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname
  } catch {
    return ''
  }
})()
const TARGET_IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)
const itLocal = it.skipIf(!TARGET_IS_LOCAL)

let fx: Fixture | null = null

async function balance(userId: string): Promise<bigint> {
  const { data, error } = await fx!.svc.rpc('user_wallet_balance', {
    p_user_id: userId,
    p_currency: CUR,
  } as any)
  if (error) throw new Error(`user_wallet_balance: ${error.message}`)
  return BigInt(data ?? 0)
}

const spendSql = (userId: string, key: string) =>
  `SELECT wallet_spend('${userId}'::uuid, 1000, '${CUR}', 'escrow_held', '${key}', 'TEST_SPEND', NULL);`

/** Open a psql session, run `firstSql` inside an OPEN transaction, resolve
 *  once its output marker appears, and hand back a commit() that finishes
 *  the transaction and closes the session. */
function heldTransaction(firstSql: string): Promise<{ commit: () => Promise<string> }> {
  return new Promise((resolve, reject) => {
    const p = spawn('psql', [DB_URL, '-q', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    let settled = false
    p.stdout.on('data', (d) => {
      out += String(d)
      if (!settled && out.includes('A_STATEMENT_DONE')) {
        settled = true
        resolve({
          commit: () =>
            new Promise((res) => {
              p.on('close', () => res(err))
              p.stdin.write('COMMIT;\n')
              p.stdin.end()
            }),
        })
      }
    })
    p.stderr.on('data', (d) => {
      err += String(d)
    })
    p.on('error', reject)
    p.on('close', () => {
      if (!settled) reject(new Error(`psql session A exited early: ${err || out}`))
    })
    p.stdin.write(`BEGIN;\n${firstSql}\n\\echo A_STATEMENT_DONE\n`)
  })
}

describe.skipIf(!hasEnv)('PAY-001 — concurrent wallet_spend must not overdraw (repro)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    const failures: string[] = []
    // Remove every ledger row this test caused (credit + both spends).
    const { error } = await fx.svc.rpc('ledger_test_cleanup', { p_prefix: `${RUN}%` } as any)
    if (error) failures.push(`ledger_test_cleanup: ${error.message}`)
    try {
      await fx.cleanup()
    } catch (e: any) {
      failures.push(String(e?.message ?? e))
    }
    if (failures.length) throw new Error(`pay-001 cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 60_000)

  itLocal('two overlapping full-balance spends with distinct keys leave the wallet >= 0', async () => {
    const buyer = fx!.buyer.id
    const FUND = 1000n // $10.00

    const { error: creditErr } = await fx!.svc.rpc('wallet_credit', {
      p_user_id: buyer,
      p_amount_minor: FUND.toString(),
      p_currency: CUR,
      p_counterparty: 'refunds',
      p_idempotency_key: `${RUN}:fund`,
      p_event_ref: 'TEST_FUND',
      p_order_id: null,
    } as any)
    if (creditErr) throw new Error(`wallet_credit: ${creditErr.message}`)
    expect(await balance(buyer)).toBe(FUND)

    // Session A: spend the full balance, transaction HELD OPEN.
    const held = await heldTransaction(spendSql(buyer, `${RUN}:order-a`))

    // Session B: autocommit spend of the full balance while A is uncommitted.
    let bError = ''
    try {
      execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', spendSql(buyer, `${RUN}:order-b`)], {
        stdio: 'pipe',
        timeout: 20_000,
      })
    } catch (e: any) {
      bError = e?.stderr?.toString() ?? String(e)
    }

    const aError = await held.commit()

    const final = await balance(buyer)
    const succeeded = [aError, bError].filter((e) => !e.includes('ERROR')).length

    // The invariant under test: a wallet can never go negative, therefore at
    // most one full-balance spend may commit. On current main BOTH commit
    // and `final` is -1000n — this assertion is the finding.
    expect(succeeded).toBe(1)
    expect(final).toBe(0n)
  }, 60_000)
})
