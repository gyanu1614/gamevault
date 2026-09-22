/**
 * resolveSellerFee — the TS seam in front of the resolve_seller_fee RPC
 * (docs/design/fee-engine.md §3.1, §9 A4).
 *
 * The contract checkout relies on: a resolver error or an empty result is a
 * FeeResolutionError (checkout fails closed), and a row comes back as numbers
 * plus the exact jsonb the order snapshot stores.
 */
import { describe, it, expect } from 'vitest'

import { FeeResolutionError, FEE_RESOLUTION_USER_MESSAGE, resolveSellerFee } from './resolver'

type RpcResult = { data: unknown; error: { message: string; code?: string } | null }

function fakeClient(result: RpcResult, calls: Array<{ fn: string; args: Record<string, unknown> }> = []) {
  return {
    client: { rpc: async (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return result } } as any,
    calls,
  }
}

const ROW = {
  pct: 7, base_pct: 7, rule_id: '11111111-1111-1111-1111-111111111111', rule_kind: 'base', rule_scope: 'category',
  rank: 'silver', rank_pts: 0, founding_applied: false, floor_applied: false, fallback_count: 0,
  resolver_version: 1, resolved_at: '2026-09-21T00:00:00+00:00',
}

describe('resolveSellerFee', () => {
  it('calls resolve_seller_fee with the seller and the pair, letting the DB stamp p_at', async () => {
    const { client, calls } = fakeClient({ data: [ROW], error: null })
    await resolveSellerFee(client, { sellerId: 's1', gameCategoryId: 'gc1' })
    expect(calls).toEqual([{ fn: 'resolve_seller_fee', args: { p_seller_id: 's1', p_game_category_id: 'gc1' } }])
  })

  it('returns pct as a number and the trace in the orders.seller_fee_trace shape (no pct inside the trace)', async () => {
    // PostgREST may serialise numeric as a string; the seam normalises it.
    const { client } = fakeClient({ data: [{ ...ROW, pct: '3.50', base_pct: '7.00', rank_pts: '0.00' }], error: null })
    const r = await resolveSellerFee(client, { sellerId: 's1', gameCategoryId: 'gc1' })
    expect(r.pct).toBe(3.5)
    expect(r.trace).toEqual({
      rule_id: ROW.rule_id, rule_kind: 'base', rule_scope: 'category', base_pct: 7, rank: 'silver', rank_pts: 0,
      founding_applied: false, floor_applied: false, fallback_count: 0, resolver_version: 1, resolved_at: ROW.resolved_at,
    })
    expect(r.trace).not.toHaveProperty('pct')
  })

  it('an RPC error is a FeeResolutionError carrying the buyer-safe message, never the DB text', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'relation fee_rules does not exist', code: '42P01' } })
    const p = resolveSellerFee(client, { sellerId: 's1', gameCategoryId: 'gc1' })
    await expect(p).rejects.toBeInstanceOf(FeeResolutionError)
    await expect(p).rejects.toThrow(FEE_RESOLUTION_USER_MESSAGE)
    await expect(p).rejects.not.toThrow(/fee_rules/)
  })

  it('no row is a FeeResolutionError (never a TS-constant fallback)', async () => {
    const { client } = fakeClient({ data: [], error: null })
    await expect(resolveSellerFee(client, { sellerId: 's1', gameCategoryId: 'gc1' })).rejects.toBeInstanceOf(FeeResolutionError)
  })

  it('a listing with no pair is refused before the RPC is called', async () => {
    const { client, calls } = fakeClient({ data: [ROW], error: null })
    await expect(resolveSellerFee(client, { sellerId: 's1', gameCategoryId: null })).rejects.toBeInstanceOf(FeeResolutionError)
    expect(calls).toEqual([])
  })

  it('a non-finite pct is refused (a NaN rate must not become a payout)', async () => {
    const { client } = fakeClient({ data: [{ ...ROW, pct: 'seven' }], error: null })
    await expect(resolveSellerFee(client, { sellerId: 's1', gameCategoryId: 'gc1' })).rejects.toBeInstanceOf(FeeResolutionError)
  })
})
