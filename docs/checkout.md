# Checkout & Payments — How It's Built

Last updated: 2026-09-20. Covers the buyer checkout page, the payment provider
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
   client's numbers are display-only. Fee source is `src/lib/fees`
   (`buyerFee`), mirrored in the UI (Marketplace fee + Processing fee rows).
2. Wallet credit (ledger-backed, `getMyWalletBalance`) can part- or fully-pay;
   a fully-wallet-paid order skips the provider entirely.
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
- **Expiry sweep**: GitHub Actions every 30 min →
  `/api/cron/expire-pending-payments` (CRON_SECRET) cancels overdue pending
  payments at the provider then through the canonical cancel path. (Vercel
  Hobby refuses sub-daily crons — that's why it's a GH Action; vercel.json
  keeps a daily backstop.)
- Return route `/checkout/return/[orderId]`: paid → order page; cancelled →
  checkout with a one-shot toast (`?cancelled=1`, URL cleaned after); voucher
  still pending → awaiting panel.
- Known behavior: Payssion's own page "cancel" doesn't cancel the txn (buyer
  can resume — intended); abandoned QR pages are reaped by the sweep.

---

## 7. Payssion method status (2026-09-20)

**Live in checkout (10):** gcash_ph, maya_ph, qr_ph (PH) · pix_br, boleto_br
(BR) · oxxo_mx, spei_mx (MX) · qris_id (ID) · pse_co (CO) · webpay_cl (CL).

**Approved on the account, NOT yet wired (probe-confirmed 200):**

| pm_id | Country | Payssion fee | Notes |
|---|---|---|---|
| paysafecard | EU/UK/CA/AU | 12.5% | no provider refunds → refund as wallet credit; surcharge decision pending |
| trustly | EEA | 2.5% + €0.35 | cheapest EU rail |
| blik_pl / p24_pl | PL | 4.75% + 0.55 zł | |
| eps_at | AT | 3.75% + €0.45 | **€1.00 minimum** (417 below) |
| mbway_pt | PT | 2.75% + €0.25 | **€1.00 minimum** |
| bancontact_be | BE | 4.25% + €0.45 | |
| bancomatpay_it | IT | 2.75% + €0.20 | |
| payu_cz | CZ | 4.75% + 3.5 Kč | |
| multibanco_pt | PT | 4.25% + €0.45 | refunds not supported; MB Way preferred |
| skrill | global | 3.5% + $0.35 | ⚠️ 10% + 180-day rolling reserve — **do not wire** |

**Not enabled:** payid_au (491). **Dead pm_ids (docs stale):** ideal_nl,
upi_in, neosurf, bankcard_in; sofort discontinued.

Wiring these needs one new registry feature: a **per-method minimum amount**
guard so sub-minimum orders don't offer a method that will 417.

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
   un-enabled pm_id in the registry = buyer-facing 491s.
2. Amounts are server-authoritative; the exact amount string that is signed
   is the one sent (never re-format).
3. Notify bodies are never trusted — always the details re-fetch.
4. Only the selected country's methods render; crypto is always available.
5. Skeleton (`loading.tsx`) matches every layout change, same pass.
6. No escrow/hold language anywhere in checkout copy.
