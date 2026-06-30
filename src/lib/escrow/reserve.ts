/**
 * Reserve engine seam (Phase 5).
 *
 * Computes the reserve rate from the TS matrix (windows.ts — single source of
 * truth) and drives the reserve-aware release RPC. For CRYPTO the rate is 0
 * (no chargeback risk) so the engine is inert; it activates for cards.
 *
 * The reserve % comes from the warranty tier (accounts) or a category default.
 * Until the per-seller risk-tier model lands (with cards), we use the warranty
 * tier's reservePct for accounts and 0 for crypto categories.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import {
  WARRANTY_TIERS,
  type WarrantyTier,
  type OrderCategory,
} from '@/lib/escrow/windows'
import type { OrderEvent } from '@/lib/escrow/state-machine'

/**
 * reserveForOrder — the reserve {pct, holdSeconds} for an order.
 *
 * @param chargebackRisk  provider.capabilities.chargebackRisk. FALSE (crypto)
 *                        → always 0% (engine dormant). Only card providers
 *                        produce a non-zero reserve.
 * @param category        order category
 * @param warrantyTier    for accounts; ignored otherwise
 */
export function reserveForOrder(
  chargebackRisk: boolean,
  category: OrderCategory,
  warrantyTier: WarrantyTier = 'standard'
): { pct: number; holdSeconds: number } {
  // Crypto / no chargeback risk → no reserve. This is the real advantage of
  // crypto-only flow; encode it explicitly.
  if (!chargebackRisk) return { pct: 0, holdSeconds: 0 }

  // Accounts: reserve from the chosen warranty tier.
  if (category === 'accounts') {
    const t = WARRANTY_TIERS[warrantyTier]
    return { pct: t.reservePct, holdSeconds: Math.floor(t.reserveHoldMs / 1000) }
  }

  // Other categories (cards): conservative default until the per-seller risk
  // tier model lands. Mirrors the spec's "new seller" tier as a safe baseline.
  // currency/boosting 15%/180d, codes 5%/90d.
  const DEFAULTS: Record<Exclude<OrderCategory, 'accounts'>, { pct: number; days: number }> = {
    currency: { pct: 0.15, days: 180 },
    coaching: { pct: 0.15, days: 180 },
    codes: { pct: 0.05, days: 90 },
  }
  const d = DEFAULTS[category]
  return { pct: d.pct, holdSeconds: d.days * 24 * 60 * 60 }
}

export interface ReleaseResult {
  orderId: string
  status: string
  reserveMinor: bigint
  availableMinor: bigint
  changed: boolean
}

/**
 * releaseWithReserve — release an order to the seller, splitting the reserve
 * portion into seller_reserve and recording a reserve hold. Atomic + idempotent
 * (the RPC). Pass the rate from reserveForOrder().
 */
export async function releaseWithReserve(
  orderId: string,
  event: Extract<OrderEvent, 'BUYER_CONFIRMED' | 'AUTO_RELEASED' | 'DISPUTE_RESOLVED_SELLER'>,
  reservePct: number,
  holdSeconds: number,
  dedupeKey?: string
): Promise<ReleaseResult> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('release_with_reserve', {
    p_order_id: orderId,
    p_event: event,
    p_reserve_pct: reservePct,
    p_hold_seconds: holdSeconds,
    p_dedupe_key: dedupeKey ?? null,
  })
  if (error) throw new Error(`release_with_reserve(${event}) failed: ${error.message}`)
  const r = data as any
  return {
    orderId: r.order_id,
    status: r.status,
    reserveMinor: BigInt(r.reserve_minor ?? 0),
    availableMinor: BigInt(r.available_minor ?? 0),
    changed: r.changed === true,
  }
}

/** Run the matured-reserve release job. Returns count released. */
export async function releaseDueReserves(limit = 500): Promise<number> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('release_due_reserves', { p_limit: limit })
  if (error) throw new Error(`release_due_reserves failed: ${error.message}`)
  return Number(data ?? 0)
}
