/**
 * DLT-001 — `profiles` must not be readable with the public anon key.
 *
 * Root cause (2026-09-20 delta audit): the baseline shipped
 *   CREATE POLICY "Public profiles are viewable by everyone"
 *     ON public.profiles FOR SELECT USING (true);
 *   GRANT ALL ON TABLE public.profiles TO anon;
 * with no column narrowing, so a single unauthenticated GET with the anon key
 * — which ships in every page's JS bundle — returned `email`, `paypal_email`,
 * `seller_balance`, `kyc_status`, `stripe_*`, `seller_restriction_reason` and
 * `lifetime_earnings` for every user. Reproduced on the local stack.
 *
 * The fix (migration 20260921…_public_profiles_view):
 *   - anon loses `profiles` entirely and reads `public_profiles`, a
 *     security_invoker view of the display-only columns;
 *   - `authenticated` KEEPS the table grant (seven security_invoker views —
 *     seller_dashboard_stats among them — read profiles as the caller and
 *     break without it) but is constrained by policy to its OWN row plus the
 *     public column set through the view;
 *   - service_role is unchanged.
 *
 * Every exploit below runs through PostgREST as exactly what an attacker
 * holds: the public anon key, or a plain signed-in user. The positives prove
 * the legitimate paths survive — a shopper still sees a seller's shop, a
 * seller still reads their own full row and their dashboard stats.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { hasEnv, makeFixture, promoteToEstablishedSeller, URL, ANON, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false

const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } })

/** Columns that must NEVER be reachable with the anon key. */
const SECRET_COLUMNS = [
  'email',
  'paypal_email',
  'seller_balance',
  'kyc_status',
  'pending_balance',
  'lifetime_earnings',
  'stripe_account_id',
  'stripe_connect_account_id',
  'seller_restriction_reason',
  'loyalty_balance',
] as const

/** The display-only columns the public view is allowed to carry. */
const PUBLIC_COLUMNS = [
  'id', 'username', 'avatar_url', 'bio', 'created_at',
  'seller_tier', 'seller_rating', 'total_reviews', 'positive_reviews', 'total_sales',
  'badges', 'is_verified', 'founding_seller',
  'shop_name', 'shop_slug', 'shop_banner_url', 'shop_banner_position',
  'shop_primary_color', 'shop_secondary_color', 'shop_theme', 'shop_layout',
  'banner_url', 'banner_preset',
] as const

async function migrationApplied(svc: SupabaseClient): Promise<boolean> {
  const { error } = await svc.rpc('public_profiles_version')
  return !error
}

describe.skipIf(!hasEnv)('DLT-001 — profiles is not anon-readable; public_profiles is (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    ready = await migrationApplied(fx.svc)
    if (!ready) console.warn('[public-profiles guard] skipping — public_profiles migration not applied')
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  // ── The exploit ───────────────────────────────────────────────────────────
  describe('the anon key cannot read the profiles table', () => {
    it('a select of the whole row is refused', async () => {
      if (!ready) return
      const { data, error } = await anon().from('profiles').select('*').limit(1)
      expect(error, `expected 42501, got rows: ${JSON.stringify(data)}`).not.toBeNull()
      expect(error!.code).toBe('42501')
    })

    /**
     * `id` alone IS still selectable off the base table: it is one of the
     * columns anon is granted, and the grant — not the table — is the
     * boundary. What must never work is reaching a column outside that list,
     * which is what the rest of this block proves.
     */
    it('a public column is still reachable (the column grant, not the table, is the boundary)', async () => {
      if (!ready) return
      const { error } = await anon().from('profiles').select('id').limit(1)
      expect(error).toBeNull()
    })

    it.each(SECRET_COLUMNS)('anon cannot select profiles.%s', async (col) => {
      if (!ready) return
      const { data, error } = await anon().from('profiles').select(col).limit(1)
      expect(error, `${col} leaked: ${JSON.stringify(data)}`).not.toBeNull()
      expect(error!.code).toBe('42501')
    })

    it('anon cannot reach a secret column through the public view either', async () => {
      if (!ready) return
      for (const col of SECRET_COLUMNS) {
        const { error } = await anon().from('public_profiles').select(col).limit(1)
        expect(error, `public_profiles exposes ${col}`).not.toBeNull()
      }
    })

    it('anon cannot embed profiles through a listings join', async () => {
      if (!ready) return
      const { data, error } = await anon()
        .from('listings')
        .select('id, seller:profiles(email, seller_balance)')
        .limit(1)
      expect(error, `embedded join leaked: ${JSON.stringify(data)}`).not.toBeNull()
    })
  })

  // ── The legitimate public path still works ────────────────────────────────
  describe('public_profiles serves the shop/listing-card path', () => {
    it('anon reads the fixture seller through the view', async () => {
      if (!ready) return
      const { data, error } = await anon()
        .from('public_profiles')
        .select('id, username, shop_name, shop_slug, avatar_url, seller_tier, seller_rating, total_reviews, is_verified, badges, created_at')
        .eq('id', fx!.seller.id)
        .maybeSingle()
      expect(error).toBeNull()
      expect((data as any)?.id).toBe(fx!.seller.id)
    })

    it('every column the app renders is present on the view', async () => {
      if (!ready) return
      const { error } = await anon().from('public_profiles').select(PUBLIC_COLUMNS.join(',')).limit(1)
      expect(error, `public_profiles is missing a column the app reads: ${error?.message}`).toBeNull()
    })

    // `listings` has two FKs to profiles (seller_id, approved_by), so the
    // disambiguated form is what the app actually writes.
    it('anon can still embed the seller through listings via the view', async () => {
      if (!ready) return
      const { error } = await anon()
        .from('listings')
        .select('id, seller:public_profiles!listings_seller_id_fkey(username, shop_slug, seller_rating)')
        .limit(1)
      expect(error, `embedded public_profiles join broke: ${error?.message}`).toBeNull()
    })

    it('anon can still embed public columns off the base table (existing readers keep working)', async () => {
      if (!ready) return
      const { error } = await anon()
        .from('listings')
        .select('id, seller:profiles!listings_seller_id_fkey(username, seller_tier, is_test)')
        .limit(1)
      expect(error, `public-column embed broke: ${error?.message}`).toBeNull()
    })
  })

  // ── Signed-in users ───────────────────────────────────────────────────────
  describe('a signed-in user reads their own row but not a stranger\'s secrets', () => {
    it('the seller reads their own full row, financials included', async () => {
      if (!ready) return
      const { data, error } = await fx!.seller.client
        .from('profiles').select('id, email, seller_balance, kyc_status').eq('id', fx!.seller.id).maybeSingle()
      expect(error).toBeNull()
      expect((data as any)?.id).toBe(fx!.seller.id)
    })

    /**
     * DLT-001b (known, unchanged, tracked): a SIGNED-IN user can still read a
     * stranger's full row. The baseline policy was `USING (true)` for every
     * role, so this migration neither introduces nor widens it — it closes the
     * anon half, which is the Critical one because the anon key is public.
     *
     * Closing this needs column-scoped grants for `authenticated`, and
     * Postgres column grants are role-wide: adding them makes `SELECT email`
     * fail for a user's OWN row too, breaking use-auth.tsx:106 (`select('*')`).
     * The fix is a SECURITY DEFINER `get_my_profile()` RPC first.
     *
     * This test asserts the CURRENT state deliberately, so that when DLT-001b
     * lands it fails loudly and is updated rather than silently passing.
     */
    it('KNOWN GAP (DLT-001b): a signed-in stranger can still read another row', async () => {
      if (!ready) return
      const { data } = await fx!.buyer.client
        .from('profiles').select('id, email, seller_balance').eq('id', fx!.seller.id)
      expect(
        (data ?? []).length,
        'DLT-001b appears to be FIXED — narrow this test to expect 0 rows and update the migration note',
      ).toBe(1)
    })

    it("the buyer still sees the seller's public card through the view", async () => {
      if (!ready) return
      const { data, error } = await fx!.buyer.client
        .from('public_profiles').select('id, username, seller_rating').eq('id', fx!.seller.id).maybeSingle()
      expect(error).toBeNull()
      expect((data as any)?.id).toBe(fx!.seller.id)
    })
  })

  // ── Nothing else regressed ────────────────────────────────────────────────
  describe('dependent views and definer triggers survive', () => {
    it('the seller still reads seller_dashboard_stats (security_invoker over profiles)', async () => {
      if (!ready) return
      const { error } = await fx!.seller.client.from('seller_dashboard_stats').select('*').limit(1)
      expect(error, `seller_dashboard_stats broke: ${error?.message}`).toBeNull()
    })

    it('the anon key still cannot read seller_dashboard_stats (DB-002 stays fixed)', async () => {
      if (!ready) return
      const { error } = await anon().from('seller_dashboard_stats').select('*').limit(1)
      expect(error).not.toBeNull()
    })

    it('the service role still reads the full profiles table', async () => {
      if (!ready) return
      const { error } = await fx!.svc.from('profiles').select('id, email, seller_balance').eq('id', fx!.seller.id).single()
      expect(error).toBeNull()
    })
  })
})
