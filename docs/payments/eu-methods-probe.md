# Payssion EU methods — enable probe (checkout B4)

**Date:** 2026-09-24 (07:0x UTC) · **App:** production Payssion account (live keys from `~/gamevault/.env.local`) · **Tool:** `payssion-probe.mjs` (session scratchpad; rebuilt from `docs/checkout.md` §8 — docs 6-field signature, `POST /api/v1/payment/create`, then `POST /api/v1/payment/cancel`). Every probe below created a real pending transaction and cancelled it in the same run (`state: cancelled`, result_code 200 on cancel). No money moved.

Control first: **bancontact_be** (known-good, not wired) — 200, USD accepted, redirect returned, cancel OK. Same shape as every passing method below.

## Results

| pm_id | Probe | result_code | Currency / conversion | Min | Cap | Refunds (rate sheet) | Verdict |
|---|---|---|---|---|---|---|---|
| bancontact_be (control) | USD 0.90 | **200** `A924330388794071` | USD accepted | — | — | yes | control passes; stays unwired (not in scope) |
| trustly | USD 0.90 · EUR 0.90 | **200** `A924331177608005` · **200** `A924332530524378` | USD and EUR both accepted | none hit at $0.90 | none | yes | **WIRE** |
| blik_pl | USD 0.90 · PLN 4.00 | **200** `A924331231397665` · **200** `A924332547374151` | USD and PLN both accepted | none hit at $0.90 | none | yes | **WIRE** |
| p24_pl | USD 0.90 | **200** `A924331261445910` | USD accepted | none hit at $0.90 | none | yes | **WIRE** |
| eps_at | USD 0.90 → **417** "The amount of eps must be more than 1.00 EUR. You were trying to pay 0.90 USD(0.81 EUR)." · USD 2.00 → **200** `A924332480053295` | USD accepted (Payssion converts at its own rate: 0.90 USD = 0.81 EUR) | **€1.00 minimum charge** | none | yes | **WIRE** with a min-amount guard |
| mbway_pt | USD 0.90 → **417** "The amount of MB Way must be more than 1.00 EUR…" · USD 2.00 → **200** `A924332498531945` | USD accepted (same conversion) | **€1.00 minimum charge** | none | yes | **WIRE** with a min-amount guard |
| bancomatpay_it | USD 0.90 | **200** `A924331321474827` | USD accepted | none hit | none | yes | **WIRE** (this is the real pm_id) |
| bancomat_it (B3 seed key) | USD 0.90 | **405** "bancomat_it pm_id not found" | — | — | — | — | not a pm_id — the fee row is renamed to `bancomatpay_it` in this PR's migration |
| payu_cz | USD 0.90 · CZK 25.00 | **200** `A924331339458202` · **200** `A924332816311707` | USD and CZK both accepted | none hit at $0.90 | none | yes | **WIRE** |
| paysafecard | USD 0.90 · USD 320.00 | **200** `A924331506425170` · **200** `A924332837453275` | USD accepted | none hit | **not enforced by Payssion** at create ($320 ≈ €288 accepted) — the €250 sheet cap is enforced by OUR fee row (`max_total_minor`) | **no provider refunds** → wallet credit only | **WIRE** (the 2026-09-08 491 has cleared) |

Never probed, never wired (owner rule): skrill, payu_pl, multibanco_pt.

## What the probes settle

1. **No local-currency charging is needed.** Every method returns a checkout URL for a **USD** charge; Payssion converts to the local currency on its page (visible in the 417 text: `0.90 USD(0.81 EUR)`). Orders, attempts and charges stay USD end to end, exactly like Pix/GCash. The "convert via currency_rates at checkout, snapshot charge currency + rate" branch of the B4 brief is therefore **not built** — there is nothing to convert. Local currencies (EUR/PLN/CZK) are also accepted, recorded above for the day a EUR-priced order exists.
2. **Minimums are real and enforced by Payssion at create (417).** EPS and MB Way refuse below €1.00 *at Payssion's own FX rate*. B3 seeded that "€1 min" as `min_fee_minor = 100` (a minimum FEE of €1 on every order), which is a misread of the sheet; this PR moves it to a new `min_total_minor` (minimum charge) and sets `min_fee_minor` back to 0. The quote refuses `under_min` (page hides the tile), and `order_create_pending` re-checks the actual provider charge (after promo and wallet) with 5 % headroom for the difference between our `currency_rates` and Payssion's rate, so a 417 at create should never be reached; if it is, the buyer sees a specific message and the order is cancelled with its wallet hold returned (the existing PAY-006 path).
3. **Caps are ours to enforce.** Payssion accepted $320 on paysafecard; the €250 cap lives only in `payment_method_fees.max_total_minor` (already seeded) and `buyer_fee_quote` refuses `over_cap`.
4. **Refunds** cannot be probed without paying. Per the rate sheet (`docs/checkout.md` §7): paysafecard has no provider-side refunds → `refundable=false` (already seeded) → "Store credit only" on `/fees`; every other method refunds provider-side. App code never calls a provider `refund()` (support runbook in `lib/payments/dispatch.ts`) — buyer refunds are wallet credits for every method, so `refundable=false` changes what is *promised*, not what the code does.
5. `bancomat_it` is not a Payssion pm_id (405). The B3 seed row is renamed to `bancomatpay_it` by migration; nothing references the old key (no orders carry it — the method was never selectable through the registry).

## Recorded fixtures

The passing responses (`result_code`, `transaction.transaction_id / state / amount / currency`, `redirect_url` present, `todo: "redirect"`) and the two 417 bodies are recorded verbatim-shaped in `src/lib/payments/providers/payssion/probe-fixtures.ts`. `eu-methods.test.ts` asserts every registry pm_id has a fixture with `result_code: 200` (the "registry ⇒ probe 200" invariant, now executable) and drives the adapter's `createCharge` through each fixture.
