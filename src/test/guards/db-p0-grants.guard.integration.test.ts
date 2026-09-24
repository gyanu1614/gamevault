/**
 * DB-002 / DB-003 / DB-004 / DB-005 / DB-006 — hotfix/db-p0 (audit 2026-09-11).
 *
 * Root cause (DB-006): the baseline's ALTER DEFAULT PRIVILEGES granted EXECUTE
 * on every new public function to anon + authenticated, so 39 SECURITY DEFINER
 * functions and 10 owner-privileged views were reachable with the public anon
 * key. Reproduced 2026-09-12 on the local stack: anon read seller applications
 * (tax id, bank routing) through `seller_applications_with_users`, froze /
 * released / refunded any order through the escrow definers, and read delivered
 * credentials through `get_orders_ready_for_auto_release()`.
 *
 * Every exploit here runs through PostgREST as exactly what an attacker holds
 * (the anon key, or a plain signed-in user). Positives prove the legitimate
 * paths survive: admin sessions still read the admin views, sellers still read
 * their own dashboard stats through the browser client, the service role still
 * drives the crons, the listings trigger chain still runs for user inserts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, promoteToEstablishedSeller, URL, ANON, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
let heldOrderId = ''
let applicationId = ''
let taxId = ''
/** A signed-in user who is party to nothing in the fixture — the audience seller_dashboard_stats leaked to. */
let stranger: { id: string; client: SupabaseClient } | null = null
const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } })

const VIEWS = [
  'seller_applications_with_users', 'disputes_with_users', 'moderation_queue', 'admin_review_overview',
  'recent_security_events', 'failed_operations', 'seller_dashboard_stats', 'seller_shop_banners',
  'shop_analytics_summary', 'trustpilot_stats',
] as const

/** The only SECURITY DEFINER functions the anon key may still execute. */
const ANON_DEFINER_ALLOWLIST = [
  'has_permission', 'is_admin',
  // Fee engine PR 1: the public fee page and the ISR'd /[game]/sell resolve with
  // no session; with a seller id it only returns a percentage the seller already
  // publishes (rank/founding badge). Writes nothing. docs/design/fee-engine.md §2.5.
  'resolve_seller_fee',
  'sab_public_price_catalog_rows',
]
/** …and the only ones a plain signed-in user may execute (auth.uid()-scoped or moderator-asserted). */
const AUTHENTICATED_DEFINER_ALLOWLIST = [
  ...ANON_DEFINER_ALLOWLIST,
  'approve_listing', 'can_edit_review', 'check_seller_needs_moderation', 'checkout_wallet_hold_minor',
  'get_admin_role', 'get_my_permissions', 'get_seller_publish_policy', 'is_super_admin_safe',
  'reject_listing', 'reject_seller_application', 'request_listing_changes', 'withdraw_seller_application',
].sort()

/**
 * 20260914100000_money_atomicity.sql (DB-015/016/017): every function is
 * service_role only — none may ever appear in the anon/authenticated lists.
 * Listed here so the posture test names the culprit if a later migration
 * opens one instead of just showing a list diff.
 */
const MONEY_ATOMICITY_SERVICE_ONLY = [
  'order_cancel_return_wallet', 'order_refund_to_wallet', 'withdrawal_cancel', 'withdrawal_reject',
  'inventory_claim_for_order', 'promo_usage_record', 'money_fault_hook', 'ledger_test_cleanup_by_withdrawal',
  'money_atomicity_version', 'webhook_event_claim',
  // fix/checkout-p0 (PAY-003): payment confirm + stock claim, one RPC, service_role only.
  'order_confirm_payment',
  // fix/checkout-round-b Part 1: the payment attempts model. Checkout, retry
  // and the sweep drive these as the backend; a browser must never open,
  // activate or supersede a charge, nor read another buyer's attempts.
  'payment_attempts_version', 'payment_attempts_backfill', 'order_create_pending',
  'payment_attempt_open', 'payment_attempt_activate', 'payment_attempt_supersede',
  'expired_pending_payment_attempts',
  // Part 2: the provider cancel outbox + the deduped admin alert helper.
  'provider_cancel_outbox_version', 'provider_cancel_outbox_enqueue', 'provider_cancel_outbox_claim',
  'provider_cancel_outbox_mark', 'admin_alert_once',
  // Part 3: late-payment / overpayment credit — wallet money moves, service only.
  'late_payment_credit_version', 'order_credit_late_payment',
  // Part 4: the stuck-webhook reconciler + the sweep's poison counter.
  'payment_reconciler_version', 'webhook_events_flip_unreplayable', 'webhook_events_stuck_claim',
  'webhook_event_reconcile_mark', 'payment_attempt_note_sweep_failure',
  // Checkout B3: the buyer method-fee quote. The browser never quotes — the
  // page and createCheckout reach it through eligibleMethods (service role);
  // a quote the client could call would be a fee oracle it could disagree with.
  'buyer_method_fees_version', 'buyer_fee_quote', 'buyer_fee_quote_many',
]

/**
 * 20260916100000_rate_limits.sql: the limiter is service-role only. If the
 * browser could call rate_limit_hit() it could burn any IP's budget (a
 * denial-of-service against another user by key), or probe the counters to
 * learn which keys are close to their limit. Named here so the posture test
 * says which function regressed rather than just printing a list diff.
 */
const RATE_LIMIT_SERVICE_ONLY = [
  'rate_limit_hit', 'rate_limits_cleanup', 'rate_limits_version',
]

async function dbP0Applied(): Promise<boolean> {
  const { error } = await fx!.svc.rpc('db_p0_guards_version')
  return !error
}
async function heldStatus() {
  const { data } = await fx!.svc.from('orders').select('status, escrow_status').eq('id', heldOrderId).single()
  return data as any
}
async function reHold() {
  await fx!.svc.from('orders').update({ escrow_status: 'held', auto_release_at: new Date(Date.now() - 3_600_000).toISOString() }).eq('id', heldOrderId)
}
function expectRevoked(res: { error: { code?: string; message: string } | null; data: unknown }, what: string) {
  if (!res.error) throw new Error(`${what}: expected 42501, but the call succeeded: ${JSON.stringify(res.data).slice(0, 200)}`)
  expect(res.error.code, `${what}: ${res.error.message}`).toBe('42501')
}

/**
 * DB-022: the bucket-A functions were dropped, not just revoked, so PostgREST
 * can no longer resolve them — the schema cache returns PGRST202 instead of a
 * 42501 from the executor. Asserting on that code pins the drop: were one of
 * them re-created by a later migration, this fails rather than passing quietly.
 */
function expectDropped(res: { error: { code?: string; message: string } | null; data: unknown }, what: string) {
  if (!res.error) throw new Error(`${what}: expected it to be dropped, but the call succeeded: ${JSON.stringify(res.data).slice(0, 200)}`)
  expect(res.error.code, `${what} should no longer exist: ${res.error.message}`).toBe('PGRST202')
}

/** DB-022 — bucket A of db-p0-grants-plan.md, dropped by 20260914110000. */
const DROPPED_DEFINERS = [
  'release_escrow', 'refund_escrow', 'freeze_escrow', 'release_escrow_to_seller_balance',
  'cleanup_old_audit_logs', 'get_pending_trustpilot_invitations', 'get_listings_pending_moderation',
  'mark_trustpilot_invitation_sent', 'increment_listing_views', 'get_user_role', 'has_role',
  'apply_rank_strikes',
]

describe.skipIf(!hasEnv)('DB-P0 — function grants, view security_invoker, default privileges (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = await dbP0Applied()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    taxId = `GUARD-TAX-${Math.random().toString(36).slice(2, 8)}`
    const { data: app, error: ae } = await fx.svc.from('seller_applications').insert({
      user_id: fx.buyer.id, status: 'pending', is_18_or_older: true, seller_type: 'individual',
      display_name: 'Grants Applicant', submitted_at: new Date().toISOString(),
      full_legal_name: 'Guard Test Victim', tax_id_vat: taxId, bank_routing_code: 'GUARD-ROUTING-1',
    }).select('id').single()
    if (ae) throw new Error(`application insert: ${ae.message}`)
    applicationId = (app as any).id
    // A delivered/held order past its auto-release time, with delivered credentials on it.
    const { data: held, error: he } = await fx.svc.from('orders').insert({
      buyer_id: fx.buyer.id, seller_id: fx.seller.id, listing_id: fx.listingId, quantity: 1,
      unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
      platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: 'USD',
      status: 'delivered', escrow_status: 'held',
      auto_release_at: new Date(Date.now() - 3_600_000).toISOString(),
      instant_delivery_code: 'GUARD-SECRET-KEY',
    }).select('id').single()
    if (he) throw new Error(`held order insert: ${he.message}`)
    heldOrderId = (held as any).id
    // makeFixture's buyer is party to the seller's completed order (orders RLS
    // shows buyers their own orders), so the "other user" must be a stranger.
    const email = `guardtest-stranger-${taxId.slice(-6).toLowerCase()}@example.com`
    const password = `Pw!${taxId}Xy`
    const { data: su, error: se } = await fx.svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `gt_stranger_${taxId.slice(-6).toLowerCase()}` } })
    if (se || !su.user) throw new Error(`createUser(stranger): ${se?.message}`)
    const client = createClient(URL!, ANON!, { auth: { persistSession: false } })
    const { error: si } = await client.auth.signInWithPassword({ email, password })
    if (si) throw new Error(`signIn(stranger): ${si.message}`)
    stranger = { id: su.user.id, client }
  }, 60_000)
  afterAll(async () => {
    if (fx) await fx.svc.from('seller_tier_history').delete().in('user_id', [fx.seller.id, fx.buyer.id, fx.admin.id])
    if (fx && stranger) {
      const { error } = await fx.svc.auth.admin.deleteUser(stranger.id)
      if (error) throw new Error(`deleteUser(stranger): ${error.message}`)
    }
    await fx?.cleanup()
  }, 60_000)

  it('20260913100000_db_p0_grants.sql is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  // ── DB-002: views ──────────────────────────────────────────────────────────
  describe('DB-002 — views run as the caller and are not readable with the anon key', () => {
    it.each(VIEWS)('the anon key cannot SELECT from %s', async (view) => {
      expectRevoked(await anon().from(view).select('*').limit(1), view)
    })

    it("a signed-in non-admin sees nobody else's application through seller_applications_with_users", async () => {
      const { data, error } = await fx!.seller.client.from('seller_applications_with_users').select('id, tax_id_vat').eq('user_id', fx!.buyer.id)
      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('an admin session still reads the application, tax id included, through the view', async () => {
      const { data, error } = await fx!.admin.client.from('seller_applications_with_users').select('id, tax_id_vat').eq('id', applicationId).single()
      expect(error).toBeNull()
      expect((data as any).tax_id_vat).toBe(taxId)
    })

    it("a signed-in stranger sees no earnings or order counts for a seller in seller_dashboard_stats", async () => {
      const { data, error } = await stranger!.client.from('seller_dashboard_stats').select('seller_id, completed_orders, earnings_all_time').eq('seller_id', fx!.seller.id)
      expect(error).toBeNull()
      for (const row of (data ?? []) as any[]) {
        expect(Number(row.completed_orders)).toBe(0)
        expect(Number(row.earnings_all_time)).toBe(0)
      }
    })

    it('the seller still reads their own stats through seller_dashboard_stats (browser-client path)', async () => {
      const { data, error } = await fx!.seller.client.from('seller_dashboard_stats').select('seller_id, completed_orders').eq('seller_id', fx!.seller.id).single()
      expect(error).toBeNull()
      expect(Number((data as any).completed_orders)).toBe(1)
    })
  })

  // ── DB-003 / DB-022: escrow writers ────────────────────────────────────────
  describe('DB-003 — the escrow definers are gone (DB-022)', () => {
    it('the anon key cannot freeze a held order — freeze_escrow no longer exists', async () => {
      expectDropped(await anon().rpc('freeze_escrow', { order_id: heldOrderId }), 'freeze_escrow')
      expect((await heldStatus()).escrow_status).toBe('held')
    })
    it('a signed-in user cannot freeze a held order either', async () => {
      expectDropped(await fx!.buyer.client.rpc('freeze_escrow', { order_id: heldOrderId }), 'freeze_escrow')
      expect((await heldStatus()).escrow_status).toBe('held')
    })
    it('the anon key cannot release a held order — release_escrow no longer exists', async () => {
      expectDropped(await anon().rpc('release_escrow', { order_id: heldOrderId, method: 'auto' }), 'release_escrow')
      expect(await heldStatus()).toMatchObject({ status: 'delivered', escrow_status: 'held' })
    })
    it('the anon key cannot refund a held order — refund_escrow no longer exists', async () => {
      expectDropped(await anon().rpc('refund_escrow', { order_id: heldOrderId }), 'refund_escrow')
      expect(await heldStatus()).toMatchObject({ status: 'delivered', escrow_status: 'held' })
    })
    it('release_escrow_to_seller_balance no longer exists', async () => {
      expectDropped(await anon().rpc('release_escrow_to_seller_balance', { p_order_id: heldOrderId, p_seller_id: fx!.seller.id, p_amount: 1 }), 'release_escrow_to_seller_balance')
    })
  })

  // ── DB-004: definer getters ────────────────────────────────────────────────
  describe('DB-004 — whole-row definer getters are service-role only', () => {
    it('the anon key cannot list orders ready for auto-release (delivered credentials)', async () => {
      expectRevoked(await anon().rpc('get_orders_ready_for_auto_release'), 'get_orders_ready_for_auto_release')
    })
    it('a signed-in user cannot either', async () => {
      expectRevoked(await fx!.buyer.client.rpc('get_orders_ready_for_auto_release'), 'get_orders_ready_for_auto_release')
    })
    it('the service role still lists the due order for the cron', async () => {
      const { data, error } = await fx!.svc.rpc('get_orders_ready_for_auto_release')
      expect(error).toBeNull()
      expect((data as any[]).map((o) => o.id)).toContain(heldOrderId)
    })
    it.each(['get_pending_trustpilot_invitations', 'get_listings_pending_moderation'])('%s no longer exists (DB-022)', async (fn) => {
      expectDropped(await anon().rpc(fn), fn)
    })
  })

  // ── DB-022: the dead definers are dropped, not merely revoked ──────────────
  describe('DB-022 — bucket-A definers no longer exist', () => {
    it.each(DROPPED_DEFINERS)('%s is gone from the schema, for the anon key and the service role alike', async (fn) => {
      // PostgREST resolves RPC names through the schema cache, so a dropped
      // function is PGRST202 for every role — including the service role,
      // which the revoke left able to call these.
      expectDropped(await anon().rpc(fn as never, {} as never), fn)
      expectDropped(await fx!.svc.rpc(fn as never, {} as never), fn)
    })
  })

  // ── DB-006: default privileges + sweep ─────────────────────────────────────
  describe('DB-006 — default EXECUTE grant revoked; only the allow-list stays callable', () => {
    it('posture probe: default ACL no longer grants anon/authenticated, every view is security_invoker, definer allow-lists match', async () => {
      const { data, error } = await fx!.svc.rpc('db_p0_posture')
      expect(error).toBeNull()
      const p = data as any
      expect(p.default_acl_grants_anon_or_authenticated).toBe(false)
      expect(p.views_without_security_invoker).toEqual([])
      expect([...p.anon_executable_definers].sort()).toEqual([...ANON_DEFINER_ALLOWLIST].sort())
      expect([...p.authenticated_executable_definers].sort()).toEqual(AUTHENTICATED_DEFINER_ALLOWLIST)
      for (const fn of [...MONEY_ATOMICITY_SERVICE_ONLY, ...RATE_LIMIT_SERVICE_ONLY]) {
        expect(p.anon_executable_definers, `${fn} must not be anon-executable`).not.toContain(fn)
        expect(p.authenticated_executable_definers, `${fn} must not be authenticated-executable`).not.toContain(fn)
      }
    })

    it.each([
      ['get_seller_tier_info', () => ({ p_user_id: fx!.seller.id })],
      ['can_seller_reapply', () => ({ user_id_param: fx!.buyer.id })],
      ['decrypt_delivery_data', () => ({ p_encrypted_data: 'x', p_decryption_key: 'y' })],
      ['mark_inactive_sellers_offline', () => ({})],
      ['upgrade_all_seller_tiers', () => ({})],
      ['sab_recompute_tradeable', () => ({})],
      // ROUTE-014: the two SAB snapshot refreshes. Both are service-role-only —
      // they are cron/crawl machinery, and sab_refresh_evidence_display() runs
      // with a 180s statement_timeout, so an anon caller could hold a
      // long-running DELETE+INSERT over the whole evidence set.
      ['sab_refresh_evidence_display', () => ({})],
      ['sab_refresh_price_display', () => ({})],
      ['cleanup_expired_idempotency_keys', () => ({})],
      ['assert_moderator', () => ({})],
    ] as const)('the anon key cannot call %s', async (fn, args) => {
      expectRevoked(await anon().rpc(fn, args()), fn)
    })

    it("a signed-in user cannot read another seller's tier stats", async () => {
      expectRevoked(await fx!.buyer.client.rpc('get_seller_tier_info', { p_user_id: fx!.seller.id }), 'get_seller_tier_info')
    })

    it('is_admin() and has_permission() stay callable with the anon key (RLS policies evaluate them)', async () => {
      const a = await anon().rpc('is_admin')
      expect(a.error).toBeNull()
      expect(a.data).toBe(false)
      const h = await anon().rpc('has_permission', { required_permission: 'applications.review' })
      expect(h.error).toBeNull()
      expect(h.data).toBe(false)
    })

    it('a signed-in user keeps the auth.uid()-scoped helpers', async () => {
      const { error } = await fx!.seller.client.rpc('get_my_permissions')
      expect(error).toBeNull()
    })

    it('the anon key cannot call check_seller_needs_moderation, a signed-in user can (listings trigger chain)', async () => {
      expectRevoked(await anon().rpc('check_seller_needs_moderation', { seller_id: fx!.seller.id }), 'check_seller_needs_moderation')
      const { error } = await fx!.seller.client.rpc('check_seller_needs_moderation', { seller_id: fx!.seller.id })
      expect(error).toBeNull()
    })

    it('a seller can still INSERT a listing through PostgREST (the invoker trigger calls the definer helper)', async () => {
      const { data: l } = await fx!.svc.from('listings').select('game_id, category_id').eq('id', fx!.listingId).single()
      const { error } = await fx!.seller.client.from('listings').insert({
        seller_id: fx!.seller.id, game_id: (l as any).game_id, category_id: (l as any).category_id,
        title: 'GUARD-TEST-trigger-chain', description: 'guard test throwaway', price: 1, quantity: 1, status: 'active',
      })
      expect(error).toBeNull()
    })

    it('a moderator session still runs the listing-moderation RPCs', async () => {
      const { error } = await fx!.admin.client.rpc('request_listing_changes', { listing_id: fx!.listingId, admin_id: fx!.admin.id, changes: 'guard probe' })
      expect(error).toBeNull()
    })
  })

  // ── ROUTE-014: the SAB snapshot refreshes ─────────────────────────────────
  describe('ROUTE-014 — sab_refresh_evidence_display() is service-role-only and works', () => {
    // The revoke is asserted in the anon sweep above. This is the other half:
    // a REVOKE that also broke the legitimate caller would fail the crawl and
    // the correction cron, which is the failure this materialization exists to
    // prevent. A signed-in user must not reach it either — it is crawl
    // machinery with a 180s statement_timeout.
    it('a plain signed-in user cannot call it', async () => {
      expectRevoked(await fx!.seller.client.rpc('sab_refresh_evidence_display'), 'sab_refresh_evidence_display')
    })

    it('the service role executes it and gets a row count back', async () => {
      const { data, error } = await fx!.svc.rpc('sab_refresh_evidence_display')
      expect(error, error?.message).toBeNull()
      expect(typeof data).toBe('number')
      expect(data as number).toBeGreaterThanOrEqual(0)
      // ~9s against prod (real evidence volume) — well over vitest's 5s default.
    }, 30_000)
  })

  // ── DB-005: tier cron body ────────────────────────────────────────────────
  describe('DB-005 — upgrade_all_seller_tiers() runs against the real profiles columns', () => {
    it('the service role executes it without error and gets a count back', async () => {
      const { data, error } = await fx!.svc.rpc('upgrade_all_seller_tiers')
      expect(error, error?.message).toBeNull()
      expect(typeof data).toBe('number')
    })
  })
})
