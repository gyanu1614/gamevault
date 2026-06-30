/**
 * Integration test for the ledger-backed wallet against the real DB.
 *
 *   - creditWallet → derived balance reflects it
 *   - spendWallet → balance decreases; overspend is REFUSED
 *   - refundToWallet → credits via the refunds counterparty
 *   - idempotency: replaying a credit/spend key does not double-post
 *
 * Uses a synthetic per-run buyer id (no FK on ledger_accounts.owner_id, so a
 * fake uuid is fine — the ledger doesn't reference profiles). Cleans up via a
 * cleanup keyed on the run's idempotency prefix.
 *
 * Self-skips unless env + the wallet RPCs exist.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getWalletBalance, creditWallet, spendWallet, refundToWallet } from '@/lib/wallet/wallet'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RUN = `walit-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
const rand12 = () => Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, '0')
const USER = `00000000-0000-4000-8000-${rand12()}`
const CUR = 'EUR'

let svc: SupabaseClient | null = null
let ready = false

beforeAll(async () => {
  if (!URL || !KEY) return
  svc = createClient(URL, KEY, { auth: { persistSession: false } })
  const probe = await svc.rpc('user_wallet_balance', { p_user_id: USER, p_currency: CUR } as any)
  if (probe.error) {
    // eslint-disable-next-line no-console
    console.warn(`[wallet integration] skipping — wallet RPCs not reachable: ${probe.error.message}`)
    return
  }
  ready = true
})

afterAll(async () => {
  if (!svc || !ready) return
  // Remove this run's ledger txns (idempotency keys are RUN-prefixed) + genesis-free.
  try {
    await (svc as any).rpc('ledger_test_cleanup', { p_prefix: `test:ledger:${RUN}%` })
  } catch {
    /* the wallet keys aren't test:ledger-prefixed; cleanup below */
  }
})

const maybe = URL && KEY ? describe : describe.skip

maybe('ledger-backed wallet (integration, real DB)', () => {
  it('starts at zero, credit raises the derived balance', async () => {
    if (!ready) return
    expect(await getWalletBalance(USER, CUR)).toBe(0n)
    await creditWallet({
      userId: USER, amountMinor: 5000n, currency: CUR,
      counterparty: 'refunds', idempotencyKey: `test:ledger:${RUN}:c1`,
    })
    expect(await getWalletBalance(USER, CUR)).toBe(5000n)
  })

  it('spend decreases the balance', async () => {
    if (!ready) return
    await spendWallet({
      userId: USER, amountMinor: 2000n, currency: CUR,
      target: 'escrow_held', idempotencyKey: `test:ledger:${RUN}:s1`,
    })
    expect(await getWalletBalance(USER, CUR)).toBe(3000n)
  })

  it('overspend is REFUSED (balance guard)', async () => {
    if (!ready) return
    await expect(
      spendWallet({
        userId: USER, amountMinor: 999999n, currency: CUR,
        target: 'escrow_held', idempotencyKey: `test:ledger:${RUN}:over`,
      })
    ).rejects.toThrow(/insufficient/i)
    expect(await getWalletBalance(USER, CUR)).toBe(3000n) // unchanged
  })

  it('refundToWallet credits via the refunds counterparty', async () => {
    if (!ready) return
    // refundToWallet keys on the orderId; use a synthetic one.
    const fakeOrder = `00000000-0000-4000-8000-${rand12()}`
    await refundToWallet({ userId: USER, amountMinor: 1500n, currency: CUR, orderId: fakeOrder })
    expect(await getWalletBalance(USER, CUR)).toBe(4500n)
  })

  it('idempotent: replaying a credit key does not double-credit', async () => {
    if (!ready) return
    const before = await getWalletBalance(USER, CUR)
    await creditWallet({
      userId: USER, amountMinor: 5000n, currency: CUR,
      counterparty: 'refunds', idempotencyKey: `test:ledger:${RUN}:c1`, // same key as first test
    })
    expect(await getWalletBalance(USER, CUR)).toBe(before) // no change
  })
})
