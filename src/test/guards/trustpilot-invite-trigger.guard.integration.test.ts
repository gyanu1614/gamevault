/**
 * Trustpilot invite trigger — order completion must never fail because of it.
 *
 * `schedule_trustpilot_invitation` runs AFTER UPDATE OF status on orders, in
 * the same transaction as the completion. Before 20261011… it copied the
 * buyer's profile email into a NOT NULL column, so a buyer with no email
 * made the completion itself roll back (B4, reproduced on the local stack
 * 2026-10-11: "null value in column email of relation trustpilot_invitations").
 *
 * Every fixture lives inside ONE psql transaction that ends in ROLLBACK, so
 * nothing is left behind (no teardown needed). Direct DB session on purpose:
 * it is the only way to add a temporary failing constraint to prove the
 * trigger swallows its own errors. Local stack only.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { assertGuardTargetAllowed } from './throwaway'
import { fixtureNamespace, targetIsLocal, testDbUrl, type FixtureNamespace } from './fixture-namespace'

const LOCAL = targetIsLocal()
const itLocal = it.skipIf(!LOCAL)

let ns: FixtureNamespace

function psqlRows(script: string): string[] {
  const out = execFileSync('psql', [testDbUrl(), '-v', 'ON_ERROR_STOP=1', '-q', '-At', '-c', script], { stdio: 'pipe' })
  return out.toString().split('\n').filter(Boolean)
}

/** Buyer (email optional) + seller + game + enabled pair + listing + delivered order. */
function fixtureSql(ids: Record<string, string>, buyerEmail: string | null, suffix = ''): string {
  const q = (s: string | null) => (s === null ? 'NULL' : `'${s}'`)
  const slug = `guard-test-${ns.tag}${suffix}`
  return `
INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
  ('${ids.buyer}', ${q(buyerEmail)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('${ids.seller}', '${ns.email('seller' + suffix)}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
INSERT INTO profiles (id, username, email) VALUES
  ('${ids.buyer}', '${ns.username('buyer' + suffix)}', ${q(buyerEmail)}),
  ('${ids.seller}', '${ns.username('seller' + suffix)}', '${ns.email('seller' + suffix)}')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
INSERT INTO games (id, name, slug) VALUES ('${ids.game}', '${ns.listingTitle()}${suffix}', '${slug}');
INSERT INTO global_categories (id, name, slug, default_type, default_slug)
  VALUES ('${ids.global}', 'Guard Items', '${slug}', 'items', '${slug}');
INSERT INTO game_categories (id, game_id, global_category_id, slug, name, type)
  VALUES ('${ids.pair}', '${ids.game}', '${ids.global}', '${slug}', 'Guard Items', 'items');
INSERT INTO listings (id, seller_id, game_id, game_category_id, category_id, title, description, price)
  VALUES ('${ids.listing}', '${ids.seller}', '${ids.game}', '${ids.pair}',
          (SELECT legacy_category_id FROM game_categories WHERE id = '${ids.pair}'),
          '${ns.listingTitle()}', 'Guard fixture listing used by the Trustpilot trigger test.', 10);
INSERT INTO orders (id, buyer_id, seller_id, listing_id, unit_price, subtotal, platform_fee_rate,
                    payment_processing_fee_rate, platform_fee, payment_processing_fee, total_amount, seller_payout, status)
  VALUES ('${ids.order}', '${ids.buyer}', '${ids.seller}', '${ids.listing}', 10, 10, 0, 0, 0, 0, 10, 10, 'delivered');`
}

function freshIds() {
  return Object.fromEntries(['buyer', 'seller', 'game', 'global', 'pair', 'listing', 'order'].map((k) => [k, randomUUID()]))
}

describe('trustpilot invite trigger never breaks order completion (B4)', () => {
  beforeAll(() => {
    assertGuardTargetAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env)
    ns = fixtureNamespace()
  })

  itLocal('a buyer with no email still completes; the invite row is kept with a NULL email', () => {
    const ids = freshIds()
    const rows = psqlRows(`BEGIN;
${fixtureSql(ids, null)}
UPDATE orders SET status = 'completed' WHERE id = '${ids.order}';
SELECT 'status=' || status FROM orders WHERE id = '${ids.order}';
SELECT 'invite_email_null=' || (email IS NULL) FROM trustpilot_invitations WHERE order_id = '${ids.order}';
ROLLBACK;`)
    expect(rows).toContain('status=completed')
    expect(rows).toContain('invite_email_null=true')
  })

  itLocal('any error inside the trigger is swallowed — the completion commits without an invite row', () => {
    const ids = freshIds()
    const rows = psqlRows(`BEGIN;
${fixtureSql(ids, ns.email('buyer'))}
ALTER TABLE trustpilot_invitations ADD CONSTRAINT guard_tmp_reject_all CHECK (false) NOT VALID;
UPDATE orders SET status = 'completed' WHERE id = '${ids.order}';
SELECT 'status=' || status FROM orders WHERE id = '${ids.order}';
SELECT 'invites=' || count(*) FROM trustpilot_invitations WHERE order_id = '${ids.order}';
ROLLBACK;`)
    expect(rows).toContain('status=completed')
    expect(rows).toContain('invites=0')
  })

  itLocal('the trigger function is SECURITY DEFINER with search_path pinned to public', () => {
    const rows = psqlRows(`SELECT prosecdef::text || '|' || coalesce(array_to_string(proconfig, ','), '')
      FROM pg_proc WHERE oid = 'public.schedule_trustpilot_invitation()'::regprocedure;`)
    expect(rows[0]).toBe('true|search_path=public')
  })

  itLocal('a completion schedules a row as `scheduled`, due one hour later for the cron safety net', () => {
    const ids = freshIds()
    const rows = psqlRows(`BEGIN;
${fixtureSql(ids, ns.email('buyer'))}
UPDATE orders SET status = 'completed' WHERE id = '${ids.order}';
SELECT 'status=' || status || '|attempts=' || attempts
       || '|due_in_window=' || (scheduled_for BETWEEN now() + interval '55 minutes' AND now() + interval '65 minutes')
  FROM trustpilot_invitations WHERE order_id = '${ids.order}';
ROLLBACK;`)
    expect(rows).toContain('status=scheduled|attempts=0|due_in_window=true')
  })
})

describe('trustpilot missing-invite sweep', () => {
  beforeAll(() => {
    assertGuardTargetAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env)
    ns = fixtureNamespace()
  })

  itLocal('finds a recently completed order whose invite row is missing, and only that one', () => {
    const a = freshIds()
    const b = freshIds()
    const rows = psqlRows(`BEGIN;
${fixtureSql(a, ns.email('buyer'))}
UPDATE orders SET status = 'completed' WHERE id = '${a.order}';
DELETE FROM trustpilot_invitations WHERE order_id = '${a.order}';
${fixtureSql(b, ns.email('buyerb'), 'b')}
UPDATE orders SET status = 'completed' WHERE id = '${b.order}';
UPDATE trustpilot_settings SET invites_tracked_since = now() - interval '1 day' WHERE id = 1;
SET LOCAL ROLE service_role;
SELECT 'missing=' || order_id FROM trustpilot_orders_missing_invite(now() - interval '3 days', 50);
ROLLBACK;`)
    expect(rows).toContain(`missing=${a.order}`)
    expect(rows).not.toContain(`missing=${b.order}`)
  })

  itLocal('never reaches back before the moment tracking started (no double invite after deploy)', () => {
    const a = freshIds()
    const rows = psqlRows(`BEGIN;
${fixtureSql(a, ns.email('buyer'))}
UPDATE orders SET status = 'completed' WHERE id = '${a.order}';
DELETE FROM trustpilot_invitations WHERE order_id = '${a.order}';
UPDATE trustpilot_settings SET invites_tracked_since = now() + interval '1 minute' WHERE id = 1;
SET LOCAL ROLE service_role;
SELECT 'missing=' || order_id FROM trustpilot_orders_missing_invite(now() - interval '3 days', 50);
SELECT 'done';
ROLLBACK;`)
    expect(rows).toEqual(['done'])
  })

  itLocal('the tracking start time stays private', () => {
    let error = ''
    try {
      psqlRows(`BEGIN; SET LOCAL ROLE anon; SELECT invites_tracked_since FROM trustpilot_settings; ROLLBACK;`)
    } catch (e: any) {
      error = String(e?.stderr ?? e)
    }
    expect(error).toMatch(/permission denied/)
  })

  itLocal('is service-role only', () => {
    let error = ''
    try {
      psqlRows(`BEGIN; SET LOCAL ROLE authenticated; SELECT * FROM trustpilot_orders_missing_invite(now(), 1); ROLLBACK;`)
    } catch (e: any) {
      error = String(e?.stderr ?? e)
    }
    expect(error).toMatch(/permission denied/)
  })
})

describe('trustpilot settings + stats posture', () => {
  beforeAll(() => {
    assertGuardTargetAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env)
  })

  const asRole = (role: string, sql: string) => {
    try {
      return { rows: psqlRows(`BEGIN; SET LOCAL ROLE ${role}; ${sql}; ROLLBACK;`), error: '' }
    } catch (e: any) {
      return { rows: [] as string[], error: String(e?.stderr ?? e) }
    }
  }

  itLocal('anon reads the review count (static pages need it) and nothing else', () => {
    expect(asRole('anon', 'SELECT review_count FROM trustpilot_settings WHERE id = 1').rows).toEqual(['0'])
    expect(asRole('anon', 'SELECT updated_by FROM trustpilot_settings').error).toMatch(/permission denied/)
  })

  itLocal('anon and authenticated cannot change the review count', () => {
    expect(asRole('anon', 'UPDATE trustpilot_settings SET review_count = 999').error).toMatch(/permission denied/)
    expect(asRole('authenticated', 'UPDATE trustpilot_settings SET review_count = 999').error).toMatch(/permission denied/)
  })

  itLocal('the review count can never go negative', () => {
    expect(asRole('service_role', 'UPDATE trustpilot_settings SET review_count = -1').error).toMatch(/review_count_check/)
  })

  itLocal('invite stats are service-role only', () => {
    expect(asRole('anon', `SELECT * FROM trustpilot_invite_stats(now() - interval '7 days')`).error).toMatch(/permission denied/)
    expect(asRole('authenticated', `SELECT * FROM trustpilot_invite_stats(now() - interval '7 days')`).error).toMatch(/permission denied/)
    expect(asRole('service_role', `SELECT scheduled + sent + failed + skipped >= 0 FROM trustpilot_invite_stats(now() - interval '7 days')`).rows).toEqual(['t'])
  })

  itLocal('the invite status column only takes the four honest states', () => {
    const def = psqlRows(`SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conname = 'trustpilot_invitations_status_check'`)[0] ?? ''
    for (const st of ['scheduled', 'sent', 'failed', 'skipped']) expect(def).toContain(`'${st}'`)
    expect(def.match(/'[a-z]+'::text/g)).toHaveLength(4)
  })
})
