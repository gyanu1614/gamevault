# Auth & Authorization Audit — Findings & Proposal

> Generated 2026-06-28 via multi-agent audit (25 agents: 5 mappers, 5 gap-hunters,
> 14 adversarial verifiers + completeness critic). 13 candidate findings raised →
> **9 confirmed** (5 Critical, 2 High, 2 Medium), 4 dismissed.
> This is the deferred "Step 2 proposal" from `HANDOFF_ADMIN_REDESIGN__AUDIT.md`.
> **No fixes applied — for review first.**

## Executive summary
This Next.js 14 + Supabase marketplace has a thoughtfully layered auth design in places (the admin area, order state machine, and most seller/order server actions are genuinely well-gated), but it has **catastrophic gaps on the money-movement surface** where no layer enforces anything. Across confirmed findings: **5 Critical, 2 High, 2 Medium** (plus a body of dismissed/mitigated claims and unexamined `/api/**` routes that likely add more Criticals). The single most important issue is the **wallet subsystem**: an `FOR ALL ... USING(true)` RLS policy on `wallet_balances`/`wallet_transactions` plus unauthenticated wallet server actions let any logged-in user read every user's financial ledger and mint themselves an arbitrary balance — a direct, trivially exploitable financial breach. Closely behind are `createRefund` (unauthenticated Stripe refunds of any amount) and `approve/rejectWithdrawalRequest` (any user self-approves their own cash-out via a service-role client). The recurring root cause is a misunderstanding that **server actions are protected by middleware/layouts — they are not**; they are independently invocable RPC endpoints and must carry their own in-function authorization.

## Auth model (as-built)
The app intends a four-layer model. Only some layers actually enforce:

- **Middleware (`src/middleware.ts`)** — *partially enforcing, page-routes only.* Gates a fixed `protectedRoutes` prefix list (`/orders`, `/purchases`, `/account/dashboard|listings|analytics|earnings`) with `getUser()` + seller-only checks (approved `seller_applications` row) + a restricted-seller block. It **cannot** gate server actions or `/api/**` by function identity, only page navigations by pathname. The orphaned `src/lib/supabase/middleware.ts` `updateSession` helper is never invoked.
- **Layouts** — *mixed.* `(admin)/layout.tsx` is the strongest gate in the app (server-side `admin_roles` + `is_active` + MFA AAL2). `(sell)/layout.tsx` does server `getUser()` only. `account/layout.tsx` is **client-only** (`useAuth()` in `useEffect`) — cosmetic, not a security control. Layouts never run in the server-action call path.
- **Server actions (`src/lib/actions/*`)** — *the real trust boundary, inconsistently enforced.* Most order/listing/seller actions correctly re-auth via `getUser()` and gate on ownership/role in-function. A cluster of money-movement actions (wallet, refunds, withdrawals) enforce **nothing**.
- **RLS** — *the intended backstop, real for most tables but broken for the most sensitive one.* Solid `is_admin()`/`admin_roles`-based policies for `orders`, `disputes`, `messages`, `seller_applications`, etc. **Defeated** for `wallet_balances`/`wallet_transactions` by a permissive `USING(true)` policy. **Nonexistent** for Stripe API calls by construction.

Client gates (`SellerOnlyGate`, `useAuth`) are **cosmetic UX only**; they enforce nothing and are subject to a sticky localStorage cache that can briefly admit demoted users.

## Confirmed findings

### 1. Wallet server actions accept attacker-controlled `userId` with no auth — money minting + IDOR
**Severity: Critical** · **Location:** `src/lib/actions/wallet.ts:164` (`addCashback`), `:227` (`deductFromWallet`), `:294` (`refundToWallet`)
These three exported `'use server'` functions take the target `userId`, `amount`, and `orderId` as plain arguments and write directly to `wallet_transactions`/`wallet_balances`. None calls `getUser()`, none checks ownership or admin role — in deliberate contrast to `getWalletBalance`/`createTopUpCheckout` in the same file, which do. The user-bound client means RLS is the only DB gate, and RLS is wide open (see finding 2).
**Attack:** A logged-in attacker invokes `addCashback('<own-uuid>', 100000, '<any-uuid>')`; the `AFTER INSERT` SECURITY DEFINER trigger `update_wallet_balance` writes `balance_after` straight into `wallet_balances.available_balance`. The fabricated balance is spendable at checkout (`createPaymentIntent` subtracts a client-supplied `walletAmount`) or cashable via withdrawals. Conversely `deductFromWallet('<victim-uuid>', 9999, ...)` drains/forges entries on another user's ledger.
**Fix:** Add `getUser()` + admin-role gate (`requireAdmin()`) at the top of all three; these are admin/internal-only operations. Never trust client-supplied `userId`/`amount`. Pair with finding 2.

### 2. Wallet RLS defeated by `FOR ALL ... USING(true)` — full cross-user read + write
**Severity: Critical** · **Location:** `supabase/migrations/20260225_wallet_balance_system.sql:88-100`
Alongside correct per-user `SELECT` policies, the migration creates `"System can manage wallet balances"` and `"System can manage wallet transactions"` as `FOR ALL TO authenticated USING (true) WITH CHECK (true)`. Postgres combines permissive policies with OR, so this grants every authenticated user SELECT/INSERT/UPDATE/DELETE on **all** rows of both financial tables. No later migration narrows it.
**Attack:** Because `/account/wallet` is gated only by the client-side `account/layout.tsx` (not in `protectedRoutes` — confirmed) and the browser uses the public anon key, an attacker hits PostgREST directly: `GET /rest/v1/wallet_transactions?select=*` dumps every user's ledger; `POST /rest/v1/wallet_transactions {user_id:<self>, amount:100000, balance_after:100000, status:'completed'}` mints balance via the trigger. The app's `.eq('user_id', user.id)` scoping is convenience, not enforcement.
**Fix:** Change both `"System can manage ..."` policies to `TO service_role` (or drop them and route all writes through SECURITY DEFINER server actions). This single migration fix closes the read-all, write-all, and forge-balance vectors at the DB layer.

### 3. `createRefund` issues Stripe refunds with no auth, authz, or amount validation
**Severity: Critical** · **Location:** `src/lib/actions/stripe-payment.ts:193-220`
A top-level export in a `'use server'` file, making it a directly-invocable endpoint. Its entire body calls `stripe.refunds.create({ payment_intent, amount, reason })` with a client-supplied `paymentIntentId` and a fully client-controlled `amount`. No `getUser()`, no admin check, no order-party check. There is no RLS backstop because this is a Stripe HTTP call, not a DB query. Middleware/layout never run for direct action invocations. The only legitimate caller (`resolveDispute` in `admin-disputes.ts:341`) is gated, but that gate is in the *caller* — the export is independently reachable.
**Attack:** Attacker harvests a `pi_...` id (returned in their own checkout `client_secret`, or leaked via `verifyPayment` — finding 8), then invokes `createRefund(pi_..., 9999, 'requested_by_customer')`. Stripe issues a real refund of attacker-chosen size, draining merchant/escrow funds. Repeatable across harvested ids.
**Fix:** Add `requirePermission('disputes.resolve')` (or `requireAdmin()`) at the top of `createRefund`; recompute/clamp `amount` server-side from the order rather than trusting the client; consider de-exporting and inlining into `resolveDispute`.

### 4. `approveWithdrawalRequest` / `rejectWithdrawalRequest` gated only by "is logged in", then use service-role client
**Severity: Critical** · **Location:** `src/lib/actions/withdrawals.ts:250-282`, `:285-317`
Both are the admin half of the payout workflow. Their only check is `const { data: { user } } = await supabase.auth.getUser(); if (!user) throw` — any authenticated user passes. They then switch to `createServiceRoleClient()` (RLS-bypassing) to UPDATE `withdrawal_requests` to `approved`/`rejected`, filtered only by `.eq('id', requestId).eq('status','pending')` — no `user_id` scoping, no role check. The correct `requireAdmin()` helper exists and is used by sibling admin actions but is omitted here. A repo search finds **no call sites**, so no layout gate applies — these are reachable only as direct server actions. The `profiles.role='admin'` RLS policy on the table is irrelevant because the service-role client bypasses RLS.
**Attack:** An ordinary user with a pending withdrawal calls `approveWithdrawalRequest({ requestId: '<own-pending-id>' })`; `!user` passes; service-role flips it to `approved` (the payout-processor state), self-authorizing their cash-out. `rejectWithdrawalRequest` lets any user grief others' pending withdrawals.
**Fix:** Add `await requireAdmin()` (or `requirePermission('withdrawals.process')`) as the first line of both functions, before `createServiceRoleClient()`.

### 5. `/account/wallet` is client-gated only, with no middleware and no RLS backstop
**Severity: Critical** · **Location:** `src/app/account/wallet/page.tsx` (gated only by `src/app/account/layout.tsx`); backing tables in `supabase/migrations/20260225_wallet_balance_system.sql:88-100`
This is the route-level expression of findings 1+2: the most sensitive user page has *no* enforcing control at any layer. `/account/wallet` is absent from middleware `protectedRoutes`; `account/layout.tsx` is `'use client'`; the browser uses the anon key; and RLS is defeated. Listed separately because the remediation has a route-coverage component (add `/account/wallet` to `protectedRoutes`) in addition to the RLS fix.
**Attack:** As in findings 1–2 — the attacker never loads the page; they query PostgREST directly with their session JWT.
**Fix:** Primarily fix RLS (finding 2). Additionally add `/account/wallet` (and other sensitive `/account/*` segments) to `protectedRoutes` for defense-in-depth.

### 6. Restricted/banned seller can publish listings via the `/sell` wizard
**Severity: High** · **Location:** `src/lib/actions/sell-wizard.ts:519` (`publishListing`), `:957` (`bulkPublishListings`); `src/middleware.ts:69-85`; `supabase/migrations/add-listings-rls-policies.sql`
The intended restricted-seller block (`middleware.ts:69-85`, redirect to `/account/restrictions` when `seller_status != 'active'`) lives inside the `if (isProtectedRoute && ...)` guard, but the real sell flow runs through `(sell)` → `/sell/new` and `/sell/bulk`, which are **not** in `protectedRoutes`. So the `'/sell/'` branch of `isListingMutation` is dead code. The wizard actions force `seller_id=user.id` but never read `seller_status`; the publish-policy RPC checks only tier/caps/moderation; the moderation trigger only downgrades to `pending_approval`; and RLS only requires `profiles.role='seller'` — which a restricted seller retains (restriction lives in the separate `seller_status` column). `createListing` (`listings.ts:399`) *does* check `seller_status`, proving the check was intended but omitted from the actual sell path.
**Attack:** Admin restricts a fraudulent seller (`seller_status='restricted'`, role stays `'seller'`). The seller goes to `/sell/new`, completes the wizard, and `publishListing` inserts successfully — restriction fully defeated.
**Fix:** Add a `seller_status === 'active'` check at the top of `publishListing` and `bulkPublishListings` (mirror `listings.ts:399`). Best-effort defense-in-depth: add a `seller_status` clause to the listings INSERT RLS policy or a BEFORE-INSERT trigger.

### 7. Restricted seller can edit/reprice/restock/reactivate/delete existing listings
**Severity: Medium** · **Location:** `src/lib/api/seller-compatible.ts:261-298` (the unguarded surface, used by `src/app/account/listings/page.tsx`); related server actions `listings.ts:627/681/831`, `sell-wizard.ts:730`
The listing-mutation server actions check ownership but not `seller_status`; for their cited routes the middleware restricted-seller block does cover them. The genuinely unguarded path is `/account/listings/page.tsx` (a client component) calling `listingsApi.update/delete` in `seller-compatible.ts`, which uses the **browser** Supabase client with only `.eq('seller_id', user.id)` filters — these never traverse middleware, and RLS lacks a `seller_status` clause. Client-side `isRestricted` checks exist on some handlers but not `onUpdatePrice`/`onConfirmDelete`, and are trivially bypassed.
**Attack:** A restricted seller calls reprice/reactivate/delete on their existing listings directly via the browser client; ownership + `role='seller'` RLS pass; the restriction is ignored.
**Fix:** Best addressed at the DB layer — add `profiles.seller_status='active'` to the listings UPDATE/DELETE RLS policies (covers all paths). Failing that, add `seller_status` checks in `seller-compatible.ts` update/delete and the four server actions.

### 8. `verifyPayment` leaks Stripe payment-intent status + full financial metadata, unauthenticated
**Severity: Medium** · **Location:** `src/lib/actions/stripe-payment.ts:165-188`
Exported `'use server'` action that retrieves any client-supplied `paymentIntentId` and returns `status` plus the full `metadata` object — which `createPaymentIntent` populates with `seller_id`, `seller_payout`, `platform_fee`, `subtotal`, `listing_id`, vaultshield fees, and `wallet_amount_used`. No `getUser()`, no party check, no RLS backstop (Stripe API).
**Attack:** Attacker reads back financial internals/seller payout figures for any `pi_...` id they can harvest (own checkout, logs, leaked secrets) and feeds the ids into the `createRefund` attack. Severity is Medium rather than High only because `pi_` ids are random/non-enumerable, so ids must be harvested.
**Fix:** Add `getUser()` and verify the caller is party to the associated order before returning; strip sensitive metadata fields from the response, or remove the export if unused.

## Dismissed / mitigated (for transparency)
- **"No unauthenticated `/account/*` or checkout leak exists"** → Confirmed correct: server components redirect anon, actions re-auth, and (non-wallet) tables have `auth.uid()`-scoped RLS, so anon gets zero rows. The `protectedRoutes` omissions are defense-in-depth gaps, not exploitable leaks (except wallet, which is its own finding).
- **`deliverCodeToBuyer` trusts client `buyerId`** → Not exploitable: the function's first `orders` query runs under the attacker's RLS context (non-party gets zero rows → "Order not found") before any ownership check or decryption; `instant_delivery_inventory` RLS is a second backstop. Code-hygiene only.
- **`getModerationStats` omits the admin check** → No real disclosure: it uses the user-bound client, and listings RLS zeroes out the sensitive `pending`/`rejected` counts for non-admins; only already-public `active` counts are visible. Consistency nit.
- **Banned seller can still progress existing orders (`startDelivering`/`markOrderAsDelivered`)** → By design: restriction is scoped to listing creation; blocking fulfillment would harm the already-paid buyer; the ban grants no incremental capability and payout is independently gated on buyer `confirmOrderReceipt`/dispute.

## Coverage gaps & recommended further checks
The audit never opened `src/app/api/**`, which contains likely-Critical issues:
1. **Cron endpoints with hardcoded fallback secret** — `api/cron/auto-release-escrow`, `mark-inactive-sellers`, `send-trustpilot-invitations` all use `process.env.CRON_SECRET || 'your-secret-key'`. If `CRON_SECRET` is unset, anyone can trigger escrow release / seller-state changes / bulk email with `Bearer your-secret-key`. (`upgrade-seller-tiers` correctly has no fallback.) **Fail closed; remove the fallback.**
2. **Admin escrow-release API gates on spoofable `profiles.role`** — `api/admin/trigger-escrow-release/route.ts:24-32` checks `profiles.role`, not `admin_roles`/`is_admin()`. Privileged money movement on the wrong (spoof-class) gate.
3. **Wallet top-up webhook uses RLS-bound client + non-atomic balance math** — `api/webhooks/stripe-wallet/route.ts` uses `createClient()` (user-bound) instead of service role, working only because wallet RLS is open. Switch to service role.
4. **Trustpilot webhook fails open** — `api/webhooks/trustpilot/route.ts:45` skips signature verification entirely if the secret env var is unset. Make signature mandatory.
5. **No rate limiting on auth** — `rateLimitAuth()` is defined but never imported; `login`/`signup` and all `/api/**` are unthrottled. The limiter is also in-memory per-instance (ineffective on serverless).
6. **Settings Security tab is non-functional mock** — password change, 2FA toggle, and delete-account buttons have no handlers (`account/settings/page.tsx:726/767/780`). Users believe they enabled 2FA when they did not — a trust/security gap.
7. **CSRF posture unverified** for plain `/api/**` POST routes (server actions have built-in Origin checks; raw API routes do not).
8. **Avatar upload** lacks server-side size/MIME validation (`auth.ts uploadProfileAvatar`).
9. **Seller-role source-of-truth divergence** — `useAuth` init (`profiles.role`), `useAuth` auth-change (`seller_applications.status`), and middleware (approved application row) use three different signals; fail-safe today but causes desync.
10. **Storage RLS for `listing-images`** — `deleteListingImage` (`listings.ts:243`) has no auth/ownership check; cross-user deletion is blocked only if bucket RLS is correct. **Verify.**
11. **Dead code:** `withSellerAccess` HOC (no consumers) and the orphaned `updateSession` middleware helper — remove to prevent future false-confidence wiring.

## ⚙️ Remediation progress (updated 2026-06-28)

Payments are being migrated **off Stripe → CoinGate (then Tazapay)**, so Stripe-coupled
fixes are deferred into that migration rather than patched-then-deleted.

**✅ Fixed now (provider-independent, `tsc` clean):**
- **P0-#4** — `approveWithdrawalRequest`/`rejectWithdrawalRequest` now call `requireAdmin()`
  (from `admin-permissions.ts`) before the service-role client, using `admin.userId` for
  `processed_by`. `src/lib/actions/withdrawals.ts`.
- **P0-#5** — cron secret fallback removed in `auto-release-escrow`, `mark-inactive-sellers`,
  `send-trustpilot-invitations`; now fail closed (`!CRON_SECRET || authHeader !== ...`),
  matching the already-correct `upgrade-seller-tiers`.

**⏸️ Deferred to the CoinGate wallet/payment rework:**
- **P0-#1 (wallet RLS)** — ⚠️ **coupled to code, do NOT ship the migration alone.** Verified
  that **every** wallet write in `wallet.ts` (and `withdrawals.ts:111`, both stripe webhooks)
  uses the *user-bound* `createClient()`, not the service-role client. They only succeed
  *because* RLS is `USING(true)`. Flipping the policy to `service_role` first would break all
  legit writes. **Correct sequence in the rework:** (1) move every wallet write to
  `createServiceRoleClient()` + `SECURITY DEFINER` RPCs, (2) THEN lock both
  `"System can manage ..."` policies to `TO service_role`. This is the #1 must-do of the rework.
- **P0-#2 (`createRefund`)**, **P0-#3 (wallet mutation actions)**, **P0-#6 (admin escrow-release
  API)** — Stripe-specific; rebuild with proper in-function authz against the new CoinGate
  actions from scratch (every new payment action must carry its own `getUser()` + role/owner gate).

## Proposed remediation plan (prioritized, for your approval)

### P0 — money-movement; fix immediately (do these first)
1. **Fix wallet RLS** (finding 2). File: `supabase/migrations/` (new migration). Change both `"System can manage wallet balances"`/`"System can manage wallet transactions"` policies from `TO authenticated` to `TO service_role` (or drop them). **Effort: S · Risk: M** (verify legitimate writers use service role / SECURITY DEFINER first — see item 4).
2. **Gate `createRefund`** (finding 3). File: `src/lib/actions/stripe-payment.ts`. Add `await requirePermission('disputes.resolve')` at the top; recompute `amount` server-side. **Effort: S · Risk: L.**
3. **Gate the wallet mutation actions** (finding 1). File: `src/lib/actions/wallet.ts`. Add `await requireAdmin()` at the top of `addCashback`, `deductFromWallet`, `refundToWallet`; stop trusting client `amount`. **Effort: S · Risk: M** (confirm `order-cancellation.ts` caller path still works as admin).
4. **Gate withdrawal approve/reject** (finding 4). File: `src/lib/actions/withdrawals.ts`. Add `await requireAdmin()` as the first line of `approveWithdrawalRequest`/`rejectWithdrawalRequest`, before `createServiceRoleClient()`. **Effort: S · Risk: L.**
5. **Remove cron secret fallback** (gap 1). Files: `src/app/api/cron/auto-release-escrow/route.ts:12`, `mark-inactive-sellers/route.ts:12`, `send-trustpilot-invitations/route.ts:15`. Replace `|| 'your-secret-key'` with a hard fail when `CRON_SECRET` is unset. **Effort: S · Risk: L.**
6. **Fix admin escrow-release gate** (gap 2). File: `src/app/api/admin/trigger-escrow-release/route.ts:24-32`. Replace `profiles.role` check with `is_admin()`/`requireAdmin()`. **Effort: S · Risk: L.**

### P1 — high-impact, slightly broader
7. **Block restricted sellers from publishing** (finding 6). File: `src/lib/actions/sell-wizard.ts`. Add `seller_status==='active'` check at the top of `publishListing` and `bulkPublishListings` (mirror `listings.ts:399`). **Effort: S · Risk: L.**
8. **Make Trustpilot webhook fail closed** (gap 4). File: `src/app/api/webhooks/trustpilot/route.ts:45`. Reject if secret unconfigured; require valid signature. **Effort: S · Risk: L.**
9. **Switch wallet webhook to service role + atomic update** (gap 3). File: `src/app/api/webhooks/stripe-wallet/route.ts`. Use `createServiceRoleClient()`; do the balance increment atomically (RPC or `update ... set balance = balance + x`). **Effort: M · Risk: M.**
10. **Wire `rateLimitAuth` into login/signup** (gap 5). Files: `src/lib/actions/auth.ts` (`login`, `signup`). Move the limiter to a shared store (Upstash/Redis) for serverless. **Effort: M · Risk: L.**
11. **Restricted-seller listing edits** (finding 7). Files: `supabase/migrations/` (add `seller_status='active'` to listings UPDATE/DELETE RLS) and/or `src/lib/api/seller-compatible.ts`. **Effort: M · Risk: M.**

### P2 — defense-in-depth, hygiene
12. **Gate `verifyPayment`** (finding 8). File: `src/lib/actions/stripe-payment.ts`. Add `getUser()` + order-party check; strip sensitive metadata. **Effort: S · Risk: L.**
13. **Expand `protectedRoutes`** (finding 5). File: `src/middleware.ts:12-19`. Add `/account/wallet`, `/account/settings`, `/account/privacy`, `/account/messages`, `/account/orders`, `/checkout`. **Effort: S · Risk: L.**
14. **Make settings Security tab real or remove the fake UI** (gap 6). File: `src/app/account/settings/page.tsx`. Wire `updatePassword`, real TOTP enroll/unenroll, delete-account; or hide until implemented. **Effort: L · Risk: M.**
15. **Add `getUser()` + ownership to `deleteListingImage`; verify `listing-images` bucket RLS** (gap 10). File: `src/lib/actions/listings.ts:243`. **Effort: S · Risk: L.**
16. **Server-side avatar validation** (gap 8). File: `src/lib/actions/auth.ts uploadProfileAvatar`. **Effort: S · Risk: L.**
17. **Standardize admin checks to `is_admin()`** across remaining `profiles.role` policies (`20260610_admin_redesign_phase_a.sql`, `20260327_withdrawal_system.sql`, reviews/templates migrations). **Effort: M · Risk: M.**
18. **Unify seller-role source of truth** in `useAuth` (gap 9) and **delete dead code** (`withSellerAccess`, `updateSession`). **Effort: S–M · Risk: L.**

## Open questions for you
1. **Is RLS actually enabled and `FORCE`d in the live Supabase project?** Migrations declare `ENABLE ROW LEVEL SECURITY`, but several Criticals assume RLS is the live backstop. Has anyone disabled it or run with a service-role key client-side anywhere?
2. **Are the wallet mutation actions (`addCashback`/`deductFromWallet`/`refundToWallet`) meant to be admin-only, or is there a legitimate non-admin caller I should preserve?** `deductFromWallet`/`addCashback` currently have zero call sites — can they be deleted outright instead of gated?
3. **Is `CRON_SECRET` actually set in production today?** If yes, gap 1's exposure is latent; if no, it is live and P0-immediate.
4. **Are the mock settings sections (password/2FA/delete) in scope for this pass,** or tracked separately as feature work? They are a trust gap but not an exploitable authz hole.
5. **Should `createRefund`/`verifyPayment` remain exported at all,** or be inlined into their admin callers to shrink the server-action attack surface?
6. **Confirm Storage RLS on the `listing-images` bucket** — is cross-user object deletion actually blocked, or is `deleteListingImage` exploitable?
