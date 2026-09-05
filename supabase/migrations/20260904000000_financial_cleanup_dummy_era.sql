-- ============================================================
-- FINANCIAL CLEANUP — dummy-era data purge + ledger write-off
-- Created: 2026-09-04
--
-- BTCPay (the first real payment rail) went live 2026-09-04. Everything
-- financial from before is sandbox/dummy data. This migration:
--
--   1. Archives every dummy-era row into a new `archive` schema (not exposed
--      via PostgREST), then deletes it from the live tables.
--   2. Posts ONE compensating ledger journal (DUMMY_ERA_WRITEOFF) that zeroes
--      every dummy-era balance. The ledger is append-only by design — history
--      is never edited; corrections are new balanced entries.
--   3. FX-converts the one real non-USD balance (gpandeyy seller_available
--      €2.79 from the Dragonfly order) to USD via fx_gain_loss, making the
--      platform single-currency USD going forward. EUR history stays intact.
--   4. Recomputes profile/listing stats (total_sales, seller_balance,
--      ratings, cashback) from the surviving real data.
--
-- REAL DATA (never touched):
--   orders 6a8a7f1e… (completed, EUR 3.21), 91342f56… (completed, USD 2.14,
--   seller "Jana's pets"/Babeboo), 34aa6f7d… + 099175f4… (cancelled btcpay
--   attempts), and all ledger rows tied to them.
--
-- The €150.00 WITHDRAWAL_REVERSED ledger txn (2026-09-04T08:01Z, order_id
-- NULL) was investigated: it is the reversal of gpandeyy's stale 2026-07-25
-- withdrawal request db741614-104b-4641-a36a-1c7d3d027385, cancelled on
-- 2026-09-04. order_id NULL is hardcoded by withdrawal_reversal() (correct —
-- withdrawals aren't order-scoped); EUR because withdrawal_debit drains EUR
-- first. HOLD + REVERSED net to zero, so the write-off below absorbs both.
--
-- Idempotent: a sentinel on the write-off journal's idempotency key makes
-- re-runs a no-op. Every step is count-asserted; any drift from the audited
-- 2026-09-04 state aborts the whole transaction untouched.
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS archive;

DO $cleanup$
DECLARE
  v_real_ids CONSTANT uuid[] := ARRAY[
    '6a8a7f1e-96ce-4d4f-a539-e6c78a43662b',  -- completed, EUR 3.21 (Dragonfly)
    '91342f56-84da-4857-9d19-b524e701a3d0',  -- completed, USD 2.14 (Jana's pets)
    '34aa6f7d-7b5b-432f-b35c-13a05b875fd4',  -- cancelled btcpay attempt
    '099175f4-9433-428f-8e65-ce789a0ddadb'   -- cancelled btcpay attempt
  ]::uuid[];
  v_gpandeyy CONSTANT uuid := '66e508c1-6131-4761-823f-4d3efdc199d7';
  v_babeboo  CONSTANT uuid := '364ad79b-767d-4e96-b28d-f58d72385814';
  -- FX: €2.79 → $3.26 at ~1.17 (owner-approved 2026-09-04; adjust before push
  -- if you want a different rate — both EUR legs stay 279).
  v_fx_eur_minor CONSTANT bigint := 279;
  v_fx_usd_minor CONSTANT bigint := 326;

  v_n bigint;
  v_conv_before bigint;
  v_msg_before bigint;
  v_entries jsonb;
BEGIN
  -- ─── 0. Sentinel: already applied? ──────────────────────────────
  IF EXISTS (SELECT 1 FROM ledger_transactions
             WHERE idempotency_key = 'cleanup:dummy_era_writeoff:20260904') THEN
    RAISE NOTICE 'financial_cleanup_dummy_era: already applied, skipping';
    RETURN;
  END IF;

  -- ─── 1. Pre-assertions (DB must match the 2026-09-04 audit) ─────
  SELECT count(*) INTO v_n FROM orders WHERE id = ANY(v_real_ids) AND payment_provider = 'btcpay';
  IF v_n <> 4 THEN RAISE EXCEPTION 'pre-assert: expected 4 real btcpay orders, found %', v_n; END IF;

  SELECT count(*) INTO v_n FROM orders WHERE id = ANY(v_real_ids) AND status = 'completed';
  IF v_n <> 2 THEN RAISE EXCEPTION 'pre-assert: expected 2 completed real orders, found %', v_n; END IF;

  SELECT count(*) INTO v_n FROM orders WHERE payment_provider IS DISTINCT FROM 'btcpay';
  IF v_n <> 93 THEN RAISE EXCEPTION 'pre-assert: expected 93 dummy orders, found % — re-audit before running', v_n; END IF;

  SELECT count(*) INTO v_n FROM orders
  WHERE payment_provider IS DISTINCT FROM 'btcpay' AND id = ANY(v_real_ids);
  IF v_n <> 0 THEN RAISE EXCEPTION 'pre-assert: a real order fell into the dummy set'; END IF;

  -- Ledger: exactly 4 real transactions (2 per completed real order), and the
  -- dummy-era set (everything NOT tied to a btcpay order) is exactly the 71
  -- audited rows, none newer than the 2026-09-04T08:02Z audit horizon.
  SELECT count(*) INTO v_n FROM ledger_transactions WHERE order_id = ANY(v_real_ids);
  IF v_n <> 4 THEN RAISE EXCEPTION 'pre-assert: expected 4 real ledger txns, found %', v_n; END IF;

  SELECT count(*) INTO v_n FROM ledger_transactions lt
  WHERE NOT (lt.order_id IS NOT NULL AND lt.order_id IN (SELECT id FROM orders WHERE payment_provider = 'btcpay'));
  IF v_n <> 71 THEN RAISE EXCEPTION 'pre-assert: expected 71 dummy-era ledger txns, found % — re-audit before running', v_n; END IF;

  SELECT count(*) INTO v_n FROM ledger_transactions lt
  WHERE NOT (lt.order_id IS NOT NULL AND lt.order_id IN (SELECT id FROM orders WHERE payment_provider = 'btcpay'))
    AND lt.created_at > TIMESTAMPTZ '2026-09-04 08:02:00+00';
  IF v_n <> 0 THEN RAISE EXCEPTION 'pre-assert: % dummy-set ledger txns newer than audit horizon — re-audit', v_n; END IF;

  -- Dependent-row counts as audited.
  SELECT count(*) INTO v_n FROM reviews r WHERE r.order_id IN (SELECT id FROM orders WHERE payment_provider IS DISTINCT FROM 'btcpay');
  IF v_n <> 40 THEN RAISE EXCEPTION 'pre-assert: expected 40 dummy reviews, found %', v_n; END IF;
  SELECT count(*) INTO v_n FROM disputes d WHERE d.transaction_id IN (SELECT id FROM orders WHERE payment_provider IS DISTINCT FROM 'btcpay');
  IF v_n <> 21 THEN RAISE EXCEPTION 'pre-assert: expected 21 dummy disputes, found %', v_n; END IF;
  SELECT count(*) INTO v_n FROM payouts p WHERE p.order_id IN (SELECT id FROM orders WHERE payment_provider IS DISTINCT FROM 'btcpay');
  IF v_n <> 10 THEN RAISE EXCEPTION 'pre-assert: expected 10 dummy payouts, found %', v_n; END IF;
  SELECT count(*) INTO v_n FROM loyalty_credits lc WHERE lc.order_id IN (SELECT id FROM orders WHERE payment_provider IS DISTINCT FROM 'btcpay');
  IF v_n <> 35 THEN RAISE EXCEPTION 'pre-assert: expected 35 dummy loyalty_credits, found %', v_n; END IF;
  SELECT count(*) INTO v_n FROM promo_code_usages pu WHERE pu.order_id IN (SELECT id FROM orders WHERE payment_provider IS DISTINCT FROM 'btcpay');
  IF v_n <> 6 THEN RAISE EXCEPTION 'pre-assert: expected 6 dummy promo_code_usages, found %', v_n; END IF;
  SELECT count(*) INTO v_n FROM reserve_holds;
  IF v_n <> 0 THEN RAISE EXCEPTION 'pre-assert: reserve_holds not empty (%)', v_n; END IF;

  SELECT count(*) INTO v_conv_before FROM conversations;
  SELECT count(*) INTO v_msg_before  FROM messages;

  -- ─── 2. Archive copies ──────────────────────────────────────────
  CREATE TABLE archive.orders_dummy AS
    SELECT * FROM public.orders WHERE payment_provider IS DISTINCT FROM 'btcpay';
  CREATE TABLE archive.reviews_dummy AS
    SELECT * FROM public.reviews WHERE order_id IN (SELECT id FROM archive.orders_dummy);
  CREATE TABLE archive.conversations_dummy AS
    SELECT * FROM public.conversations WHERE order_id IN (SELECT id FROM archive.orders_dummy);
  CREATE TABLE archive.messages_dummy AS
    SELECT * FROM public.messages WHERE conversation_id IN (SELECT id FROM archive.conversations_dummy);
  CREATE TABLE archive.trustpilot_invitations_dummy AS
    SELECT * FROM public.trustpilot_invitations WHERE order_id IN (SELECT id FROM archive.orders_dummy);
  CREATE TABLE archive.order_cancellation_requests_dummy AS
    SELECT * FROM public.order_cancellation_requests WHERE order_id IN (SELECT id FROM archive.orders_dummy);
  CREATE TABLE archive.promo_code_usages_dummy AS
    SELECT * FROM public.promo_code_usages WHERE order_id IN (SELECT id FROM archive.orders_dummy);
  CREATE TABLE archive.loyalty_credits_dummy AS
    SELECT * FROM public.loyalty_credits WHERE order_id IN (SELECT id FROM archive.orders_dummy);
  CREATE TABLE archive.payouts_dummy AS
    SELECT * FROM public.payouts WHERE order_id IN (SELECT id FROM archive.orders_dummy);
  CREATE TABLE archive.disputes_dummy AS
    SELECT * FROM public.disputes WHERE transaction_id IN (SELECT id FROM archive.orders_dummy);

  SELECT count(*) INTO v_n FROM archive.orders_dummy;
  IF v_n <> 93 THEN RAISE EXCEPTION 'archive-assert: orders_dummy=% (expected 93)', v_n; END IF;
  SELECT count(*) INTO v_n FROM archive.messages_dummy;
  IF v_n <> 348 THEN RAISE EXCEPTION 'archive-assert: messages_dummy=% (expected 348)', v_n; END IF;
  SELECT count(*) INTO v_n FROM archive.conversations_dummy;
  IF v_n <> 90 THEN RAISE EXCEPTION 'archive-assert: conversations_dummy=% (expected 90)', v_n; END IF;
  SELECT count(*) INTO v_n FROM archive.trustpilot_invitations_dummy;
  IF v_n <> 62 THEN RAISE EXCEPTION 'archive-assert: trustpilot_invitations_dummy=% (expected 62)', v_n; END IF;

  -- Legacy float tables: writes were revoked at the ledger cutover; the app
  -- stops reading them in the same deploy. Move wholesale (history preserved,
  -- incl. the fake $278.76 row) out of the API-exposed schema.
  ALTER TABLE public.wallet_balances     SET SCHEMA archive;
  ALTER TABLE public.wallet_transactions SET SCHEMA archive;

  -- ─── 3. Ledger write-off journal ────────────────────────────────
  -- Net every dummy-era entry per (account, currency), invert, and post one
  -- compensating journal. The union of balanced journals is balanced, and
  -- omitted net-zero accounts (e.g. the €150 withdrawal hold+reversal pair)
  -- contribute nothing — so this journal is balanced per currency by
  -- construction and post_journal re-verifies it anyway.
  SELECT jsonb_agg(jsonb_build_object(
           'owner_type',   nets.owner_type,
           'owner_id',     nets.owner_id,
           'kind',         nets.kind,
           'direction',    CASE WHEN nets.net > 0 THEN 'debit' ELSE 'credit' END,
           'amount_minor', abs(nets.net),
           'currency',     nets.currency))
    INTO v_entries
  FROM (
    SELECT la.owner_type::text AS owner_type, la.owner_id, la.kind::text AS kind, le.currency,
           SUM(CASE WHEN le.direction = 'credit' THEN le.amount_minor ELSE -le.amount_minor END)::bigint AS net
    FROM ledger_entries le
    JOIN ledger_accounts la ON la.id = le.account_id
    JOIN ledger_transactions lt ON lt.id = le.transaction_id
    WHERE NOT (lt.order_id IS NOT NULL AND lt.order_id IN (SELECT id FROM orders WHERE payment_provider = 'btcpay'))
    GROUP BY 1, 2, 3, 4
    HAVING SUM(CASE WHEN le.direction = 'credit' THEN le.amount_minor ELSE -le.amount_minor END) <> 0
  ) nets;

  IF v_entries IS NULL OR jsonb_array_length(v_entries) < 2 THEN
    RAISE EXCEPTION 'write-off: unexpected empty entry set';
  END IF;

  PERFORM post_journal(
    'cleanup:dummy_era_writeoff:20260904',
    v_entries,
    'DUMMY_ERA_WRITEOFF',
    NULL
  );

  -- After write-off, only real-order money remains.
  IF ledger_balance('seller', v_gpandeyy, 'seller_available', 'EUR') <> v_fx_eur_minor THEN
    RAISE EXCEPTION 'post-writeoff: gpandeyy seller_available EUR=% (expected %)',
      ledger_balance('seller', v_gpandeyy, 'seller_available', 'EUR'), v_fx_eur_minor;
  END IF;
  IF ledger_balance('seller', v_babeboo, 'seller_available', 'USD') <> 190 THEN
    RAISE EXCEPTION 'post-writeoff: Babeboo seller_available USD=% (expected 190)',
      ledger_balance('seller', v_babeboo, 'seller_available', 'USD');
  END IF;

  -- ─── 4. FX conversion €2.79 → $3.26 (gpandeyy, owner-approved) ──
  PERFORM post_journal(
    'cleanup:fx_convert_gpandeyy_eur_usd:20260904',
    jsonb_build_array(
      jsonb_build_object('owner_type','seller',  'owner_id', v_gpandeyy, 'kind','seller_available','direction','debit', 'amount_minor', v_fx_eur_minor, 'currency','EUR'),
      jsonb_build_object('owner_type','platform','owner_id', NULL::uuid, 'kind','fx_gain_loss',    'direction','credit','amount_minor', v_fx_eur_minor, 'currency','EUR'),
      jsonb_build_object('owner_type','platform','owner_id', NULL::uuid, 'kind','fx_gain_loss',    'direction','debit', 'amount_minor', v_fx_usd_minor, 'currency','USD'),
      jsonb_build_object('owner_type','seller',  'owner_id', v_gpandeyy, 'kind','seller_available','direction','credit','amount_minor', v_fx_usd_minor, 'currency','USD')
    ),
    'FX_CONVERT_EUR_USD',
    NULL
  );

  -- ─── 5. Deletes (archive copies exist; count-asserted) ──────────
  -- The live update_seller_rating trigger is stale (a real 5★ review never
  -- updated Babeboo's stats), so don't let it fire 40 times on the cascade —
  -- stats are recomputed explicitly in step 6.
  ALTER TABLE public.reviews DISABLE TRIGGER USER;

  DELETE FROM disputes WHERE transaction_id IN (SELECT id FROM archive.orders_dummy);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 21 THEN RAISE EXCEPTION 'delete-assert: disputes=% (expected 21)', v_n; END IF;

  DELETE FROM payouts WHERE order_id IN (SELECT id FROM archive.orders_dummy);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 10 THEN RAISE EXCEPTION 'delete-assert: payouts=% (expected 10)', v_n; END IF;

  DELETE FROM loyalty_credits WHERE order_id IN (SELECT id FROM archive.orders_dummy);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 35 THEN RAISE EXCEPTION 'delete-assert: loyalty_credits=% (expected 35)', v_n; END IF;

  DELETE FROM promo_code_usages WHERE order_id IN (SELECT id FROM archive.orders_dummy);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 6 THEN RAISE EXCEPTION 'delete-assert: promo_code_usages=% (expected 6)', v_n; END IF;

  -- Cascades: reviews, conversations(+messages), order_cancellation_requests,
  -- trustpilot_invitations. No AFTER DELETE triggers exist on orders; the
  -- ledger has no FK to orders (dangling order_ids there are by design).
  DELETE FROM orders WHERE payment_provider IS DISTINCT FROM 'btcpay';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 93 THEN RAISE EXCEPTION 'delete-assert: orders=% (expected 93)', v_n; END IF;

  ALTER TABLE public.reviews ENABLE TRIGGER USER;

  -- Live-site safe: new btcpay orders (and their reviews) may exist by now,
  -- so assert "no dummy remnants + the known real review survives", not totals.
  SELECT count(*) INTO v_n FROM reviews WHERE order_id IN (SELECT id FROM archive.orders_dummy);
  IF v_n <> 0 THEN RAISE EXCEPTION 'cascade-assert: % reviews still reference archived orders', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM reviews WHERE order_id = '91342f56-84da-4857-9d19-b524e701a3d0') THEN
    RAISE EXCEPTION 'cascade-assert: the real 5-star review for Jana''s pets is missing'; END IF;
  SELECT count(*) INTO v_n FROM conversations;
  IF v_n <> v_conv_before - 90 THEN RAISE EXCEPTION 'cascade-assert: conversations=% (expected %)', v_n, v_conv_before - 90; END IF;
  SELECT count(*) INTO v_n FROM messages;
  IF v_n <> v_msg_before - 348 THEN RAISE EXCEPTION 'cascade-assert: messages=% (expected %)', v_n, v_msg_before - 348; END IF;

  -- ─── 6. Recompute stats from real data ──────────────────────────
  -- Zero every seller/cashback counter, then rebuild from surviving rows.
  UPDATE profiles SET
    total_sales = 0, seller_balance = 0, pending_balance = 0, lifetime_earnings = 0,
    seller_rating = 0, total_reviews = 0, positive_reviews = 0,
    loyalty_balance = 0, lifetime_cashback_earned = 0
  WHERE COALESCE(total_sales,0) <> 0 OR COALESCE(seller_balance,0) <> 0
     OR COALESCE(pending_balance,0) <> 0 OR COALESCE(lifetime_earnings,0) <> 0
     OR COALESCE(seller_rating,0) <> 0 OR COALESCE(total_reviews,0) <> 0
     OR COALESCE(positive_reviews,0) <> 0 OR COALESCE(loyalty_balance,0) <> 0
     OR COALESCE(lifetime_cashback_earned,0) <> 0;

  UPDATE profiles p SET total_sales = s.c
  FROM (SELECT seller_id, count(*) AS c FROM orders WHERE status = 'completed' GROUP BY 1) s
  WHERE p.id = s.seller_id;

  -- seller_balance / lifetime_earnings from the ledger. Everything nonzero is
  -- USD after the FX journal (asserted below), so a flat sum is currency-safe.
  -- lifetime_earnings = released proceeds ever; equal to the balance today
  -- because no withdrawal has ever completed.
  UPDATE profiles p SET seller_balance = b.major, lifetime_earnings = b.major
  FROM (
    SELECT la.owner_id,
           SUM(CASE WHEN le.direction = 'credit' THEN le.amount_minor ELSE -le.amount_minor END) / 100.0 AS major
    FROM ledger_entries le
    JOIN ledger_accounts la ON la.id = le.account_id
    WHERE la.owner_type = 'seller' AND la.kind = 'seller_available'
    GROUP BY 1
    HAVING SUM(CASE WHEN le.direction = 'credit' THEN le.amount_minor ELSE -le.amount_minor END) <> 0
  ) b
  WHERE p.id = b.owner_id;

  UPDATE profiles p SET
    seller_rating    = r.avg_r,
    total_reviews    = r.cnt,
    positive_reviews = r.pos
  FROM (
    SELECT seller_id, ROUND(AVG(rating)::numeric, 1) AS avg_r, COUNT(*) AS cnt,
           COUNT(*) FILTER (WHERE rating >= 4) AS pos
    FROM reviews WHERE is_visible = true GROUP BY 1
  ) r
  WHERE p.id = r.seller_id;

  -- Cashback: only 'earned' credits exist; nothing has ever been spent, so
  -- balance = lifetime earned.
  UPDATE profiles p SET loyalty_balance = l.amt, lifetime_cashback_earned = l.amt
  FROM (SELECT user_id, SUM(amount) AS amt FROM loyalty_credits WHERE type = 'earned' GROUP BY 1) l
  WHERE p.id = l.user_id;

  UPDATE listings SET sales = 0 WHERE COALESCE(sales,0) <> 0;
  UPDATE listings l SET sales = s.c
  FROM (SELECT listing_id, count(*) AS c FROM orders WHERE status = 'completed' AND listing_id IS NOT NULL GROUP BY 1) s
  WHERE l.id = s.listing_id;

  -- ─── 7. Post-assertions ─────────────────────────────────────────
  -- Live-site safe: these are INVARIANTS, not snapshot totals — new btcpay
  -- orders created/paid between the audit and this push (e.g. pay-page tests)
  -- must not abort the cleanup. (v1 asserted orders=4 and tripped on exactly
  -- that: two fresh btcpay test orders.)

  -- (a) The write-off exactly cancels the dummy era: over the dummy-era
  -- transactions PLUS the write-off journal (everything not tied to a btcpay
  -- order, minus the FX journal, which intentionally moves real money), every
  -- account must net to zero, per currency.
  SELECT COALESCE(SUM(ABS(net)), 0) INTO v_n FROM (
    SELECT le.account_id, le.currency,
           SUM(CASE WHEN le.direction = 'credit' THEN le.amount_minor ELSE -le.amount_minor END) AS net
    FROM ledger_entries le
    WHERE le.transaction_id IN (
      SELECT lt.id FROM ledger_transactions lt
      WHERE NOT (lt.order_id IS NOT NULL AND lt.order_id IN (SELECT id FROM orders WHERE payment_provider = 'btcpay'))
        AND lt.idempotency_key <> 'cleanup:fx_convert_gpandeyy_eur_usd:20260904'
    )
    GROUP BY le.account_id, le.currency
  ) x;
  IF v_n <> 0 THEN RAISE EXCEPTION 'post-assert: dummy era + write-off do not net to zero (residual % minor units)', v_n; END IF;

  -- (b) FX landed: no EUR seller_available anywhere (platform is USD-only;
  -- nothing can legitimately create EUR after the currency switch).
  SELECT COALESCE(SUM(ABS(bal)), 0) INTO v_n FROM (
    SELECT la.id, SUM(CASE WHEN le.direction = 'credit' THEN le.amount_minor ELSE -le.amount_minor END) AS bal
    FROM ledger_entries le JOIN ledger_accounts la ON la.id = le.account_id
    WHERE la.kind = 'seller_available' AND le.currency <> 'USD'
    GROUP BY la.id
  ) x;
  IF v_n <> 0 THEN RAISE EXCEPTION 'post-assert: non-USD seller_available remains (%)', v_n; END IF;

  -- (c) No dummy rows survive anywhere; the real orders survive.
  SELECT count(*) INTO v_n FROM orders WHERE payment_provider IS DISTINCT FROM 'btcpay';
  IF v_n <> 0 THEN RAISE EXCEPTION 'post-assert: % non-btcpay orders remain', v_n; END IF;
  SELECT count(*) INTO v_n FROM orders WHERE id = ANY(v_real_ids);
  IF v_n <> 4 THEN RAISE EXCEPTION 'post-assert: a real order went missing (found % of 4)', v_n; END IF;
  SELECT count(*) INTO v_n FROM disputes WHERE transaction_id IN (SELECT id FROM archive.orders_dummy);
  IF v_n <> 0 THEN RAISE EXCEPTION 'post-assert: % dummy-linked disputes remain', v_n; END IF;
  SELECT count(*) INTO v_n FROM loyalty_credits WHERE order_id IN (SELECT id FROM archive.orders_dummy);
  IF v_n <> 0 THEN RAISE EXCEPTION 'post-assert: % dummy-linked loyalty_credits remain', v_n; END IF;

  RAISE NOTICE 'financial_cleanup_dummy_era: DONE. Removed: 93 dummy orders, 40 reviews, 90 conversations, 348 messages, 62 trustpilot invites, 21 disputes, 10 payouts, 35 loyalty_credits, 6 promo_usages (all copied to the archive schema first); wallet_balances/wallet_transactions -> archive; ledger +2 txns (DUMMY_ERA_WRITEOFF, FX_CONVERT_EUR_USD). btcpay orders (however many exist by now) untouched.';
  RAISE NOTICE 'balances now: gpandeyy seller_available $%, Babeboo (Jana''s pets) $%, escrow_held USD % minor (nonzero only if a new order is mid-flight)',
    to_char(ledger_balance('seller', v_gpandeyy, 'seller_available', 'USD') / 100.0, 'FM990.00'),
    to_char(ledger_balance('seller', v_babeboo,  'seller_available', 'USD') / 100.0, 'FM990.00'),
    ledger_balance('platform', NULL, 'escrow_held', 'USD');
END
$cleanup$;

COMMIT;
