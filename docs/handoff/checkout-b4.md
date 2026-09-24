# Checkout B4 — EU Payssion methods — handoff

**Date:** 2026-09-24 · **Branch:** `feat/eu-payment-methods` (worktree `../gamevault-checkout-b4`, own stack slot 10) · **PR:** __PR_URL__ · **Not merged. `supabase db push --include-all` needed** (1 new migration + B3's 2 if still unpushed).
Probe record: `docs/payments/eu-methods-probe.md`. Registry ⇒ probe invariant is now executable (`eu-methods.test.ts` ← `probe-fixtures.ts`).

## Part 1 — probe (control bancontact_be 200 first; every minted probe cancelled in-run)
| pm_id | Result | Wired? |
|---|---|---|
| trustly · blik_pl · p24_pl · bancomatpay_it · payu_cz | 200 in USD (also EUR / PLN / CZK) | **yes** |
| eps_at · mbway_pt | 417 at $0.90 "must be more than 1.00 EUR" (Payssion converts at its own rate); 200 at $2.00 | **yes**, with the new minimum guard |
| paysafecard | 200 at $0.90 AND at $320 — the €250 cap is ours; the 2026-09-08 491 has cleared | **yes** (`refundable=false` → wallet credit only) |
| bancomat_it (B3 seed key) | 405 "pm_id not found" | no — fee row renamed to `bancomatpay_it` |
| skrill · payu_pl · multibanco_pt | never probed | never (owner rule; pinned by test) |

**Key finding:** every method takes a **USD** charge and returns a checkout URL; Payssion converts on its page. No local-currency charging, no charge-currency/rate snapshot, no `currency_rates` conversion at checkout — that branch of the brief was not needed and was not built. Orders/attempts/charges stay USD like Pix/GCash.

## Part 2 — wiring
- `methods.ts`: 8 entries (labels, countries, expiry: paysafecard voucher 48 h, rest instant 1 h). Trustly's list = its published European bank coverage (Payssion publishes none); paysafecard's = the account manager's list. Lists only pin the buyer's local rails — they never hide a method.
- Migration `20260924070515_eu_payment_methods.sql` (idempotent): `payment_method_fees.min_total_minor` (provider minimum charge, fee currency); eps_at / mbway_pt `min_fee_minor 100 → 0` (B3 misread "€1 min" as a minimum FEE) + `min_total_minor 100`; `bancomat_it → bancomatpay_it`; `buyer_fee_quote` gains refusal `under_min` (subtotal + fee < min × 1.05 headroom); `order_create_pending` (19-arg) re-checks the **actual** charge after promo and wallet and raises `buyer_fee_quote: under_min` — whole transaction rolls back (fault hook `after_min_check`). **No signature changes → no new shim**; the B3 21-arg shim delegates unchanged. `buyer_method_fees_version() = 2`.
- Adapter unchanged (USD path). A 417 that still reaches `createCharge` (rates drift past the headroom) is cancelled + wallet returned by the existing PAY-006 path and the buyer sees the minimum message (`checkout.ts`).
- Webhook / return / reconcile / void: identical to existing Payssion methods (same pm_id-keyed attempt, same USD amounts). No app code calls a provider `refund()` — refunds are wallet credits for every method; `refundable=false` only changes what /fees and the tile promise.

## Part 3 — eligibility + UI
`eligibleMethods()` is registry-driven: the 8 rows arrive automatically with country, currency, cap and (new) minimum handled by the quote; tiles show the quoted fee (unchanged mechanism). `CheckoutForm` `METHOD_UI`: one icon + points line per method (no layout change). Admin `/admin/fees` editor + `/fees` public table read the new column ("orders from €1.00").

## Part 4 — copy (needs your approval)
| Surface | Old | New |
|---|---|---|
| Homepage WhyCard | "Some of the lowest seller fees in the market — sellers keep more of every sale, so listings start cheaper here and stay cheaper." | "Lowest fees for buyers and sellers — sellers keep more of every sale, buyers see every fee before they pay, so listings start cheaper here and stay cheaper." |
| Mobile strip (×2) | "Lowest seller fees — sellers keep more, so listings cost less." | "Lowest fees for buyers and sellers — every fee shown before you pay." |
| /browse FAQ (new Q) | — | "What does it cost to buy?" → "Lowest fees for buyers and sellers: the price you see at checkout is the price you pay. A small marketplace fee keeps SafeDrop Buyer Protection on every order, and the processing fee for the payment method you pick is quoted on its tile before you pay — the current terms are on our Fees page." |
| Category meta (×3) | "…with low seller fees" / "…: low seller fees, fast delivery…" | "…with the lowest fees for buyers and sellers" / "…: the lowest fees for buyers and sellers, fast delivery…" |
| /fees Withdrawals | "**Crypto payouts (USDT):** 3% + $5…" | "**Crypto payouts (USDT, USDC, BTC, ETH):** 3% + $5…" |
| Checkout refusal (new reason) | — | "This order is under the minimum amount for <Method> — please pick another payment method." |
| Checkout, provider 417 (new) | — | "This order is under the minimum amount for that payment method — nothing was charged, and any wallet credit you applied is back in your wallet. Please pick another payment method." |
| Checkout tiles (new) | — | Trustly "Log in to your bank on the Trustly page" · BLIK "Enter the 6-digit code from your bank app" · P24 "Pick your bank on the Przelewy24 page" · EPS "Approve in your bank portal" · MB Way / BANCOMAT Pay "Approve the payment in the … app" · PayU "Pick your bank on the PayU page" · paysafecard "Enter your paysafecard PIN · Valid 48 hours · Refunds go to your DropMarket wallet" (+ "Payment confirms instantly" on the instant rails) |
| /fees table (new clause) | — | "orders from €1.00" on EPS / MB Way |
All pinned by `fee-copy.guard` (buyer line present + number-free on the 4 surfaces; payout list).

## Test results — fresh isolated stack (`pnpm test:full`: reset → seed → whole suite)
| Check | Result |
|---|---|
| **Full `pnpm test:full`** (reset → 233 games / 405 pairs / 41 rules → whole suite, 2026-09-24 07:2x UTC) | **201 files passed, 1 skipped · 1790 tests passed, 2 skipped (pre-existing CoinGate live-API skips), 0 failed** |
| `eu-methods.test` (new, unit: registry ⇒ recorded probe 200, per-method createCharge on the recorded answer, 417 fixture, never-wire list, region filter) · `payssion.test` (routing/expiry updated) | 14/14 · all green (56 across the payssion dir) |
| `eu-payment-methods.guard.integration` (new: fee-row keys, eligibility + snapshot parity ×8, under_min at the quote AND on the actual charge with wallet credit, fault at `after_min_check`, wallet-only refunds) | 7/7 |
| `buyer-method-fees` (parity loop now covers 18 methods) · `buyer-fee-quote` · `admin-buyer-fees` · `order-create-pending-shim` · `money-atomicity` · `db-p0-grants` · `table-posture` (targeted run) | 128/128 across the 8 files (13 · 16 · 5 · 4 · 18 · 57 · 10 + the new 7) |
| `fee-checkout-snapshot` (405/405) · `no-head-count` · `fee-copy` (+ buyer-line pin) · `checkout-fix-b` · caching script | all green inside the full run (0 failures) |
| `tsc --noEmit` · `database.ts` regenerated from THIS stack (`gen types --db-url`; see step 5) | clean · +3 lines (`min_total_minor`) |
| Security review of the diff (grants, definer search_path, no dynamic SQL, under_min enforced on both sides of the seam, no secrets in client-shipped files) | no findings |

## Manual steps for Gyanu
1. Approve the copy table. 2. `supabase db push --include-all` (this file sorts after B3's two; all three idempotent). Verify: `SELECT method, min_fee_minor, min_total_minor FROM payment_method_fees WHERE method IN ('eps_at','mbway_pt','bancomatpay_it','bancomat_it');` → 0/100, 0/100, bancomatpay_it present, bancomat_it absent; `SELECT buyer_method_fees_version();` → 2. Push before or after deploy — either order works (no signature change; old code shows the generic refusal for `under_min`; the admin editor needs the column so push first if you open /admin/fees in between).
3. Payssion dashboard: nothing to flip — all eight answered 200 on the live app. Leave the notify URL as is.
4. One real order per wired method, smallest sensible amount, from a matching `?country=XX` on the checkout URL: tile fee == Processing-fee row == `orders.buyer_fee_amount`; the Payssion page shows the **local amount** (EUR/PLN/CZK) for a USD charge — note the rate it used against `currency_rates`; EPS / MB Way: also try a $0.50 listing and confirm the tile is hidden. paysafecard: confirm the tile's "Refunds go to your DropMarket wallet". Settlement ≥ the quote's assumption (FX markup for these rows is 0 — set it from what Payssion actually converts at).
5. `pnpm db:types` in a worktree targets the wrong Docker stack when several run (regenerated here with `supabase gen types --db-url <this stack>`); worth a script fix.

## Deliberately left
Local-currency charging (not needed — see Part 1). bancontact_be stays unwired (not in the brief; fee row not seeded). Legacy ten methods' probe fixtures cite `docs/checkout.md` (their 2026-09-08 raw answers were never archived) — re-probe and record when the account changes. FX markup for the EU rows stays 0 until measured on real orders. Trustly country list is Trustly's public coverage, not a Payssion-confirmed list.
