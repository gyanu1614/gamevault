# Checkout & Payments — How It's Built

Last updated: 2026-09-22 (checkout fix round A, `fix/checkout-p0`). Covers the buyer checkout page, the payment provider
spine behind it, and the operational pieces (webhooks, expiry, testing).

---

## 1. The big picture

```
Buyer → /checkout/[id] (server page)
          └─ CheckoutForm (client)
               ├─ Tab: Crypto  ──────────────→ BTCPay (self-hosted, default provider)
               ├─ Tab: E-Wallet (geo-filtered) → Payssion (local methods, pm_id routed)
               └─ Tab: Card (disabled, "Soon" — waits on Glocash)
                        │
                  createCheckout (server action, amounts recomputed server-side)
                        │
              provider.createCharge → hosted payment page (new tab)
                        │
              webhook → canonical order events → order confirmed / cancelled
```

Two providers are live on one shared "payments spine":

- **BTCPay** (self-hosted): crypto — USDT (TRC20 live; Polygon/ETH flagged soon)
  and BTC. The default provider when no `paymentMethodId` is given.
- **Payssion**: fiat local-methods rail (GCash, Pix, OXXO, …). No global
  Visa/MC — mainstream cards come later from Glocash (KYB in progress).

---

## 2. File map

| Piece | Path |
|---|---|
| Checkout page (server) | `src/app/checkout/[id]/page.tsx` |
| Checkout UI (client) | `src/app/checkout/[id]/CheckoutForm.tsx` |
| Route skeleton | `src/app/checkout/[id]/loading.tsx` |
| Post-crypto pay page | `src/app/checkout/pay/[orderId]/` |
| Smart return route | `src/app/checkout/return/[orderId]/route.ts` |
| Checkout server action | `src/lib/actions/checkout.ts` (`createCheckout`) |
| Buyer fee math | `src/lib/fees/index.ts` (`buyerFee`) |
| Provider spine | `src/lib/payments/{registry,dispatch,webhook-router,types}.ts` |
| Payssion provider | `src/lib/payments/providers/payssion/` |
| BTCPay provider | `src/lib/payments/providers/btcpay/` |
| Payssion webhook | `src/app/api/webhooks/payssion` |
| Pending-payment sweep | `.github/workflows/expire-pending-payments.yml` → `/api/cron/expire-pending-payments` |
| Method logos | `public/payments/*.svg` |
| Trust-band art | `public/checkout/trust-hero.jpg` |

---

## 3. Server page (`page.tsx`)

Runs per-request (Supabase + cookies). In order:

1. Loads the listing with seller / game / category joins; redirects to
   `/browse` if missing, to the listing page if not `active`.
2. Reads the buyer (may be null — guests can view checkout).
3. **Geo country**: `x-vercel-ip-country` header, overridable with
   `?country=XX` (UI-only; used for localhost testing and support debugging).
4. Buyer profile, bundle summary (currency bundles show bundle name + icon
   instead of the raw listing title), last 5 seller reviews for the peek
   dialog.
5. Blocks self-purchase; renders the `BuyingOpensSoon` gate when
   `PURCHASES_ENABLED` is off (the hard block is in `createCheckout`).
6. Renders `<CheckoutForm listing user buyerProfile sellerReviews initialQty
   bundleSummary buyerCountry />`.

---

## 4. The payment selector (CheckoutForm)

### 4.1 Tabs

Three rectangular tabs: **Crypto** (default) | **E-Wallet** | **Card**
(disabled + "Soon" chip). Switching to Crypto sets `payMethod='crypto'`;
switching to E-Wallet auto-selects the first visible local method.

### 4.2 Crypto tab

- Two tiles: **Tether USDT** and **Bitcoin** (real coin marks). **No coin is
  preselected** — the network chooser and the amber send-warning stay closed
  until a tile is picked, and the Pay button is disabled until then.
- USDT → network `LightSelect` (TRON·TRC20 live; Polygon/Ethereum listed with
  fees, gated `soon`). BTC → fixed single-network row, no chooser.
- Fee hints read "Est. Fee $0.50" (never `~`).
- The chosen coin+network ride to the BTCPay pay page as
  `?coin=&net=` so its tab preselects.

### 4.3 E-Wallet tab (geo-filtered, registry-driven)

**Single source of truth:** `src/lib/payments/providers/payssion/methods.ts`.
Each entry carries `pmId, label, kind (instant|voucher), expiryMinutes,
feePercent, coverage, countries[]`. Entry **order = display order**.
`payssionSelectorMethods()` hides the sandbox `payssion_test` entry.

The UI adds only what the registry shouldn't know, in `METHOD_UI` inside
CheckoutForm: an icon, 2–3 checkmark **points** (crisp facts, no sentences),
and an optional `logo` (real brand SVG in `public/payments/`; falls back to a
stroke icon). **Adding a method = one registry entry + one METHOD_UI line** —
filtering, ordering, routing, expiry and tests pick it up automatically.

Region behavior (G2A pattern):

- The country pin (flag + Intl country name + method count) defaults to the
  buyer's geo country. **Only the selected country's methods render** — there
  is deliberately no "all countries" dump.
- Unknown geo (localhost) → "Choose Your Country" prompt state.
- Country with no methods (e.g. US) → "No Local Methods … Yet" card with a
  **Pay With Crypto** button that jumps tabs.
- A selected method never disappears when the filter changes.
- Country rows hide their flag chip when it just repeats the pin.

Flags are emoji (computed from the ISO code — no assets); country names come
from `Intl.DisplayNames`.

### 4.4 Pay area

Pay button (desktop inline, mobile sticky bottom bar) → trust chips row
(SafeDrop Guarantee · ID-Verified Sellers · Refund Policy) → legal microcopy
(11 px, muted: "By paying you agree to our Terms of Service and Refund
Policy").

### 4.5 Trust band + footer

- **"How Your Order Works"**: centered 18 px title above a full-width band.
  Mirrored painted-art background (`trust-hero.jpg` — mirrored so the sky,
  not the cliff, sits behind text) under one left-strong→right-clear ivory
  wash; uniform wash on phones. Four steps: Choose Payment Method / Wait for
  Delivery / Order Delivered / Item Not Received? (100% refund). ⚠️ The art
  is borrowed concept art — replace with original before serious marketing.
- **Footer**: full-bleed thin strip — DropMarket Ltd · Registered In The
  United Kingdom · Company No. 17309867, "Secured By DropMarket Payments",
  Support + Terms/Refunds/Privacy links. Mobile stacks centered with
  sticky-bar clearance.

Language rule: never "escrow" / "we hold funds" — agent model wording only
("Item Guaranteed or Full Refund").

---

## 5. Money flow

1. `createCheckout({ listingId, quantity, promoDiscount, walletAmount,
   paymentMethodId? })` — **all amounts are recomputed server-side**; the
   client's numbers are display-only. Buyer-fee source is `src/lib/fees`
   (`buyerFee`), mirrored in the UI (Marketplace fee + Processing fee rows).
   **Seller commission** (fee engine PR 3, 2026-09-21) comes from ONE
   `resolve_seller_fee(seller_id, game_category_id)` RPC on the buyer's
   session client (`src/lib/fees/resolver.ts`), before any amount is
   computed; the returned `pct` and trace are written to
   `orders.seller_commission_pct` / `orders.seller_fee_trace` (guarded
   columns) on insert. If the RPC errors or returns no row the order is
   **refused** with "Could not price this order" — there is no fallback to
   the TS constants (`docs/design/fee-engine.md` §9 A4). `createOrder` in
   `orders.ts` (the old Stripe-era second path) is deleted (A9).
   **Before any of that (fix A, 2026-09-22):** `checkRateLimit('checkout',
   user:<id>)` is charged inside the action (PAY-007; the REST route's limit
   never covered the live UI), and a buyer holding **5 open pending orders**
   is refused before the insert. Every pending order is inserted with a
   **30-minute fallback `payment_expires_at`** (PAY-006) so a crash before the
   charge UPDATE can never strand it. A promo usage is **awaited**: the caps
   (`usage_limit`, `per_user_limit`, active, expiry) bind inside
   `promo_usage_record` under the promo row lock (PAY-014); a refusal cancels
   the just-created order and the discount is never granted.
2. Wallet credit (ledger-backed, `getMyWalletBalance`) can part- or fully-pay;
   a fully-wallet-paid order skips the provider entirely. `wallet_spend`
   serialises on a per-user advisory xact lock before its balance guard
   (PAY-001) — two tabs on two listings can no longer overdraw one wallet.
   A fully wallet-paid order is confirmed through `order_confirm_payment`
   (same RPC as the webhook, §6); if the stock is gone it comes back as
   `oversold_refunded` with the credit already returned.
   **Duplicate / racing requests (PAY-005):** an existing pending order with
   no `checkout_url` yet, created inside the 90 s in-flight window, is a
   racing request still inside `createCharge` — it is neither superseded nor
   re-charged; the buyer gets "payment is still being prepared" and finds
   the finished order on retry. A 23505 loser on
   `one_pending_order_per_buyer_listing` never proceeds into charge creation
   for an order it did not insert.
   **Charge creation failure (PAY-006):** `createCharge` is wrapped; on
   failure the order is cancelled and the wallet hold mirrored back in ONE
   RPC (`order_cancel_return_wallet`, key `charge-create-failed`), provider
   internals stay in the log, and the copy says the credit is back in the
   wallet.
3. Provider routing (`src/lib/payments/registry.ts`):
   `providerNameForMethod(pmId)` → `'payssion'` if the pm_id is in the
   Payssion registry, else the env-active default (BTCPay). Un-registered
   pm_ids can never reach Payssion.
4. Payssion create: docs 6-field MD5 signature first (live-verified), WHMCS
   7-field fallback on 402. Our order UUID is sent as both `track_id` and
   `order_id`. Response gives `redirect_url` + `transaction_id`; Payssion has
   no server-side expiry, so we stamp per-method windows (1 h instant, 48 h
   voucher).
5. **New-tab pattern**: for provider-hosted methods the tab is claimed
   synchronously on click (popup-blocker safe), the hosted page loads there,
   and the original tab parks on the order page (Resume Payment / Cancel /
   countdown) — because some cashier pages (GCash) have no back button at
   all. Popup blocked → same-tab redirect fallback.

---

## 6. Webhooks & lifecycle

- `/api/webhooks/payssion`: signature gate (either MD5 scheme, timing-safe),
  then an **authoritative `/payment/details` re-fetch** — the notify body is
  never trusted for state. Fail-closed order-id binding; `completed` with
  `paid=0` or underpaid never confirms; overpay confirms. Refund/chargeback
  states map to canonical events. Event dedupe key: `txnId:state`.
- Money seams (cancel+wallet return, refund+credit, …) are **single SQL
  RPCs** — see CLAUDE.md "Money seams" (never recompose in TS).
- **Payment confirmation = `order_confirm_payment`** (fix A, PAY-003): the
  ONLY way an order becomes `paid`. In one transaction it runs
  `safedrop_transition(CHARGE_CONFIRMED)`, stamps `paid_at`, row-locks the
  listing and **claims the stock** (`quantity >= q`, or `is_unlimited`;
  `orders.stock_claimed_at`). Stock gone → the same transaction routes the
  money to `order_refund_to_wallet` (paid → refunded, full total to the
  buyer's wallet) and answers `outcome: 'oversold_refunded'`; dispatch then
  sends the REFUND comms. Completion no longer decrements a claimed order
  again; cancelling/refunding a claimed, still-`paid` order returns the
  quantity (`stock_returned_at`), a refund after delivery keeps it out.
  `inventory_claim_for_order` releases a code only to a paid order (PAY-015).
- **Automatic cancels are valid from `pending` only** (PAY-002).
  `order_cancel_return_wallet` — the CHARGE_FAILED webhook, the expiry sweep,
  the checkout supersede and the charge-create failure all call it — is a
  no-op on a paid/terminal order and inserts ONE deduped `payment_review`
  notification per active admin (keyed on admin + title + order link).
  The buyer's explicit `cancelOrder` (PAY-008) is the single caller that
  passes `p_allow_paid`: a `paid`, undelivered order is cancelled and the
  full total credited to the wallet in the same RPC; the old TS composition
  is gone.
- **Every provider fetch has an 8 s `AbortSignal.timeout`** (PAY-016,
  `lib/payments/timeouts.ts`); the return-route probe uses 4 s and falls
  through to the awaiting panel. Webhook routes answer an unauthenticated
  caller with a generic `rejected` — the failing stage is logged, not echoed.
  Cron routes check `CRON_SECRET` through `lib/security/cron-auth`
  (constant-time, fails closed).
- **Expiry sweep**: GitHub Actions every 30 min →
  `/api/cron/expire-pending-payments` (CRON_SECRET) cancels overdue pending
  payments at the provider then through the canonical cancel path. It also
  closes **never-charged** pending orders (`payment_provider IS NULL`, the
  fallback expiry from insert), oldest expiry first, on the partial index
  `orders_pending_payment_sweep_idx`. A row that turned `paid` in the gap is
  refused by the RPC (PAY-002), never cancelled. (Vercel
  Hobby refuses sub-daily crons — that's why it's a GH Action; vercel.json
  keeps a daily backstop.)
- Return route `/checkout/return/[orderId]`: paid lifecycle
  (paid/delivering/delivered/completed) → order page `?paid=1`; cancelled →
  checkout with a one-shot toast (`?cancelled=1`, URL cleaned after);
  refunded/disputed → plain order page; voucher still pending → awaiting
  panel (provider probe capped at 4 s).
- Known behavior: Payssion's own page "cancel" doesn't cancel the txn (buyer
  can resume — intended); abandoned QR pages are reaped by the sweep.

---

## 7. Payssion method status (2026-09-24, checkout B4)

**Live in checkout (18):** gcash_ph, maya_ph, qr_ph (PH) · pix_br, boleto_br
(BR) · oxxo_mx, spei_mx (MX) · qris_id (ID) · pse_co (CO) · webpay_cl (CL) ·
**trustly (Europe) · blik_pl, p24_pl (PL) · eps_at (AT) · mbway_pt (PT) ·
bancomatpay_it (IT) · payu_cz (CZ) · paysafecard (EU/UK/CA/AU)** — B4, all
probe-confirmed 200 on 2026-09-24 (`docs/payments/eu-methods-probe.md`; the
recorded answers are `src/lib/payments/providers/payssion/probe-fixtures.ts`).
Maya / OXXO / Boleto are wired but hidden by their fee row (`selectable=false`).

**Every method is charged in USD.** Payssion converts on its hosted page
(its 417 text shows the rate: `0.90 USD(0.81 EUR)`); EUR / PLN / CZK charges
are also accepted (probed) but nothing prices in them. Orders, attempts and
charges stay USD end to end.

| pm_id | Country | Payssion fee | Notes |
|---|---|---|---|
| paysafecard | EU/UK/CA/AU | 12.5% | no provider refunds → `refundable=false` (wallet credit only); **€250 cap is OURS** (`max_total_minor`) — Payssion accepted $320 at create |
| trustly | Europe | 2.5% + €0.35 | cheapest EU rail; country list = Trustly's published bank coverage (filter only) |
| blik_pl / p24_pl | PL | 4.75% + 0.55 zł | |
| eps_at | AT | 3.75% + €0.45 | **€1.00 minimum charge** (417 below) → `min_total_minor = 100` |
| mbway_pt | PT | 2.75% + €0.25 | **€1.00 minimum charge** (417 below) → `min_total_minor = 100` |
| bancomatpay_it | IT | 2.75% + €0.20 | the pm_id is `bancomatpay_it`; `bancomat_it` is not one (405) |
| payu_cz | CZ | 4.75% + 3.5 Kč | |

**Approved, deliberately NOT wired:** bancontact_be (BE, 4.25% + €0.45 —
probe control, 200), multibanco_pt (PT — refunds not supported; MB Way
preferred), skrill (⚠️ 10% + 180-day rolling reserve — **never wire**),
payu_pl (never wire). **Not enabled:** payid_au (491). **Dead pm_ids (docs
stale):** ideal_nl, upi_in, neosurf, bankcard_in; sofort discontinued.

**Per-method minimum**: `payment_method_fees.min_total_minor` (fee currency).
`buyer_fee_quote` refuses `under_min` on subtotal + fee (the tile is hidden)
and `order_create_pending` re-checks the ACTUAL provider charge after promo
and wallet credit, both with 5% headroom over `currency_rates` for the gap to
Payssion's own rate. A 417 that still reaches `createCharge` cancels the
order + returns the wallet hold (PAY-006) and tells the buyer the minimum.

Terms to remember: settlement T+15, **$20 flat per wire** (batch withdrawals),
USD/EUR settlement only. Rate sheet is confidential — never publish it.

---

## 8. Testing & ops tools

- **Enable probe**: `payssion-probe.mjs` (session scratchpad) — creates a
  $0.90 charge per pm_id and cancels it; `200` = enabled, `491` = not
  enabled, `417` = enabled but below its minimum. Takes an env-file path;
  keys live in `~/gamevault/.env.local` (`PAYSSION_API_KEY/SECRET_KEY`).
  Note: Vercel envs are Sensitive (write-only) — `vercel env pull` yields
  placeholders; the readable copy is the Payssion merchant dashboard.
- **Geo testing**: `?country=BR|PH|US|…` on the checkout URL.
- **Unit tests**: `src/lib/payments/providers/payssion/payssion.test.ts`
  (signatures, state map, webhook chain, routing, expiry, region filter) and
  `src/lib/payments/dispatch.test.ts`. Vitest loads `.env.test` — never let a
  test read `.env.local`.
- Gate every change with `npx tsc --noEmit` + the payssion test file; the
  full local build fails on Stripe env by design.

### 8.1 Ops: fee resolution gaps (seller commission)

From fee-engine PR 1 (`20260921201609`), the seller commission rate is
resolved by ONE SQL function, `resolve_seller_fee(seller, pair, at)`, from the
dated `fee_rules` table (design: `docs/design/fee-engine.md`). Checkout does
not read it yet (that is PR 3); once it does, every order carries the rate it
was charged (`orders.seller_commission_pct`) and the full resolver row that
produced it (`orders.seller_fee_trace`).

When no `fee_rules` row matches a pair, the resolver does **not** fail — it
returns a conservative hard-coded default with `rule_id = NULL` and
`fallback_count = 1` in the trace. That is deliberate (a missing config row
must not take checkout down) but it is always a **config gap**, and it must be
alerted on rather than left to accumulate:

- **The check** (service role or SQL editor; the view is `security_invoker`
  over `orders`, granted to `service_role` only):

  ```sql
  SELECT count(*) FROM public.fee_resolution_gaps;          -- must be 0
  SELECT id, created_at, seller_id, seller_fee_trace
    FROM public.fee_resolution_gaps ORDER BY created_at DESC LIMIT 20;
  ```

  `fee_resolution_gaps` = engine-era orders (`seller_fee_trace IS NOT NULL`)
  whose `seller_fee_trace->>'rule_id' IS NULL`. Pre-engine orders (NULL trace)
  never appear.
- **Catalogue-side precheck** (no orders needed): every pair must resolve to a
  rule:

  ```sql
  SELECT count(*) FROM public.game_categories gc
   WHERE (SELECT rule_id FROM public.resolve_seller_fee(NULL, gc.id)) IS NULL;  -- must be 0
  ```

  A new `(game, category)` pair is covered by the category-scope rule for its
  type automatically; a gap means a category type with no open-ended base
  rule (the seed leaves exactly six: currency, items, account, top_up,
  service, gift_card).
- **Fix**: insert the missing `kind='base'` rule (admin UI from PR 5, or
  service-role SQL). Base rules need `starts_at >= now() + 14 days`
  (`fee_rules_enforce_notice`); the gap orders keep their snapshot — never
  rewrite `seller_commission_pct` on a past order.
- **Cadence**: run both queries after every `db push` that touches
  `fee_rules` / `game_categories`, and wire `count(*) > 0` into the nightly
  ops check once PR 3 is live.

## 9. Invariants (do not break)

1. Registry entry ⇒ the pm_id is **probe-confirmed 200** on our app. An
   un-enabled pm_id in the registry = buyer-facing 491s. Executable since B4:
   `eu-methods.test.ts` fails for any selector pm_id without a recorded 200
   fixture in `probe-fixtures.ts` — re-probe and record before adding one.
2. Amounts are server-authoritative; the exact amount string that is signed
   is the one sent (never re-format).
3. Notify bodies are never trusted — always the details re-fetch.
4. Only the selected country's methods render; crypto is always available.
5. Skeleton (`loading.tsx`) matches every layout change, same pass.
6. No escrow/hold language anywhere in checkout copy.
7. **An order becomes `paid` only through `order_confirm_payment`**, which
   claims the stock in the same transaction. Never call
   `safedrop_transition(CHARGE_CONFIRMED)` from app code; never decrement
   `listings.quantity` for a claimed order anywhere else.
8. **Automatic cancels (webhook, sweep, supersede, charge failure) only ever
   cancel from `pending`.** A paid order is cancelled only by the buyer's
   explicit action (`p_allow_paid`) or a refund path — never by an event.
9. **A 23505 loser never creates a charge for an order it did not insert**,
   and an in-flight (url-less, < 90 s) pending order is never superseded.
10. **Every money-state change is ONE service-role SQL function** with an
    explicit GRANT and an entry in the posture guard's service-only list;
    new interior steps sit behind a `money_fault_hook` point.
11. Every pending order carries a `payment_expires_at` from the moment it is
    inserted; every provider call carries a deadline.
