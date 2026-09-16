/**
 * TIER-002 — approving a seller writes a rank the CHECK constraint accepts.
 *
 * Production bug: the approve path wrote a hard-coded entry-rank literal
 * ('quartz') that migration 20260908100000_metal_rank_tiers had retired, so
 * every approval failed with
 *   new row for relation "profiles" violates check constraint
 *   "profiles_seller_tier_check".
 *
 * The fix reads the entry rank live from seller_tier_config (lowest
 * sort_order) — the same thing get_seller_publish_policy and
 * upgrade_all_seller_tiers do in SQL. These tests pin that behaviour against
 * the real constraint, which is the only thing that actually rejected us.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from './throwaway'
import { getEntryTier } from '@/lib/seller/entry-tier'

let fx: Fixture | null = null

describe.skipIf(!hasEnv)('TIER-002 — seller approval tier write (integration)', () => {
  beforeAll(async () => { fx = await makeFixture() }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('getEntryTier returns the lowest-sort_order rank from the live config', async () => {
    const { data } = await fx!.svc
      .from('seller_tier_config')
      .select('tier, sort_order')
      .order('sort_order', { ascending: true })
      .limit(1)

    const expected = (data as Array<{ tier: string }>)[0].tier
    await expect(getEntryTier(fx!.svc)).resolves.toBe(expected)
  })

  it('approving a seller onto the entry rank succeeds against profiles_seller_tier_check', async () => {
    const entry = await getEntryTier(fx!.svc)

    // The exact profiles write the approve path performs.
    const { error } = await fx!.svc
      .from('profiles')
      .update({ role: 'seller', is_verified: true, seller_tier: entry })
      .eq('id', fx!.seller.id)

    expect(error, `approve write rejected: ${error?.message}`).toBeNull()

    const { data } = await fx!.svc
      .from('profiles')
      .select('seller_tier, role')
      .eq('id', fx!.seller.id)
      .single()

    expect((data as { seller_tier: string }).seller_tier).toBe(entry)
    expect((data as { role: string }).role).toBe('seller')
  })

  it('the retired gemstone entry rank is still rejected by the constraint', async () => {
    // Proves the constraint is real and that the old literal was the bug — if
    // this ever starts passing, the ladder was re-keyed again and getEntryTier
    // is what keeps the approve path correct.
    const { error } = await fx!.svc
      .from('profiles')
      .update({ seller_tier: 'quartz' })
      .eq('id', fx!.seller.id)

    expect(error, 'a retired rank must be refused by profiles_seller_tier_check').not.toBeNull()
    expect(`${error!.message} ${error!.code ?? ''}`).toMatch(/seller_tier|check|23514/i)
  })

  it('every rank in the TS ladder is accepted by the DB constraint', async () => {
    const { TIER_KEYS } = await import('@/lib/seller/tiers')
    for (const tier of TIER_KEYS) {
      const { error } = await fx!.svc
        .from('profiles')
        .update({ seller_tier: tier })
        .eq('id', fx!.seller.id)
      expect(error, `TS ladder rank "${tier}" rejected by the DB: ${error?.message}`).toBeNull()
    }
  })
})
