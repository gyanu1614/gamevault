# DropMarket Money Layer — Target Architecture & Build Plan for THIS repo

*Decision document for the repo owner. Read this before we write code. It says what we're building, what we keep vs. throw away, the one rule that makes it all hang together, and the order we'll build it in so production never breaks.*

> Produced 2026-06-28 by a multi-agent pass (13 agents) that mapped the actual money/order/wallet/payment code in this repo against the DropMarket money-layer spec, then adversarially verified each recommendation against ground-truth source. Pairs with `HANDOFF_AUTH_AUDIT.md` (the 4 deferred Stripe P0s land here) and the three core build docs (Tasklist / Backend Spec / CoinGate).

---

## 1. The shape we're building

We're building a **double-entry ledger as the single source of truth for money**, with everything else arranged around it. Money becomes integer minor units (cents as `bigint`), never floats. Every money event — a buyer paying, escrow releasing to a seller, a refund, a payout — is written as a *balanced journal* (debits equal credits) in one atomic database transaction, and **balances are computed by summing the ledger, never stored as a number someone can overwrite**. Order state (SafeDrop) is a strict state machine where illegal moves are physically impossible and every transition posts its ledger journal in the same DB transaction. Payment providers (Stripe today, CoinGate next) sit behind **one interface** and speak a common "canonical event" language, so swapping or adding a provider doesn't touch the core. Inbound webhooks funnel through **one verified, deduplicated spine** with a single trust model.

```
                          ┌─────────────────────────────────────┐
  Buyer / Seller / Admin  │  Server Actions (withAuth choke pt)  │
        UI / API  ───────▶│  checkout · confirm · refund · payout│
                          └───────────────┬─────────────────────┘
                                          │ calls ONE RPC per money event
                                          ▼
  Provider (Stripe/CoinGate)   ┌──────────────────────────────────┐
        webhook  ──▶ [webhook spine]──▶ │  SafeDrop transition RPC (Postgres)│
        verify·dedupe·canonical          │  • SELECT…FOR UPDATE (lock order)  │
                                         │  • (state,event)->next | reject    │
                                         │  • post_journal(...)  ◀── LEDGER   │
                                         │  • idempotency insert  │  (truth)  │
                                         │  ALL IN ONE DB TRANSACTION         │
                                         └──────────────┬─────────────────────┘
                                                        ▼
                          balances = SUM(ledger_entries)  ──▶ derived views
                          (wallet_balances / seller balance become read-models)
```

The mental model: **the ledger is the bank's books; orders, wallets, and payouts are just views and triggers over those books.** Today we have the opposite — balances are the truth and there are no books.

---

## 2. Reuse / Refactor / Rebuild

| Subsystem | Verdict | One-line why |
|---|---|---|
| **Ledger** | **Rebuild (additive, greenfield)** | Nothing today is double-entry; `wallet_transactions` is single-entry float with a balance snapshot. Build clean new tables + `post_journal` rather than retrofit bigint + contra-accounts into the live table. |
| **SafeDrop / orders** | **Reuse + Refactor** | The DB transition trigger already makes illegal moves impossible — that's the hard part, and it's sound. Fix 4 localized bugs and move multi-step flows into atomic RPCs; do **not** build a parallel engine that competes with the live trigger. |
| **Wallet** | **Refactor last (cutover), keep live for now** | `wallet.ts` is float, single-entry, read-modify-write, no lock — unsound but load-bearing. Leave it running; make `wallet_balances` a derived view over the ledger only after the ledger proves out on new flows. |
| **Provider seam** | **Rebuild (greenfield)** | No abstraction exists — Stripe SDK is inlined in 5 files. Build one `PaymentProvider` interface; wrap existing Stripe calls in an adapter first, no behavior change. |
| **Webhooks** | **Rebuild into one spine** | Two routes today write the same balances under *two different trust models* with no event dedupe — a live double-credit hazard. Collapse to one verified, deduped, service-role spine. |
| **Reserves / clawback** | **Build dormant, defer live** | CoinGate is crypto — no chargebacks — so the reserve engine stays off until Tazapay (cards). Model the columns/seams now; don't build the clawback waterfall yet. |
| **Payouts** | **Rebuild on ledger** | Auto-release **never pays the seller today** (it's a TODO); withdrawals **never debit the wallet**. These are the most broken flows — greenfield them on the ledger; nothing to migrate, biggest correctness win. |

---

## 3. The one hard constraint that drives everything

**Money is integer minor units (`bigint`), the ledger is the only source of truth, and every balance is *derived* by summing ledger entries — never stored as a mutable number.**

Everything else in this document follows from that one rule. It's why providers must hand us authoritative integer amounts (no dividing by 100 in JS), why webhooks must be idempotent (a replayed event must not post a second journal), and why the wallet refactor is risky enough to do last.

**What it means for our existing float wallet data.** Today money lives in three unrelated mutable stores, all `NUMERIC(10,2)`:
1. `wallet_balances.available_balance` (+ lifetime/cashback columns)
2. `profiles.seller_balance` / `pending_balance` / `lifetime_earnings` (escrow release writes here)
3. `withdrawal_requests` amounts

When we eventually cut the wallet onto the ledger, we **do not** trust the transaction history (it can already be drifted — the app dual-writes balance and ledger with no lock). Instead we take the number the user actually sees today (`available_balance`, and `seller_balance`/`pending_balance` for sellers) as the **genesis balance**, post one opening journal per user, and convert in **SQL not JS** (`(available_balance * 100)::BIGINT` — Postgres NUMERIC math is exact, no double-precision hazard). Before any code reads the ledger, a reconciliation query must prove `SUM(ledger) == SUM(legacy balances)` across **both** `wallet_balances` and `profiles.*_balance`, or we abort. We snapshot both tables first. This conversion happens only at the wallet-cutover phase — not when the ledger is first introduced.

---

## 4. Repo reconciliation — the folder layout we'll actually use

The spec names `src/ledger`, `src/escrow`, `src/payments`, `db/migrations`. **None of those match this repo and we should not introduce them.** This repo uses `@/* → src/*`, a flat `src/lib/actions/*.ts` for `'use server'` mutations, `src/lib/supabase/*` for clients, and `supabase/migrations/` as the *only* working migration path (the agent cannot run DDL; you run SQL in the Supabase editor — there is no `db/migrations` apply path).

What we'll actually use:

```
src/lib/
  money.ts              # pure: bigint minor units, add/sub, fromDecimal/toDecimal (the ONLY float edge), splitPercent
  money.test.ts         # first Vitest target
  ids.ts, errors.ts     # tiny primitives (uuid, deterministic journalRef, typed errors)
  ledger/
    post-journal.ts      # TS seam -> supabase.rpc('post_journal'); uses the service-role SINGLETON
  escrow/
    state-machine.ts     # pure (state,event)->next|null; the single TS source of truth, agrees with SQL
  payments/
    types.ts             # PaymentProvider interface + canonical events + capabilities
    registry.ts          # getProvider(name)
    webhook-router.ts     # the spine: verify -> dedupe -> canonical -> dispatch -> 200
    dispatch.ts          # canonical event -> SafeDrop RPC
    with-auth.ts         # withAuth(role, handler) choke point
    idempotency-edge.ts  # reads Idempotency-Key header at the action edge
    providers/
      stripe.ts          # wraps the 5 scattered SDK call sites
      coingate.ts        # Phase 4
      fake.ts            # deterministic in-memory provider for tests

supabase/migrations/      # KEEP. YYYYMMDD_<name>.sql, idempotent, you run it, code waits for confirmation
  20260628_ledger.sql
  20260628_webhook_events.sql
  20260628_safedrop_transitions.sql
  ...
```

Three things to fix while we're here, not propagate:
- **One service-role client:** use the singleton `src/lib/supabase/service.ts` for all money/system code (not the duplicate `service-role.ts`, not the inline ad-hoc clients in the webhooks).
- **One type source:** the service-role client reads the hand-written `@/types/database` — new tables/RPCs must be added there by hand, not left to the generated `database.types.ts`. Don't propagate the `as any` pattern from `wallet.ts`.
- **`src/escrow/`/`src/payments/` stay under `src/lib/`** so they can reuse the existing actions and clients.

---

## 5. Stripe removal — the safe order

The invariant: **at every step, exactly one code path writes each balance row, under one trust model.** The danger is running an old route (trust-A, no dedupe) and the new spine (trust-B, dedupe) for the *same* event type at once → a Stripe retry double-credits. So every cutover is *delete-old-and-wire-new in the same commit*.

1. **Land the seam behind Stripe, no behavior change.** Build the `PaymentProvider` interface + registry + webhook spine + a Stripe adapter that wraps the existing SDK calls + the fake provider. Nothing calls the spine yet. Gate: type-check + lint + fake-provider tests.
2. **Apply the `webhook_events` dedupe migration** (you run it; code doesn't depend on it yet).
3. **Cut wallet top-ups over first** (lowest blast radius, single event type). Point the new `/api/webhooks/[provider]` route at the spine; delete `stripe-wallet/route.ts` in the same commit. **This kills the wrong-trust-tier writer.**
4. **Cut the main order webhook over.** Move order-creation/refund/payout handling into `dispatch.ts`; replace trusting `metadata.seller_payout` with an authoritative re-fetch + amount check; delete the inline service-role client.
5. **Add CoinGate** (Phase 4) — same spine, new adapter, route param. No new writer introduced.
6. **Remove Stripe** once CoinGate is proven: delete `stripe-payment.ts`, `stripe-connect.ts`, `stripe/connect.ts`, the `api/stripe/**` tree, drop the npm deps. Because call sites talk to the interface, this is deleting one adapter, not chasing 5 SDK sites.

**Where the 4 deferred Stripe P0 audit fixes land** (all in the new seam, each with one home):
1. *Authoritative re-fetch + amount check (stop trusting metadata money)* → the Stripe adapter's `parseWebhook` re-fetches the charge and recomputes the amount; the core never sees metadata money. (Lands in step 4.)
2. *Per-order token/signature + IP allowlist* → `verifyWebhook` in each adapter + an IP-allowlist check in the spine before verify. (Mandatory once CoinGate/HMAC lands, Phase 4.)
3. *Event-id dedupe* → `webhook_events UNIQUE(provider,event_id,status)` + insert-and-catch-`23505` in the spine. (Step 2/3.)
4. *Service-role choke point + `withAuth(role,handler)` on money mutations* → the spine always uses the service-role singleton; every money-moving action is wrapped in `withAuth`. (Steps 1–4, enforced by CI gate.)

---

## 6. Build sequence for US (Phase 0 → 7)

Per-phase gate is `npm run type-check && npm run lint && npm run test`. **Test runner does not exist yet** — adding Vitest (`"test": "vitest run"` + `vite-tsconfig-paths`) is literally the first action of Phase 0, or the gate is fiction.

| Phase | What we build | Test gate | Live company needed? |
|---|---|---|---|
| **0 — Primitives** | `money.ts`, `ids.ts`, `errors.ts` + Vitest | Unit: round-trip `fromDecimal/toDecimal`, `0.1+0.2`, half-even rounding, currency-mismatch throw | **No** |
| **1 — Ledger** | `ledger_accounts/transactions/entries` tables, `post_journal` RPC, balanced-to-zero deferred constraint trigger, append-only rules, `post-journal.ts` | Seed-journal tests: balanced posts succeed, unbalanced reject, idempotent replay returns same tx | **No** |
| **2 — SafeDrop** | Pure `state-machine.ts`; idempotent atomic transition RPC (`SELECT…FOR UPDATE` + guard + status + journal + dedupe); **fix the 4 bugs** | **Hard gate:** full (state,event) matrix; SQL trigger agrees with TS map; idempotency under replay | **No** |
| **3 — Provider seam + webhook spine** | `PaymentProvider` interface, registry, spine, Stripe adapter, **fake provider**, `webhook_events` | Fake-provider drives the SafeDrop matrix end-to-end; dedupe on replay; signature-fail → 400 | **No** (fake provider) |
| **4 — CoinGate sandbox** | CoinGate adapter (HMAC, EUR, irreversible refunds, no chargeback) | Sandbox webhooks → canonical events → ledger; amount/currency checks | CoinGate **sandbox** acct (not a live company) |
| **5 — Settlement / reserves / reconciliation** | Wallet cutover (genesis backfill + reconciliation), payouts on ledger, fix auto-release-pays-seller, reserve engine **dormant** | Reconciliation `SUM(ledger)==SUM(legacy)`; nightly drift check; auto-release credits seller | **No** for logic; live payout rails later |
| **6 — HTTP / frontend** | Wire `Idempotency-Key` on checkout/payout/refund; UI reads derived balances; outbox + replay worker | API-edge idempotency double-submit test; outbox drain | **No** |
| **7 — KYB + go-live** | Tazapay (cards) → reserve/clawback engine **live**; KYB; PITR backups; encrypt sensitive columns | Clawback waterfall tests; chargeback flow | **Yes** — live company / KYB / provider accounts |

**Phases 0–3 and the logic of 5–6 need no live company** — they're buildable and testable today against pure functions, the ledger, and the fake provider. Only Phase 4 (sandbox account) and Phase 7 (KYB, live rails, Tazapay chargebacks) require external company/provider standing.

One hotfix worth pulling *ahead* of all this: **`disputed→refunded` is blocked by the transition trigger today**, so on every full-refund dispute the Stripe refund fires but the order stays stuck in `disputed` (the failure is swallowed as "non-fatal"). It's a one-line `CREATE OR REPLACE` widening the allowed targets, plus a regression test — ship it as a standalone PR before the rest, since it's actively losing state integrity on real refunds.

---

## 7. Open decisions for you

These need your call before or during the build. The first five are choices; the last two are go-live blockers to confirm.

1. **Test runner.** Recommendation: **Vitest** (ESM, TS, `@/*` alias, fastest fit). Confirm so it can be the first commit. Without it the per-phase gate is unenforceable.

2. **Bigint-migrate existing wallet rows, or start the ledger fresh from a cutover?** Recommendation: **fresh genesis cutover.** The ledger starts empty and proves out on the new/broken flows (escrow release, payouts) first; existing wallet balances are imported as one opening journal per user *only at Phase 5*, using the user-visible `available_balance`/`seller_balance` as the genesis figure (not the drifted transaction history), converted in SQL. We do **not** rewrite the history into bigint. Confirm this approach.

3. **Monorepo-in-Next vs separate service.** Recommendation: **stay in Next**, under `src/lib/*`, calling Postgres RPCs. The atomicity we need (journal + status flip in one transaction) comes from Postgres functions, not from a separate service — and supabase-js can't span a multi-statement transaction anyway. A separate service buys us nothing here and splits the codebase. Confirm.

4. **The two policy values to confirm** (code will encode these exactly as given):
   - **Refund & dispute protection windows**, per category → `windows.ts`. *We need your numbers.*
   - **AML/KYC reserve tiers** → reserve matrix. Spec defaults to confirm or override: currency/boosting new **15% / 180d**, est **5% / 90d**; accounts new **10% / 120d**, est **5% / 90d**; topup_keys new **5% / 90d**, est **2% / 60d**. *These stay dormant until Tazapay/cards (Phase 7) but the matrix gets coded now.*

5. **Chart-of-accounts size at Phase 1.** Minor: ship the full 11-kind enum now, or start smaller and add kinds as flows land (avoids enum churn)? Recommendation: ship full — it's cheap and avoids later ALTERs.

6. **Two blocking prod checks — please confirm before go-live:**
   - **Is RLS actually enabled on the sensitive tables?** The new `ledger_*`, `webhook_events`, and transition-log tables must be `USING(false)` for `authenticated` (service-role-only). The CI gate fails the build on `USING(true)` on a sensitive table — but confirm RLS is on in the live project, not just in the migration files.
   - **Is `CRON_SECRET` set?** Auto-release/payout crons are the flows we're fixing to actually move money — if the cron secret isn't set/verified in prod, either the cron doesn't run (sellers never paid) or the endpoint is unauthenticated (anyone can trigger releases). Confirm it's set and the endpoints check it.

---

## 8. Protection windows & account warranty (decided 2026-06-28)

These are the values `windows.ts` (Phase 2) and the reserve matrix (Phase 5/7) encode.
**Placeholders pending UK-lawyer sign-off of the Refund & Dispute Policy** — but the
*structure* is final. Two timers per category:
- **Post-confirm delay** — even an *active* buyer confirm waits this long before funds move
  (undo buffer against an accidental/coerced confirm).
- **Auto-release** — if the buyer does nothing, release after this long (the protection window).

| Category | Post-confirm delay | Auto-release (no action) |
|---|---|---|
| Currency / gold / top-ups | **12h** | **3 days** |
| Codes / keys | **0** (single 24h window) | **24h** |
| Accounts | per warranty tier (below) | per warranty tier (below) |
| Coaching / boosting | **3h** | **completion + 5 days** |

**Account warranty — platform-funded, buyer-paid tiers (Model B).** DropMarket sells the
warranty to the *buyer*; longer window = higher fee = margin on good accounts; risk is
covered by holding back the seller's reserve for ≥ the window. Sellers don't opt in or pay a
warranty fee (simpler for them; they still bear chargeback liability via Seller Agreement 7.1,
which the reserve secures). **Dormant until cards (Tazapay/Phase 7)** — crypto has no
chargebacks — but coded now.

| Tier | Window | Buyer fee (of order) | Seller reserve held |
|---|---|---|---|
| **Standard** (default, free) | 7 days | 0% | 10% / 30d |
| **Extended** | 14 days | +4% | 10% / 45d |
| **Premium** | 30 days | +6% | 12% / 90d |

**Invariant enforced in code:** `reserve_hold_days ≥ protection_window_days` for every tier,
so auto-release can never beat the chargeback/recovery cover. All numbers are placeholders
finalizable before go-live; the code reads them from config, so changing a value is a one-line edit.

---

## 9. Currency model (decided 2026-06-28)

**Base / ledger / settlement currency = EUR. Always. The ledger is 100% EUR.**
EUR is what CoinGate settles, what Wise holds, and the cleanest base for the UK Ltd
(year-end GBP tax conversion is the accountant's job, not the ledger's). Everything below
is *display* or *price-currency* over an EUR-truth ledger.

**Three distinct currency concepts (never conflate):**
1. **Ledger/order currency = EUR** — escrow, seller balance, reserve, commission, payout: all EUR.
2. **Listing price currency = the seller's choice (USD or EUR)** — a *real* price, not display.
3. **Buyer presentment currency = region-driven display** — what the buyer sees/pays.

**Buyers (display-only, region-driven, NO toggle):**
- Default display EUR. **EU/UK → EUR. Rest of world → USD.** (Later: AUD/CAD/etc. by region.)
- Small indicator near prices: "prices shown for reference; payment processed in EUR at the
  current conversion rate."
- The buyer's card/coin is collected per the rail (crypto: pays coin→CoinGate settles EUR;
  cards/Tazapay later: charged in presentment currency, provider settles EUR, FX→fx_gain_loss).

**Sellers (real price currency, chosen at registration):**
- Seller picks **USD or EUR** at registration = their store's **price currency**.
- Their listings are *genuinely priced* in that currency ("$10.00" stays $10.00, no drift).
- Their dashboard/earnings view shows their chosen currency (converted from EUR balances for view).
- **Payout is still EUR** (provider settles EUR); seller balance in the ledger is EUR.
- At each SALE, the listing's price-currency amount is converted to EUR at a **frozen snapshot
  rate** → that EUR amount is the order/ledger amount. FX never enters the ledger as a holding;
  it's snapshotted on the order + (for cards) booked to fx_gain_loss.

**FX mechanics:**
- A **rates table refreshed periodically** (every few hours, free FX API) drives display + the
  per-sale conversion.
- At **checkout the exact rate is frozen onto the order** (presentment_currency,
  presentment_amount, fx_rate) for the receipt and any settlement FX. Standard practice.

**Order model additions (Phase 2/6):** `currency` (EUR, the ledger truth) + a presentment
snapshot: `presentment_currency`, `presentment_amount`, `fx_rate_used`. The ledger stays EUR-only.

**Listing model addition:** `price_currency` (USD|EUR, seller's choice). Existing 51 USD listings
re-based to EUR base price at a fixed snapshot rate at cutover — BUT since sellers now own a real
price currency, the cleaner path is: keep their USD price as the listing price_currency=USD and
convert per-sale. (Resolve at the listing/seller-onboarding phase, not the ledger phase.)

**Why EUR base for a UK Ltd:** CoinGate settles EUR → zero FX on the common crypto case. UK
Corporation Tax is filed in GBP via a reporting conversion at year-end; it does not require a
GBP ledger. If settlement ever moves to a GBP/USD rail, re-basing is a contained migration (the
ledger is currency-tagged from day one), not a rewrite.

---

*Net: build the ledger clean and additive, keep the sound SafeDrop trigger and fix its 4 bugs, collapse the two webhooks into one trusted spine, and sequence every balance cutover as delete-old-and-wire-new so there's never a moment with two writers. The wallet refactor — the one destructive change — happens last, after the ledger has proven itself in production on the flows that are broken today anyway.*

---

## Appendix — live bugs the analysis surfaced (verified against source)

These are real today, independent of the rebuild:
1. **`disputed → refunded` is rejected by the order-transition trigger.** Full-refund disputes fire the (Stripe) refund, then fail to update the order status; the error is swallowed as "non-fatal" → order stuck in `disputed`, money refunded but state wrong. (Pull the one-line fix ahead.)
2. **Auto-release / admin-trigger-release credit no one.** `release_escrow` RPC sets `completed`/`released` but the seller-payout move lives only in `confirmOrderReceipt`'s `transferEscrowToSeller`, not in the RPC. So timeout auto-release and admin release pay the seller nothing.
3. **Withdrawals never debit the wallet** (the request is created but no balance is moved).
4. **Dual-writer on `wallet_balances`:** a trigger writes `available_balance = NEW.balance_after` on every completed `wallet_transactions` insert, AND both webhook routes also directly UPDATE `wallet_balances` — a live double-write / drift source.
5. **Two separate balance systems:** buyer-side `wallet_balances` vs seller-side `profiles.seller_balance/pending_balance` — escrow release writes the latter, top-ups the former. The ledger unifies these.
