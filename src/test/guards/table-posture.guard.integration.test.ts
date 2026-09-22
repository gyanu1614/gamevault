/**
 * DLT-005/006 — every public table is RLS-on and revoked from anon/authenticated
 * unless it is explicitly allow-listed with a reason.
 *
 * Root cause (2026-09-20 delta audit): migration 20260913100000 revoked the
 * baseline's default EXECUTE grant on FUNCTIONS but left the TABLES default
 * untouched. Verified live:
 *   DEFAULT_ACL_FUNCS  = {postgres=X/…, service_role=X/…}                ← fixed
 *   DEFAULT_ACL_TABLES = {postgres=arwdDxtm/…, anon=arwdDxtm/…, …}       ← open
 * so every new table is born with SELECT/INSERT/UPDATE/DELETE granted to anon,
 * and RLS is the only thing standing between it and the public key.
 *
 * Seven of the twelve tables added in the week to 2026-09-20 remembered an
 * explicit `revoke all`; five relied on RLS alone. Nothing was exploitable --
 * RLS-on-with-no-policy denies reads and writes alike -- but it is one
 * forgotten ENABLE ROW LEVEL SECURITY away from being Critical.
 *
 * db_p0_posture() could not catch this: it filters `defaclobjtype = 'f'` and
 * has no equivalent for tables ('r'), no check for RLS-on-with-zero-policies,
 * and no check for a table granted to anon. This guard is that missing half.
 *
 * ADDING A TABLE: if it is service-role-only, add `revoke all on table … from
 * anon, authenticated` to its migration and this guard passes untouched. If it
 * is genuinely meant to be reachable with the anon key, add it to
 * PUBLIC_READ_ALLOWLIST below WITH A REASON.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { hasEnv, URL, SVC } from './throwaway'

/**
 * Tables the anon key may legitimately reach, each with the reason. Everything
 * here is public-by-design catalogue or content data: no PII, no money, no
 * credentials. A new entry is a security decision and should be reviewed as
 * one.
 */
const PUBLIC_READ_ALLOWLIST: Record<string, string> = {
  // Catalogue / taxonomy — rendered on every public page.
  games: 'public game catalogue; RLS restricts to is_active = true',
  game_categories: 'per-game category config; catalogue data, no PII',
  global_categories: 'category taxonomy; static reference data',
  categories: 'Phase-A legacy mirror of game_categories; dropped in Phase B',
  listings: 'the marketplace itself; RLS restricts to status = active',
  reviews: 'public seller reviews',
  seller_presence: 'online/offline dot on public seller cards',
  profiles: 'DLT-001: anon holds a COLUMN-scoped grant on display fields only',
  public_profiles: 'DLT-001: the public projection view of profiles',

  // Values / pricing pages — public content by design.
  values_items: 'public value pages; RLS restricts to is_enabled',
  values_prices: 'public value pages; aggregate market pricing, no PII',
  values_price_history: 'public value-page charts; aggregate pricing',

  // Fee engine (PR 1): fees are public information, quoted on the seller fee
  // page and the sell wizard. Read-only: no write policy, writes are
  // service-role only. docs/design/fee-engine.md §1.1–1.2.
  fee_rules: 'seller-commission rates; public by design, no PII, no money',
  platform_fee_settings: 'single-row fee programme terms (floor, founding %, notice days)',

  // SAB public price catalogue.
  sab_brainrots: 'public SAB value pages',
  sab_mutations: 'public SAB value pages',
  sab_price_display: 'materialised public price catalogue',
}

/** Tables that may be written by anon/authenticated (RLS scopes the rows). */
const WRITE_ALLOWLIST: Record<string, string> = {
  listings: 'sellers insert their own listings (RLS + column guards)',
  reviews: 'buyers insert reviews for their own orders',
  profiles: 'users update their own row (guarded columns are trigger-blocked)',
  seller_presence: 'sellers toggle their own presence',
  orders: 'buyers create their own orders (RLS + 20260903020000 lock)',
  messages: 'conversation participants insert messages',
  conversations: 'participants create conversations',
  notifications: 'users mark their own notifications read',
  wishlists: 'users manage their own wishlist',
  seller_applications: 'applicants create and withdraw their own application',
  early_seller_signups: 'public waitlist form',
  buyer_waitlist: 'public waitlist form',
  seller_leads: 'public lead form',
  disputes: 'order parties open a dispute',
  dispute_messages: 'dispute participants reply',
  withdrawal_methods: 'sellers manage their own payout methods',
  withdrawal_requests: 'sellers request their own withdrawals',
  gdpr_requests: 'users file their own GDPR request',

  // Catalogue tables that ALSO carry the baseline's blanket write grant.
  // Writes are blocked by RLS (admin-only policies), so the grant is inert --
  // recorded here rather than hidden, and revocable in the same sweep as
  // LEGACY_BASELINE.
  games: 'legacy blanket grant; writes blocked by the admin-only RLS policy',
  game_categories: 'legacy blanket grant; writes blocked by game_categories_admin_all',
  global_categories: 'legacy blanket grant; writes blocked by RLS',
  categories: 'legacy blanket grant; Phase-A mirror, writes blocked by RLS',
  sab_brainrots: 'legacy blanket grant; writes blocked by RLS',
  sab_mutations: 'legacy blanket grant; writes blocked by RLS',
  sab_price_display: 'legacy blanket grant; writes blocked by RLS',
  values_items: 'legacy blanket grant; writes blocked by RLS (no write policy)',
  values_prices: 'legacy blanket grant; writes blocked by RLS (no write policy)',
  values_price_history: 'legacy blanket grant; writes blocked by RLS (no write policy)',
}

/**
 * FROZEN BASELINE — the 78 tables that already carried the baseline's blanket
 * anon/authenticated grant when this guard was written (2026-09-21).
 *
 * None is exploitable: every public table has RLS enabled (asserted below),
 * and every SELECT policy on a sensitive one (ledger_*, wallet_*, payouts,
 * webhook_events, seller_kyc_documents, audit_logs, admin_roles) is scoped to
 * auth.uid() or an admin check — verified on the live stack before freezing
 * this list. They are recorded here rather than mass-revoked because a blanket
 * REVOKE across 78 tables risks breaking a working read path for no security
 * gain today, and each deserves its own review.
 *
 * THIS LIST MUST ONLY EVER SHRINK. A new table cannot land here: the TABLES
 * default privilege is closed (migration 20260921005842), so anything created
 * from now on is born with no grant and would fail the checks below.
 */
const LEGACY_BASELINE: ReadonlySet<string> = new Set([
  'admin_action_logs', 'admin_activity_log', 'admin_notifications', 'admin_roles',
  'adopt_me_market_raw_listings', 'adopt_me_pet_values', 'adopt_me_pets', 'adopt_me_price_history',
  'attribute_conditional_rules', 'attribute_options', 'attribute_templates', 'attributes',
  'audit_logs', 'banner_presets', 'blog_posts', 'buyer_waitlist',
  'catalogue_items', 'category_configs', 'category_fee_config', 'conversations',
  'dispute_messages', 'dispute_resolutions', 'disputes', 'early_seller_signups',
  'fee_config_audit', 'founding_notices', 'fraud_flags', 'game_fee_overrides',
  'gdpr_requests', 'inform_disclosures', 'instant_delivery_inventory', 'ledger_accounts',
  'ledger_entries', 'ledger_transactions', 'listing_price_history', 'listing_templates',
  'loyalty_credits', 'messages', 'notifications', 'order_cancellation_requests',
  'orders', 'payouts', 'processed_operations', 'promo_code_usages',
  'promo_codes', 'referral_codes', 'referral_earnings', 'reserve_holds',
  'review_edit_history', 'role_permissions', 'sab_brainrot_variants', 'sab_external_market_observations',
  'sab_import_runs', 'sab_market_evidence_display', 'sab_market_observations', 'sab_mutation_price_multipliers',
  'sab_price_corrections', 'sab_price_history', 'sab_price_snapshots', 'sab_source_mappings',
  'seller_applications', 'seller_kyc_documents', 'seller_leads', 'seller_notifications',
  'seller_payouts', 'seller_restrictions', 'seller_stats', 'seller_tier_config',
  'seller_tier_history', 'seller_verification_logs', 'shop_visits', 'trustpilot_invitations',
  'wallet_balances', 'wallet_transactions', 'webhook_events', 'wishlists',
  'withdrawal_methods', 'withdrawal_requests'
])

let svc: SupabaseClient
let applied = false

type Row = {
  table_name: string
  rls_enabled: boolean
  policy_count: number
  anon_select: boolean
  anon_write: boolean
  auth_select: boolean
  auth_write: boolean
}

let rows: Row[] = []

describe.skipIf(!hasEnv)('DLT-005/006 — public table posture (integration)', () => {
  beforeAll(async () => {
    svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    const { error } = await svc.rpc('table_posture_version')
    applied = !error
    if (!applied) {
      console.warn('[table-posture guard] skipping — table posture migration not applied')
      return
    }
    const { data } = await svc.rpc('public_table_posture')
    rows = (data as Row[]) ?? []
  }, 30_000)

  it('the migration is applied and the probe returns tables', () => {
    if (!applied) return
    expect(rows.length).toBeGreaterThan(20)
  })

  it('the TABLES default privilege no longer grants anon or authenticated', async () => {
    if (!applied) return
    const { data } = await svc.rpc('default_table_acl_grants_public')
    expect(
      data,
      'ALTER DEFAULT PRIVILEGES still grants new tables to anon/authenticated — every future table is born world-granted',
    ).toBe(false)
  })

  it('every table has RLS enabled', () => {
    if (!applied) return
    const off = rows.filter((r) => !r.rls_enabled).map((r) => r.table_name)
    expect(off, `tables without ENABLE ROW LEVEL SECURITY:\n${off.join('\n')}`).toEqual([])
  })

  it('no table outside the allow-list is readable by anon', () => {
    if (!applied) return
    const leaked = rows
      .filter((r) => r.anon_select && !(r.table_name in PUBLIC_READ_ALLOWLIST) && !LEGACY_BASELINE.has(r.table_name))
      .map((r) => r.table_name)
    expect(
      leaked,
      `anon-readable tables missing from PUBLIC_READ_ALLOWLIST — add \`revoke all on table … from anon, authenticated\`\n` +
        `to the migration, or allow-list it WITH A REASON:\n${leaked.join('\n')}`,
    ).toEqual([])
  })

  it('no table outside the allow-list is writable by anon', () => {
    if (!applied) return
    const writable = rows
      .filter((r) => r.anon_write && !(r.table_name in WRITE_ALLOWLIST) && !LEGACY_BASELINE.has(r.table_name))
      .map((r) => r.table_name)
    expect(
      writable,
      `anon holds INSERT/UPDATE/DELETE on tables not in WRITE_ALLOWLIST:\n${writable.join('\n')}`,
    ).toEqual([])
  })

  it('no table outside the allow-list is writable by a plain signed-in user', () => {
    if (!applied) return
    const writable = rows
      .filter((r) => r.auth_write && !(r.table_name in WRITE_ALLOWLIST) && !LEGACY_BASELINE.has(r.table_name))
      .map((r) => r.table_name)
    expect(
      writable,
      `authenticated holds INSERT/UPDATE/DELETE on tables not in WRITE_ALLOWLIST:\n${writable.join('\n')}`,
    ).toEqual([])
  })

  it('the five tables that relied on RLS alone are now explicitly revoked', () => {
    if (!applied) return
    const backfilled = [
      'values_games', 'values_item_aliases', 'values_rejection_patterns',
      'values_raw_listings', 'sab_raw_listing_daily',
    ]
    for (const name of backfilled) {
      const row = rows.find((r) => r.table_name === name)
      expect(row, `${name} is missing from the posture probe`).toBeDefined()
      expect(row!.anon_select, `${name} is still anon-readable`).toBe(false)
      expect(row!.anon_write, `${name} is still anon-writable`).toBe(false)
      expect(row!.auth_write, `${name} is still writable by authenticated`).toBe(false)
    }
  })

  /**
   * The ratchet. The frozen baseline may only ever shrink: a table that has
   * since been revoked (or dropped) must be removed from LEGACY_BASELINE, so
   * the list cannot quietly become a dumping ground that hides new drift.
   */
  it('LEGACY_BASELINE only shrinks — every entry still carries a grant', () => {
    if (!applied) return
    const live = new Map(rows.map((r) => [r.table_name, r]))
    const cleaned = [...LEGACY_BASELINE].filter((name) => {
      const r = live.get(name)
      if (!r) return true // dropped table
      return !r.anon_select && !r.anon_write && !r.auth_write
    })
    expect(
      cleaned.sort(),
      'these tables no longer need the legacy exemption — remove them from LEGACY_BASELINE:\n' +
        `${cleaned.sort().join('\n')}`,
    ).toEqual([])
  })

  it('the allow-lists contain no stale entry (a table that no longer exists)', () => {
    if (!applied) return
    const live = new Set(rows.map((r) => r.table_name))
    const stale = [...Object.keys(PUBLIC_READ_ALLOWLIST), ...Object.keys(WRITE_ALLOWLIST)]
      .filter((t) => !live.has(t) && t !== 'public_profiles')
    expect(stale, `allow-listed tables that no longer exist — remove them:\n${stale.join('\n')}`).toEqual([])
  })
})
