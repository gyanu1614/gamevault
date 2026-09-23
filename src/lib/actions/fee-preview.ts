'use server'

/**
 * Seller fee preview — the sell wizard's "You receive $X (Y% fee)"
 * (docs/design/fee-engine.md §4.1 D1, §4.2).
 *
 * ONE call per selected (game, category) pair, not per keystroke: the wizard
 * caches the pct and does the subtraction locally. The rate comes from the
 * same RPC checkout stamps on the order, resolved for THIS seller
 * (auth.uid()) — founding and rank included — so the preview can never
 * disagree with the receipt (fee-preview-parity.guard pins that).
 *
 * Own module on purpose: it mixes a session read with the resolver, so it
 * must never be co-located with a public (cookie-free) read
 * (MIXED_ACTION_MODULES, scripts/check-public-route-caching.mjs).
 */

import { createClient } from '@/lib/supabase/server'
import { FeeResolutionError, resolveSellerFee } from '@/lib/fees/resolver'

export type SellerFeePreview =
  | {
      ok: true
      /** Commission percentage this seller pays on this pair right now. */
      pct: number
      foundingApplied: boolean
      rank: string | null
      rankPts: number
    }
  | { ok: false; error: string }

export async function previewSellerFee(input: { gameCategoryId: string | null | undefined }): Promise<SellerFeePreview> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Sign in to see your fee' }
    const r = await resolveSellerFee(supabase, { sellerId: user.id, gameCategoryId: input.gameCategoryId })
    return {
      ok: true,
      pct: r.pct,
      foundingApplied: r.trace.founding_applied,
      rank: r.trace.rank,
      rankPts: r.trace.rank_pts,
    }
  } catch (e) {
    const detail = e instanceof FeeResolutionError ? e.detail : String((e as Error)?.message ?? e)
    console.error('[fee-preview] could not resolve the seller fee:', detail)
    return { ok: false, error: 'Your exact fee is shown at checkout' }
  }
}
