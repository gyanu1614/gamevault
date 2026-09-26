# Checkout fix round B — handoff

**Date:** 2026-09-23 · **Branch:** `fix/checkout-round-b` (worktree `../gamevault-checkout-fix-b`) · **PR:** https://github.com/gyanu1614/gamevault/pull/90 · **Not merged. ⚠️ `supabase db push` REQUIRED BEFORE the deploy** (5 migrations; three RPC signatures change).
Source: `docs/audit/pass-6-checkout.md` PART B/C, the structural findings left by round A (`checkout-fix-a.md`). Money = single SQL RPCs; new SQL is service-role-only + listed in `db-p0-grants`.

## Commits (one per part, in order)
| Part | Commit | What |
|---|---|---|
| 0 | `cdacb3ed` | `fee-preview-parity` was RED on main (PR #87 × PR #88: the one-buyer matrix hit the new 5-open-orders cap) — cap raised + limiter stubbed like the 405-loop. |
| 0 | `bda47503` | **Real bug in PR #89:** `sab_refresh_price_display_changed()` never ran (`brainrot_slug` OUT column shadowed the INSERT's columns → "ambiguous"). Fixed in `20260923023413` + the first integration test that drives it (exact slugs: appear / no-move / one moved / disappear). |
| 0 | `314ac991` | No `head: true` anywhere in src/: AST codemod over 106 sites → `{ count: 'exact' }.limit(1)`; guard `no-head-count.guard.test.ts` with an EMPTY allow-list. |
| 1 | `0fba66f0` | `payment_attempts` (one OPEN attempt per order, one charge id per provider — DB constraints; pm_id, amounts snapshot, history kept). Checkout = ONE RPC `order_create_pending` (order + promo + wallet hold + attempt). `order_confirm_payment` / `order_cancel_return_wallet` bind the (provider, charge id) to the order; a failure on a superseded attempt is a no-op. Backfill idempotent. Every checkout/webhook/return/pay-page/sweep path reads the attempt; the order's 4 charge columns are a write-through mirror. |
| 2 | `5069ad0d` | `voidCharge()` on BTCPay (mark Invalid + archive), Payssion (cancel), CoinGate (no cancel API → `unsupported`, expires itself), fake. `provider_cancel_outbox` written IN the money transaction (cancel-as-void, supersede, orphaned late activation); drain = inline after the RPC + `/api/cron/reconcile-payments` every 15 min (GitHub Actions, **never vercel.json**); backoff 1m→17h, 6 attempts, ONE admin alert (`admin_alert_once`). Sweep voids first for every provider. |
| 3 | `543a5042` | `order_credit_late_payment`: late / duplicate / over-payment → buyer wallet (provider_float → user_wallet), idempotent on reason:provider:charge:event, recorded on the attempt, buyer notified once, admins once, order NEVER re-opened; webhook answers 200. `CHARGE_CONFIRMED.paid` from Payssion `paid` and BTCPay PaidOver (Σ totalPaid×rate). |
| 4 | `6e6bcd3c` | Reconciler: events stored on the claim; `received` > 15 min re-run via the same dispatch; unreplayable rows → failed (provider retry re-claims); poison cap 5 + one alert. Mark failure → 500. Sweep poison counter (`sweep_failures`, cap 5, excluded + alerted). Payssion 402 double-mint probe. Pay-page polling backoff + countdowns stop at zero. |
| 5 | `35f2b011` | `alertAdminsPaymentForClosedOrder` deleted; all admin pages are `admin_alert_once` in SQL (pinned by static tests). |

## Migrations (apply in this order — `supabase db push` does all)
1. `20260923023413_sab_refresh_price_display_changed_fix_ambiguous.sql` — one function, no schema change; the edge function's changed-slugs call 500s until this lands.
2. `20260923024324_pay_attempts_model.sql` — table + backfill (runs once inside the migration, logs the count) + RPCs. **DROPs `order_confirm_payment(uuid,text)` and `order_cancel_return_wallet(uuid,text,boolean)`.**
3. `20260923030139_pay_provider_cancel_outbox.sql` — outbox + `admin_alert_once`; re-creates cancel/supersede/activate.
4. `20260923031025_pay_late_payment_credit.sql` — credit RPC; re-creates `order_confirm_payment` (7 args).
5. `20260923031642_pay_reconciler_stuck_events.sql` — `webhook_events.events` etc.; **DROPs `webhook_event_claim(text,text,text)`**; sweep counter.
Old code against the new DB works (every added param has a DEFAULT). New code against the old DB fails closed (webhook claim/confirm 500 → providers retry until pushed). So: **push, then deploy.**

## Test results
Gate run (2026-09-23 03:19–03:23 PDT): `supabase db reset` from scratch (all 13 pending migrations incl. the 5 new ones apply in order) → `pnpm seed:games --env=local` + `20260921201844` + `20260922001513` re-applied (233 games / 405 pairs / 41 rules) → `tsc --noEmit` clean → **full `pnpm test`: 183 files passed, 1 skipped (coingate live-API, pre-existing) · 1640 tests passed, 2 skipped, 0 failed.**
| Check | Result |
|---|---|
| `checkout-fix-b.guard.integration` (new, RED first per part) | 26/26 — Part 1 ×10 (constraints, one-RPC checkout + wallet + pm_id, in-RPC fault rollback, idempotent backfill, retry history, mis-bound charge refused, stale attempt no-op, sweep, pay-page parity) · Part 2 ×7 (outbox in the txn / none on provider failure, cron drain, round A's 3 orphan paths, orphaned activation, backoff + one alert, paid never voided, fault rollback, sweep void-first) · Part 3 ×5 · Part 4 ×4 |
| `checkout-fix-a.guard.integration` / `money-atomicity` / `db-p0-grants` / `table-posture` | 17/17 · 18/18 · 57/57 (12 new service-only functions listed) · 9/9 |
| `fee-checkout-snapshot` (405 real checkouts through the new `order_create_pending`) | 12/12, 405/405 — no Kong 502 |
| Adapter units (btcpay / coingate / payssion / fake) incl. voidCharge, PaidOver, 402 probe | 26 · 21 · 42 · 11 |
| `no-head-count.guard` (empty allow-list) · `sab-refresh-display-changed.integration` (new) · serde · router mark-failure · poll-policy · cron parity/cadence | all green |
| First full run on main before any fix (Part 0) | 1571 passed / 4 failed: 3 = `fee-preview-parity` (real, fixed in `cdacb3ed`), 1 = `money-atomicity` promo insert Kong 502 (harness flake, passes alone; the `head: true` purge is the cure) |

## Manual steps for Gyanu
1. `supabase db push` (5 files) **before** merging/deploying. Then in the SQL editor: `SELECT count(*) FROM payment_attempts;` (≈ orders with a charge id — the backfill NOTICE printed the number) and `SELECT has_function_privilege('anon','public.order_create_pending(uuid,uuid,uuid,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,jsonb,text,uuid,numeric,bigint,text,text,timestamptz)','EXECUTE');` → false.
2. GitHub Actions: the new workflow `.github/workflows/reconcile-payments.yml` arrives with the merge and uses the existing `CRON_SECRET` secret — no new secret. After the merge, open Actions → "Reconcile Payments" → Run workflow once and check the JSON shows `outbox` and `stuck` blocks.
3. First hour: `SELECT status, count(*) FROM payment_attempts GROUP BY 1;` (pending orders ⇔ `active`/`created`); `SELECT status, count(*) FROM provider_cancel_outbox GROUP BY 1;` (`failed` = a provider refused 6 times — one `payment_review` note "Provider Cancel Failed" names it); `SELECT count(*) FROM webhook_events WHERE status='received' AND received_at < now()-interval '30 min';` → 0 after the first reconcile run; `SELECT order_id, credited_minor, credit_reason FROM payment_attempts WHERE credited_minor > 0;` = money that went to a buyer wallet automatically (each has a "Late Payment Credited" note).
4. Watch Sentry for `order_create_pending failed`, `payment_attempt_activate failed` and `Webhook Event Poisoned` notifications.

## Deliberately left / known limits
- CoinGate has no cancel for a standard order: `voidCharge` records `unsupported`; the invoice expires on its own (2 h / 20 min) and a late payment is credited by Part 3. CoinGate reports no paid figure, so no overpayment credit there.
- BTCPay overpayment excess needs a usable `rate` on every paid method; without one the confirmation stands and no excess is credited (logged).
- `webhook_events` rows already `received` before this deploy carry no stored events: the reconciler flips them to `failed` so the provider retry re-runs them; it cannot replay them itself.
- The sweep's poison counter lives on the attempt; a pending order with no attempt (charge never created) has nothing to count and is just retried.
- The order's 4 charge columns stay as a mirror (display surfaces read them); dropping them is a later Phase B.
- Shared local stack: another session applied `20260923025457_order_completion_release` (not in this branch) mid-run — its table `order_completion_windows` is anon-readable and fails `table-posture`; not this branch's, but that migration needs `revoke all … from anon, authenticated` before it ships. My final `supabase db reset` removed it from the local stack.
