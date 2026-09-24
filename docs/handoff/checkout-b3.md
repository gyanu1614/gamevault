# Checkout B3 — buyer method fees as data — handoff (post-merge)

**Date:** 2026-09-24 · **Branch:** `feat/buyer-method-fees` (worktree `../gamevault-checkout-b3`) · **PR:** https://github.com/gyanu1614/gamevault/pull/92 · **Not merged. `supabase db push --include-all` needed** (2 migrations; see order below). With the shim, **push and deploy are now safe in either order**.

## Merge result (origin/main @ `a308f581` = PR #91 withdrawals/disputes + PR #93 post-deploy-1)
- One conflict: PR 7 also created `/admin/fees`. Its "Fees & Payouts" page stays; the buyer-fee editor (`BuyerFeesClient`) is its third section; the duplicate sidebar link is gone.
- ONE SQL rounding helper: `buyer_fee_quote` now rounds through PR 7's `fee_round_cents`; `money_round_minor` is dropped from the (unpushed) B3 migration and a guard asserts it no longer exists.
- **Real bug found by the clean gate, fixed in `5ad71526`:** the B3 migration re-created `guard_orders_protected_columns` from the PR 1 body and silently dropped PR 7's seven checks (status, delivered_at, auto_release_at, completed_at, disputed_at, release_method, confirm_reminder_sent_at) — `order-completion.guard` went RED. It is now PR 7's body verbatim + the three buyer-fee columns (30 checks).

## Commits (in order)
`1766645f` Part 1+2 tables + quote + RPC · `52242b21` Part 3 eligibleMethods · `0a23eee5` Part 4 tiles · `0ed2943a` Part 4b /fees · `414fcd9f` admin editor · `f9e8c7d5` **merge main** (admin page fold-in, fee_round_cents) · `51b04848` **zero-downtime shim** · `80f94e1d` types regen (isolated stack) · `5ad71526` **orders-guard fix** · handoff.

## Migrations — apply in this order (`supabase db push --include-all`)
1. `20260923185256_buyer_method_fees.sql` — `payment_method_fees` + `currency_rates` (+ seed, RLS read-all, service-role writes), `buyer_fee_quote` / `buyer_fee_quote_many` (service-role only), `orders.buyer_fee_pct/amount/method`, `guard_orders_protected_columns` (PR 7 body + 3), **DROPs the 21-arg `order_create_pending` and creates the 19-arg one** (`p_buyer_fee_method` in; the two processing-fee params and `p_total_amount` out).
2. `20260924051344_order_create_pending_compat_shim.sql` — **re-creates the 21-arg overload as a shim** (`-- DROP in cleanup PR`): ignores the three legacy money args, derives the method (pm_id, else provider), delegates to the 19-arg function. Old code against the new DB completes a checkout end to end with the quoted fee.
Why `--include-all`: file 1 sorts BEFORE main's already-pushed `20260924043931_withdrawal_methods_spec`; a plain `db push` skips versions older than the newest applied. Both files are idempotent.

## The shim (`src/test/guards/order-create-pending-shim.guard.integration.test.ts`)
Both overloads produce identical orders and attempts (every money column, fee snapshot, attempt provider/pm_id/amount) for crypto and a Payssion pm_id; the 21-arg path then activates + confirms to `paid` carrying the quoted fee; 42501 for anon and a buyer. Cleanup PR: drop the overload, delete the guard.

## Fee table as seeded (fee_currency · provider % + fixed · FX · buffer 1 · floor 5 · min · cap · refundable · instant · shown)
Pix USD 3.75 · FX 7.5 · min $0.35 ✓ · GCash PHP 5 + 10 · FX 3.4 ✓ · QR Ph PHP 2.5 + 15 · FX 3.4 · no refunds ✓ · Maya PHP 3.5 · cap 10,000 PHP · no refunds · **hidden** · QRIS 2.5 ✓ · SPEI 4.25 · FX 4.8 ✓ · OXXO 4.25 · FX 4.8 · **hidden** · Boleto 4.25 (placeholder, not on the sheet) · **hidden** · PSE 4.25 ✓ · WebPay 4.25 ✓ · EU rows (Trustly 2.5 + €0.35, BLIK/P24 4.75 + 0.55 zł, EPS 3.75 + €0.45 min €1, MB Way 2.75 + €0.25 min €1, BANCOMAT 2.75 + €0.20, PayU CZ 4.75 + 3.5 Kč, paysafecard 12.5 cap €250 no refunds) inert until `methods.ts` carries the pm_id · btcpay 0 / coingate 1 / wallet 0 / fake 0 — floor 5 = today's processing fee. Rates EUR 1.17, GBP 1.35, PHP 0.0176, PLN 0.274, CZK 0.0478 (approx., editable).
Formula: `gross = (subtotal + fixed) / (1 − provider − fx − buffer)`; `fee = max(floor × subtotal, gross − subtotal)`, then min; refuse over cap; rounded once via `fee_round_cents`. Pix $20 → $2.79 · GCash $20 → $2.27 · Pix $1 → $0.35 · crypto $100 → $5.00.

## Old → new copy (needs your approval)
| Surface | Old | New |
|---|---|---|
| Checkout crypto badge | "No Fees" | "+ $x.xx · n%" (the quote) |
| Checkout e-wallet empty state | "Crypto works everywhere, with no processing fees. Or pick another country above." | "Crypto works everywhere. Or pick another country above." |
| Checkout Processing-fee ⓘ | "Covers payment processing." | "Covers payment processing for the method you picked." |
| Checkout refusals (new) | — | "<Method> isn’t available for this order right now — please pick another payment method." / "This order is over the payment limit for <Method> — …" / "<Method> can’t be used for an order in this currency — …" |
| /fees Buyer fee | "…a **processing fee** of the greater of **5%** or the payment-processing cost…" | "…a **processing fee** that depends on the payment method you choose. The processing fee covers the payment provider’s charge on the full amount, currency conversion where the provider applies it, and a small buffer for rate movement; every method also has a minimum share of the item price. The exact fee for your order is quoted on every payment tile before you pay…" + "The current terms per payment method are listed below, read live from the same table checkout quotes from…" + the table |
| /admin/fees header | "Completion hold, protection windows, dispute window, withdrawal gate and payout fees. Each change writes an audit row." | "…withdrawal gate, payout fees and buyer processing fees per payment method. Each change writes an audit row." |

## Test results — fresh isolated stack `gamevault-b3` (ports 54620–54629; config.toml / .env.test edits NOT committed), `supabase db reset` from scratch (all main + B3 + shim migrations) → seed:games + PR 1/PR 4 fee seeds re-applied
| Check | Result |
|---|---|
| Full `pnpm test` (incl. integration) | **197 files passed, 1 skipped · 1747 tests passed, 2 skipped (pre-existing CoinGate live-API skips), 0 failed** |
| `buyer-fee-quote` · `buyer-method-fees` · `admin-buyer-fees` · `order-create-pending-shim` (new) | 16/16 · 13/13 · 5/5 · 4/4 |
| `fee-checkout-snapshot` (405 real checkouts) · `money-atomicity` · `db-p0-grants` · `table-posture` · `no-head-count` · `fee-copy` · `order-completion` (PR 7) · caching script | 12/12 · 18/18 · 57/57 · 10/10 · pass · 23/23 · pass · 40 routes OK |
| `tsc --noEmit` · types regenerated by `pnpm db:types` on that stack (no hand-splicing; both `order_create_pending` overloads typed as a union) | clean |

## Manual steps
1. Approve the copy table. 2. `supabase db push --include-all` (2 files); push → deploy or deploy → push, either order works. Verify: `SELECT count(*) FROM payment_method_fees;` → 23; `SELECT count(*) FROM pg_proc WHERE proname='order_create_pending';` → 2; `SELECT has_function_privilege('anon','public.buyer_fee_quote(text,bigint,text)','EXECUTE');` → false. 3. `/admin/fees` → "Buyer processing fees": confirm the seeded rows against the Payssion sheet, set measured FX markups, **set the crypto (btcpay) and wallet floor** if 5% is not the intended buyer fee for those rails, leave Maya/OXXO/Boleto hidden. 4. One real order per shown method (Pix, GCash, QR Ph, QRIS, SPEI, PSE, WebPay, crypto, wallet) before B4: tile fee == Processing-fee row == `orders.buyer_fee_amount`; Payssion settlement ≥ the quote's assumption. 5. After the old deploy is gone: cleanup PR drops the 21-arg overload + its guard. 6. `/fees` shows the table after deploy (revalidated on every admin edit).

## Deliberately left
Orders stay USD-only (EUR/GBP proven at the quote seam). `payssion_test` / `fake` rows selectable (env-gated). Boleto's rate is a placeholder. The stopped `gamevault-postdeploy` Docker stack (orphaned: its worktree is gone) was stopped, not deleted, to free VM memory for the isolated gate.
