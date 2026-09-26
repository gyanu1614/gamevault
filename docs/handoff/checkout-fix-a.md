# Checkout fix round A — handoff

**Date:** 2026-09-22 · **Branch:** `fix/checkout-p0` (worktree `../gamevault-checkout-fix-a`) · **PR:** https://github.com/gyanu1614/gamevault/pull/88 · **Not merged. ⚠️ `supabase db push` REQUIRED before/with the deploy** (5 migrations).
Source: `docs/audit/pass-6-checkout.md` (PART B). Scope = round A only (independent findings). Round B (attempts model, `voidCharge`, late-payment credit, reconciler) NOT started.

## Commits (one per ID, in order)
| ID | Commit | What |
|---|---|---|
| PAY-001 | `8027b0b0` repro (cherry-pick) + `88d69678` | `wallet_spend` takes `pg_advisory_xact_lock('wallet_spend:<user>')` before the balance guard; repro flips green (harness: session B made async so it can observe A's commit). |
| PAY-002 | `f615646c` | `order_cancel_return_wallet(uuid,text,boolean)`: automatic callers cancel from `pending` only; paid/terminal → no-op + ONE deduped admin `payment_review` alert; `p_allow_paid` (buyer) cancels paid + credits total. Old 2-arg overload dropped. |
| PAY-003/015 | `5b6308e8` | `order_confirm_payment`: CHARGE_CONFIRMED + `paid_at` + row-locked stock claim; sold out → `order_refund_to_wallet` in the same txn (`oversold_refunded`). `orders.stock_claimed_at/stock_returned_at`; trigger returns stock on undelivered cancel. `inventory_claim_for_order` paid-state guard. All CHARGE_CONFIRMED callers moved. |
| PAY-005 | `a269f5fd` | 23505 loser with no `checkout_url` → "payment is being prepared", never charges; url-less pending order < 90 s is not superseded. Order-number retry intact. |
| PAY-006 | `e2d18dc3` | `createCharge` wrapped → `cancelOrderReturnWallet(id,'charge-create-failed')`; truthful copy; 30-min fallback `payment_expires_at` at insert; sweep also closes `payment_provider IS NULL`. |
| PAY-007 | `cbbfb62e` | `checkRateLimit('checkout', user:<id>)` in the action + cap of 5 open pending orders per buyer. |
| PAY-008 | `1345ecc4` | Buyer `cancelOrder` = the RPC (`allowPaid`); TS composition deleted; comms use the amount that posted. |
| PAY-014 | `27af0f6f` | `promo_usage_record` enforces usage/per-user/active/expiry under the lock; `recordPromoUsage` returns the verdict; checkout awaits it (refusal cancels the order). |
| PAY-016 | `3a6045e0` | `AbortSignal.timeout(8000)` on every Payssion/BTCPay/CoinGate fetch; 4 s return-route probe with fall-through (`lib/payments/timeouts.ts`). |
| PAY-020 | `fe769fe5` | `paid_at` stamp fatal; `lib/security/cron-auth` (timingSafeEqual) in all 11 cron routes; webhook routes answer generic `rejected`; return labels for refunded/disputed; partial sweep index. |

## Migrations (apply in this order — `supabase db push` does all)
1. `20260922172411_pay_001_wallet_spend_lock.sql`
2. `20260922173218_pay_002_cancel_from_pending_only.sql` — DROPs the 2-arg `order_cancel_return_wallet`; TS on this branch passes 3 args. **Deploy code and push together** (old code calling 2 args still works via the default; new code against the old DB fails on `p_allow_paid`).
3. `20260922173620_pay_003_stock_claim_at_payment.sql` — new columns + `order_confirm_payment` + trigger + inventory guard. New code needs it (webhook confirms would 500 → provider retries until pushed).
4. `20260922174029_pay_020_pending_payment_sweep_index.sql`
5. `20260922174706_pay_014_promo_usage_cap.sql`

## Test results (local stack, `.env.test`; the stack is SHARED with another worktree that reset it mid-session)
| Check | Result |
|---|---|
| `pay-001-wallet-double-spend.repro` | RED on main (both spends commit, −1000) → GREEN (1 refused, balance 0) |
| `checkout-fix-a.guard.integration` (new) | 17/17 — PAY-002/003/015/008/005/006/007/014 against the real RPCs, `createCheckout`, the webhook spine, `money_fault_hook` points |
| `money-atomicity.guard.integration` | 18/18 (two supersede tests now park the fixture's raw pending order — PAY-005 guard) |
| `db-p0-grants.guard.integration` | 57/57 (`order_confirm_payment` added to the service-only list) |
| `payssion.test` / `btcpay.test` / `coingate.test` / `dispatch.test` / `cron-auth.test` / `timeouts.test` | 82/82 |
| `fee-checkout-snapshot.guard.integration` (405-checkout parity loop, 8-way) | **12/12, 405/405** after the last PAY-007 commit. Five earlier runs lost 2–6 of 405 inserts to Kong 502 "upstream prematurely closed"; the baseline code passed 405/405 on the same stack, which pinned it to the new `head: true` pending-order count — a HEAD response through Kong → PostgREST poisons the upstream keep-alive socket and the NEXT request on it (the order INSERT) dies. The count is now a bounded GET (`.select('id').limit(max)`). **Rule for the codebase: never `head: true` on a hot path.** The limiter is stubbed and the cap raised in that file (`CHECKOUT_MAX_OPEN_PENDING_ORDERS`). |
| Full `pnpm test` | 1511 passed / 11 failed → the 3 harness collisions above (all fixed after, files re-run green) + `table-posture` failing on the OTHER worktree's `fee_engine_drop_dead_tables` migration living on the shared DB (not on this branch). |
| `tsc --noEmit` | clean |

## Manual steps for Gyanu
1. `supabase db push` (5 files) **before or with** the deploy of this branch — see ordering note above. Then in the SQL editor: `SELECT proname FROM pg_proc WHERE proname IN ('order_confirm_payment');` → 1 row; `SELECT has_function_privilege('anon','public.order_confirm_payment(uuid,text)','EXECUTE');` → false.
2. First hour after deploy: `SELECT id, status, stock_claimed_at FROM orders WHERE paid_at > now() - interval '1 hour';` → paid rows carry `stock_claimed_at`. Any `payment_review` notification titled "Cancel Refused On Paid Order" = a stale cancel hit a paid order (expected to be rare; investigate the charge).
3. Watch Sentry for `order_confirm_payment failed` (migration not live) and for "sold out just before your payment" (oversold refund — real stock race, buyer already made whole).

## Left for round B (out of scope here)
- PAY-004/013/018 (attempts model, `voidCharge`, `provider_cancel_outbox`, `pm_id` persistence, unique `provider_charge_id`).
- PAY-009/010/011/012/017/019 (late-payment credit, reconciler for stuck `received` events, overpay credit, sweep poison-row counter, 402 double-mint probe, polling backoff).
- The dead-order admin alert in dispatch (`alertAdminsPaymentForClosedOrder`) is still TS-side and not deduped.
- Guard tests run against the SHARED local stack; another worktree's `supabase db reset` mid-run wipes this branch's functions (happened once during this session). Re-apply with the migration files; the fixture-cleanup purges `audit_logs` via psql (immutable trigger) on the local stack only.
