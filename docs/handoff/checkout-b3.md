# Checkout B3 — buyer method fees as data — handoff

**Date:** 2026-09-23 · **Branch:** `feat/buyer-method-fees` (worktree `../gamevault-checkout-b3`) · **PR:** https://github.com/gyanu1614/gamevault/pull/92 · **Not merged. ⚠️ `supabase db push` REQUIRED BEFORE the deploy** (1 migration; `order_create_pending` changes signature).
Source: audit pass-6 PART C §6 (`eligibleMethods`), rounds A/B (single RPC checkout, attempts model). PR 7 code (completion / dispute / withdrawal) untouched.

## Commits (one per part, in order)
| Part | Commit | What |
|---|---|---|
| 1+2 | `1766645f` | `payment_method_fees` + `currency_rates` (public-read, service-role writes), `buyer_fee_quote(method, subtotal_minor, currency)` + `_many`, `money_round_minor`; `order_create_pending` re-created: fee + total computed INSIDE from `p_buyer_fee_method`, snapshotted on `orders.buyer_fee_pct/amount/method` (guarded) and mirrored into `payment_processing_fee*`. Fails closed (`buyer_fee_quote: <reason>`) — never a TS default. |
| 3 | `52242b21` | `lib/payments/eligibility.ts` — ONE source for page + `createCheckout` (selectable, currency, cap, quote each; country only orders). `createCheckout` refuses any method the page would not show; wallet-covers-all → the `wallet` row. `lib/fees` keeps only the marketplace 2%; `methods.ts` drops `feePercent` (PAY-023). |
| 4 | `0a23eee5` | Tiles + crypto badge show `+ $1.20 · 5%`; Processing-fee row and total follow the picked method; hidden rows never reach the client; crypto tab greys out if its row is hidden. No layout change. |
| 4b | `0ed2943a` | `/fees` Buyer-fee section renders a live table from the DB (anon + `unstable_cache` under `BUYER_FEES_TAG`, ISR 24 h); `fee-copy.guard` pins: only the marketplace 2% is a literal. |
| 1 admin | `414fcd9f` | `/admin/fees` (sidebar "Buyer Fees") — `requireRole(admin/super_admin)` → service role → validate → write → `fee_config_audit` (`payment_method_fee` / `currency_rate`) → `revalidateBuyerFeeReaders()`. |

## Migration (apply in this order — one file)
`20260923185256_buyer_method_fees.sql`: tables + seed, quote functions, `orders` columns, `guard_orders_protected_columns` re-created with the 3 columns, **DROPs `order_create_pending(…21 args)` and creates the 19-arg overload** (`p_payment_processing_fee_rate`, `p_payment_processing_fee`, `p_total_amount` gone; `p_buyer_fee_method` added). Old code against the new DB → PGRST202 on every checkout; new code against the old DB likewise. **Push, then deploy** (or together).

## Fee table as seeded (`fee_currency` · provider % + fixed · FX · buffer 1 · floor 5 · min · cap · refundable · instant · shown)
Pix USD 3.75 · FX 7.5 · min $0.35 ✓ · GCash PHP 5 + 10 · FX 3.4 ✓ · QR Ph PHP 2.5 + 15 · FX 3.4 · no refunds ✓ · Maya PHP 3.5 · cap 10,000 PHP · no refunds · **hidden** · QRIS 2.5 ✓ · SPEI 4.25 · FX 4.8 ✓ · OXXO 4.25 · FX 4.8 · voucher · **hidden** · Boleto 4.25 (NOT on the sheet — placeholder) · FX 7.5 · **hidden** · PSE 4.25 ✓ · WebPay 4.25 ✓ · Trustly EUR 2.5 + €0.35 · BLIK/P24 PLN 4.75 + 0.55 zł · EPS EUR 3.75 + €0.45 min €1 · MB Way EUR 2.75 + €0.25 min €1 · BANCOMAT EUR 2.75 + €0.20 · PayU CZK 4.75 + 3.5 Kč · paysafecard EUR 12.5 · cap €250 · no refunds (all EU rows inert until `methods.ts` carries the pm_id; probe first) · btcpay 0 / coingate 1 / wallet 0 / fake 0 — floor 5 = today's processing fee (`{USD,EUR,GBP}`). Rates: EUR 1.17, GBP 1.35, PHP 0.0176, PLN 0.274, CZK 0.0478 (approx., editable).
Formula: `gross = (subtotal + fixed) / (1 − provider − fx − buffer)`; `fee = max(floor × subtotal, gross − subtotal)`, then min; refuse over cap. Worked: Pix $20 → $2.79 (13.95%); GCash $20 → $2.27; Pix $1 → $0.35; crypto $100 → $5.00.

## Old → new copy (needs your approval)
| Surface | Old | New |
|---|---|---|
| Checkout crypto badge | "No Fees" | "+ $x.xx · n%" (the quote) |
| Checkout e-wallet empty state | "Crypto works everywhere, with no processing fees. Or pick another country above." | "Crypto works everywhere. Or pick another country above." |
| Checkout Processing-fee ⓘ | "Covers payment processing." | "Covers payment processing for the method you picked." |
| Checkout refusals (new) | — | "<Method> isn’t available for this order right now — please pick another payment method." / "This order is over the payment limit for <Method> — …" / "<Method> can’t be used for an order in this currency — …" |
| /fees Buyer fee | "…a **processing fee** of the greater of **5%** or the payment-processing cost. Both are always included…" | "…a **processing fee** that depends on the payment method you choose. The processing fee covers the payment provider’s charge on the full amount, currency conversion where the provider applies it, and a small buffer for rate movement; every method also has a minimum share of the item price. The exact fee for your order is quoted on every payment tile before you pay, and both fees are always included…" + "The current terms per payment method are listed below, read live from the same table checkout quotes from. A method that is hidden or over its provider’s limit for your order is not offered." + the table |

## Test results (shared local stack, `.env.test`; another session's PR 7 migrations are on it)
| Check | Result |
|---|---|
| `buyer-fee-quote.guard.integration` (new, RED first) | 16/16 — worked examples, no_fee_row / not_selectable / currency_unsupported / fx_rate_missing / over_cap, USD/EUR/GBP, rounding, 42501 for anon+buyer, RLS writes 0 rows |
| `buyer-method-fees.guard.integration` (new, RED first) | 13/13 — parity page == eligibleMethods == snapshot for 8 selectable methods + wallet, totals to the cent, attempt = total − wallet, cap/hidden/missing-row refusals (no order, no wallet debit), `after_quote` fault, guarded columns 42501, registry invariant, static page/form check |
| `admin-buyer-fees.guard.integration` (new) · `buyer-public-rates.test` (new) | 5/5 · 5/5 |
| `fee-checkout-snapshot` (405 real checkouts) · `checkout-fix-a` · `checkout-fix-b` (GCash total now derived from the quote) · `fee-preview-parity` · `db-p0-grants` · `table-posture` · `no-head-count` · `fee-copy` · caching script | 12/12 · 17/17 · 26/26 · 7/7 · 57/57 · 9/9 · pass · 23/23 · 40 routes OK |
| Full `pnpm test` | **1675 passed, 2 skipped, 5 failed** — all 5 = `money-atomicity` DB-015c withdrawal cases hitting `withdrawal_requests_one_open_per_user`, a constraint from PR 7's migration on the shared stack (not in this branch; verified by grep). `tsc --noEmit` clean. Security review: no findings; moderator refusal added. |

## Manual steps
1. Approve the copy table. 2. `supabase db push` (this branch's one file) **before/with** the deploy; then `SELECT count(*) FROM payment_method_fees;` → 23, `SELECT has_function_privilege('anon','public.buyer_fee_quote(text,bigint,text)','EXECUTE');` → false. 3. `/admin/fees`: confirm the seeded values above match the Payssion sheet; set the FX markups you have measured; leave Maya/OXXO/Boleto hidden. 4. One real order per shown method (Pix, GCash, QR Ph, QRIS, SPEI, PSE, WebPay, crypto, wallet) before B4: the tile's fee == the Processing-fee row == `orders.buyer_fee_amount`, and Payssion's settlement ≥ what the quote assumed. 5. `/fees` shows the table after the deploy (revalidated on every admin edit).

## Deliberately left
- Orders stay USD-only; the 3-currency proof is at the quote seam (EUR/GBP accepted by crypto/wallet/EU rows only). The types file was hand-spliced to this branch's objects (a full regen on the shared stack drags in PR 7's tables). PR 7 adds `fee_round_cents`; `money_round_minor` is the same rule — unify after both merge. `payssion_test` and `fake` rows are selectable (only reachable under their env switches). No cache on the checkout quote (dynamic page, one RPC). Boleto's rate is a placeholder until the sheet names it.
