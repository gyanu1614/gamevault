/**
 * resolveSellerFee — the ONE TypeScript seam in front of the
 * `resolve_seller_fee` RPC (docs/design/fee-engine.md §3.1, §8.4).
 *
 * The rate a seller is charged is decided by the database (fee_rules, rank
 * steps, the founding programme) and returned WITH the trace that explains
 * it. This module does three things and nothing else:
 *
 *   1. calls the RPC on the caller's client — checkout passes the BUYER's
 *      session client; the resolver is SECURITY DEFINER and granted to
 *      authenticated/anon, so no service-role client is needed on the hot path;
 *   2. normalises the row (PostgREST may serialise numeric as a string) into a
 *      number plus the exact jsonb that `orders.seller_fee_trace` stores;
 *   3. FAILS CLOSED. An RPC error, an empty result or a non-numeric rate is a
 *      FeeResolutionError. There is no fallback to a TypeScript constant —
 *      a silent fallback is how two fee ladders came to disagree, and a wrong
 *      rate here is a real mispayment (§9 A4).
 *
 * `p_at` is deliberately NOT passed: the database stamps `now()` itself, so
 * `resolved_at` in the trace and the rule window are judged by one clock.
 */

/** What the buyer sees when the rate cannot be resolved. Never the DB text. */
export const FEE_RESOLUTION_USER_MESSAGE = 'Could not price this order'

export class FeeResolutionError extends Error {
  readonly detail: string
  constructor(detail: string) {
    super(FEE_RESOLUTION_USER_MESSAGE)
    this.name = 'FeeResolutionError'
    this.detail = detail
  }
}

/** The jsonb written to orders.seller_fee_trace — the resolver row minus pct. */
export interface SellerFeeTrace {
  rule_id: string | null
  rule_kind: string | null
  rule_scope: string | null
  base_pct: number
  rank: string | null
  rank_pts: number
  founding_applied: boolean
  floor_applied: boolean
  fallback_count: number
  resolver_version: number
  resolved_at: string
}

export interface SellerFeeResolution {
  /** Commission percentage charged on THIS order (0–50, 2 dp). */
  pct: number
  trace: SellerFeeTrace
}

/** The one method this seam needs; a SupabaseClient satisfies it (its rpc
 *  is generic over the function name, hence the loose parameter types). */
export interface FeeRpcClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: any, args?: any) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>
}

export async function resolveSellerFee(
  client: FeeRpcClient,
  input: { sellerId: string; gameCategoryId: string | null | undefined },
): Promise<SellerFeeResolution> {
  if (!input.gameCategoryId) {
    throw new FeeResolutionError('listing has no game_category_id')
  }
  const { data, error } = await client.rpc('resolve_seller_fee', {
    p_seller_id: input.sellerId,
    p_game_category_id: input.gameCategoryId,
  })
  if (error) {
    throw new FeeResolutionError(`resolve_seller_fee ${error.code ?? ''}: ${error.message}`)
  }
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined
  if (!row) {
    throw new FeeResolutionError('resolve_seller_fee returned no row')
  }
  const pct = Number(row.pct)
  const basePct = Number(row.base_pct)
  if (!Number.isFinite(pct) || !Number.isFinite(basePct)) {
    throw new FeeResolutionError(`resolve_seller_fee returned a non-numeric rate: ${String(row.pct)}`)
  }
  return {
    pct,
    trace: {
      rule_id: (row.rule_id as string | null) ?? null,
      rule_kind: (row.rule_kind as string | null) ?? null,
      rule_scope: (row.rule_scope as string | null) ?? null,
      base_pct: basePct,
      rank: (row.rank as string | null) ?? null,
      rank_pts: Number(row.rank_pts ?? 0),
      founding_applied: row.founding_applied === true,
      floor_applied: row.floor_applied === true,
      fallback_count: Number(row.fallback_count ?? 0),
      resolver_version: Number(row.resolver_version ?? 1),
      resolved_at: String(row.resolved_at),
    },
  }
}
