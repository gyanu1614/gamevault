# Fee engine — PR 3 handoff (checkout → resolver, snapshot)

**Date:** 2026-09-21 (fix 2026-09-22) · **Branch:** `feat/fee-engine-checkout` (worktree `../gamevault-fee-pr3`) · **PR:** https://github.com/gyanu1614/gamevault/pull/84 · **Not merged. ⚠️ `db push` REQUIRED for this PR** (migration `20260921230440`, see the order-number fix below).
Design: `docs/design/fee-engine.md` §3, §6 (PR 3 row ✅), §7.4/7.5, §9 A4/A9. Scope = PR 3 only. **Money-neutral** except the approved founding exception. No migration in this PR.

## Files changed (3 commits + this handoff)
- `src/lib/fees/resolver.ts` (new) — `resolveSellerFee(client, {sellerId, gameCategoryId})` → `{ pct, trace }`; throws `FeeResolutionError` (message `Could not price this order`) on RPC error / no row / non-numeric pct / missing pair. `p_at` not passed: the DB stamps `now()`.
- `src/lib/actions/checkout.ts` — ONE `resolve_seller_fee` RPC on the buyer's session client before amounts; `commission = round2(subtotal × pct / 100)` (same rounding as before); `insertPendingOrder` writes `seller_commission_pct` + `seller_fee_trace` (rule_id, rule_kind, rule_scope, base_pct, rank, rank_pts, founding_applied, floor_applied, fallback_count, resolver_version, resolved_at). `FeeResolutionError` caught → `{ success:false, error:'Could not price this order' }`; it fires before the insert and before any wallet move. Listing select is now `*` (seller/game/category joins were only fee inputs).
- `src/lib/actions/orders.ts` — `createOrder` + `CreateOrderData` deleted (A9; grep found only a doc comment in `rate-limit.ts`), dead imports removed. `handleGuestCheckout` kept (exported, now unreferenced).
- `src/lib/fees/index.ts` — comment on `commissionPct()`: not a money path any more; constants stay until PR 6.
- `docs/checkout.md` §5 — money-flow bullet updated.
- Tests: `src/lib/fees/resolver.test.ts` (new, unit); `src/test/guards/fee-checkout-snapshot.guard.integration.test.ts` (new); `src/test/guards/fee-checkout-single-path.guard.test.ts` (new, static); `src/lib/checkout/promo.test.ts` + `listing-mutations-revalidate.guard.test.ts` re-pinned for `createOrder`'s absence.

## Test results (local stack, `.env.test`, after `supabase db reset` → `pnpm seed:games --env=local` → seed file re-applied)
| Check | Result |
|---|---|
| `fee-checkout-snapshot.guard.integration` — real `createCheckout`, buyer session + service insert | 10/10. **PARITY 405/405 pairs**: `seller_payout` == pre-change `round2(subtotal − commissionAmount(...))`, `seller_commission_pct` == `commissionPct(...)`, `trace.rule_id` NOT NULL, `fallback_count` 0, exact trace key set. Founding → base × 0.5, `founding_applied`. Ranked → resolver pct, `rank` named (steps are 0 until PR 4). Resolver error AND empty → typed error, no order row, wallet balance unchanged, same listing prices fine afterwards. §7.5: 0% promo inserted after an order leaves payout/pct/trace byte-identical, a NEW order gets 0% with the promo's rule_id; buyer & seller UPDATE → 42501. None of the run's orders in `fee_resolution_gaps`; none with NULL snapshot. Zero residue after cleanup (verified in DB). |
| `resolver.test` / `fee-checkout-single-path.guard` | 6/6 / 4/4 |
| `fee-migration-parity` (PR 1) | still green — must stay green until PR 4 deletes it |
| `payssion.test.ts`, `dispatch.test.ts` | 29/29, 6/6 |
| Full `pnpm test` | 163 files / 1435 tests passed, 1 file + 2 tests skipped (pre-existing) |
| `pnpm exec tsc --noEmit` | clean |

Parity result: **money-neutral for every non-founding seller on every catalogue pair.** Founding sellers change as approved (see PR 1 handoff).

## Manual steps for Gyanu
1. PR #83 (PR 1) must be merged **and** `supabase db push`ed first — `createCheckout` now hard-depends on `resolve_seller_fee` and the two `orders` columns; without them every checkout returns "Could not price this order" (that is the fail-closed design working, not a bug).
2. Review PR #84 (resolver seam → checkout switch + integration test → createOrder deletion + pins → handoff → parity loop capture → **order-number fix**). **Manual step: `supabase db push` required for this PR** — it applies `20260921230440_order_number_crypto_random.sql` (after PR 1's two migrations if they are not live yet; one push does all). Push BEFORE the deploy that carries the checkout change, or do both in one go: the old generator and the new checkout policy are compatible either way (a collision is simply retried once), but the collision rate only drops once the migration is live. Then in the SQL editor: `SELECT public.generate_order_number();` → `GV-` + 10 symbols, and `SELECT has_function_privilege('anon','public.generate_order_number()','EXECUTE');` → false.
3. First hour after deploy: `SELECT count(*) FROM public.fee_resolution_gaps;` → 0, and `SELECT seller_commission_pct, seller_fee_trace->>'rule_kind' FROM orders ORDER BY created_at DESC LIMIT 5;` shows non-NULL snapshots. A spike of "Could not price this order" in Sentry means the resolver/grants are not live.
4. Rollback = revert the checkout commit (`d36e8c1e`); the columns stay, nullable, harmless. The order-number migration is independent and can stay (rollback SQL is in its header).

## Open questions / flags
- **Founding sellers past 12 months since sign-up lose their discount the moment this deploys** (carried from PR 1). Decide on a notice before merging.
- `handleGuestCheckout` and `rateLimitCreateOrder` are now unreferenced exports; left alone (scope). Delete in PR 6 or a cleanup PR.
- Parity loop intermittent "no order": **root-caused in the addendum below** — `generate_order_number()` random-6-digit collision on `orders_order_number_key`, pre-existing, production-reachable; retry removed, fix proposed, not written.
- `docs/design/fee-engine.md` is gitignored; §6 updated in `~/gamevault` only.
- The design's §8.1 `EXPLAIN (ANALYZE, BUFFERS)` verification of the resolver's index plan is still owed (not in this PR's scope).

## Addendum 2026-09-22 — the intermittent "no order" in the parity loop: ROOT-CAUSED, pre-existing DB bug, not PR 3
Retry removed (`test(fees): parity loop never retries…`), the file run **20×** (`.env.test`, local stack, 405 real checkouts per run, 8-way concurrency) with transport capture via `node:diagnostics_channel` (undici request errors + HTTP ≥ 400), `console.error` capture and a DB probe on failure.

**Tally:** 16 clean · **2× parity "no order"** (runs 4, 10; a 3rd in a confirmation run after the loop = 3/21 ≈ 14%) · 2× founding-seller (runs 3, 5 — separate, harness-only, fixed, see below). Zero residue after every run.

**Exact capture (identical in all 3 parity failures):**
```
apex-legends/top-up (top_up) listing=6656929a-…
  returned: success=false error="Could not open checkout — please try again" orderId=undefined
  order rows for (buyer, listing): []
  console.error lines (0) · undici request errors (0)
  HTTP >= 400 responses (1): POST http://127.0.0.1:54321/rest/v1/orders?select=id -> 409
```
No transport error, no stack: nothing threw. The service-role INSERT into `orders` returned **409 = SQLSTATE 23505**; `insertPendingOrder` maps every 23505 to `{ duplicate: true }`; `createCheckout` then re-runs `findReusablePendingOrder`, finds nothing (probe confirms: no row for that buyer+listing, pending or otherwise) and returns "Could not open checkout — please try again". The write never happened, so it is not a money bug — the buyer is refused on a fresh listing.

**Which unique key.** `orders` has four: `orders_pkey`, `one_pending_order_per_buyer_listing` (partial, `status='pending'`), `orders_stripe_payment_intent_id_key` (NULL here), **`orders_order_number_key`**. The partial index is excluded by the probe (no row exists), so by elimination it is `order_number`. Confirmed by reproduction in a rolled-back psql transaction: `SQLSTATE=23505 … violates unique constraint "orders_order_number_key"`.

**Why it collides.** `generate_order_number()` (baseline `20260101000000:844`, via trigger `set_order_number_trigger`): `'GV-' || LPAD(floor(random() * 1000000)::text, 6, '0')` — six random digits, no uniqueness check, no retry. Birthday problem: a batch of 405 fresh numbers collides with itself in ~8% of batches (measured: **10 of 200** plpgsql batches); against rows already in the table each INSERT fails with probability ≈ N/1 000 000. The loop's 405 orders reproduce it at the observed rate.

**Verdict: not a test-harness artifact and not a race in `createCheckout` — a pre-existing DB bug reachable in production.** Every order ever inserted has this per-insert failure chance; today it is tiny (N small), but at 10 000 lifetime orders 1% of checkouts fail with "Could not open checkout", at 100 000 it is 10%. `createCheckout`'s contribution is only the *misclassification*: it treats any 23505 as the buyer+listing double-submit, so a collision becomes a confusing refusal instead of a recoverable insert. PR 3 did not introduce or change any of this; the 405-order parity loop merely made a 1-in-10⁶ event observable.

**Fix — DONE 2026-09-22 (commit `fix(orders): crypto-random collision-checked order numbers…`), as approved:**

_Survey before changing (nothing parses or validates the format):_ the only format-aware code is three display sites replacing the `GV-` prefix with `DM-` (`account/orders/[orderId]/page.tsx:232`, `account/orders/page.tsx:843`, `chat/ChatInterface.tsx:437` — prefix-only regex, unaffected by a longer suffix), a doc comment in `email/index.ts:346`, and an arbitrary fixture string in `orders.confirm-receipt.test.ts`. `orders.order_number` is `text`, no CHECK, no width; every reader falls back to `id.slice(0,8)` when NULL and otherwise treats it as an opaque label. Only caller of the generator: trigger `set_order_number_if_null`. The baseline had granted EXECUTE to anon+authenticated.

_What shipped:_
1. **Migration `supabase/migrations/20260921230440_order_number_crypto_random.sql`** — `generate_order_number()` replaced in place (same name/signature/default; existing numbers stay valid): `'GV-'` + 10 symbols from `extensions.gen_random_bytes(10)` over `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 symbols = 5 bits, `byte % 32` unbiased; no 0/O/1/I; space 32¹⁰ ≈ 1.1×10¹⁵), each candidate checked with `NOT EXISTS (… orders WHERE order_number = candidate)`, `RAISE … internal_error` after 5 misses. **Not a sequence** (would expose order volume). `SECURITY DEFINER` + `SET search_path = public` so the existence check sees every row; `EXECUTE` revoked from PUBLIC/anon/authenticated, granted to `service_role` (the only inserter; the trigger runs as the inserting role). No grants-guard entry needed (posture lists anon/authenticated-executable definers only). In-file self-check: format, 1000-draw uniqueness, grants. Local: 20 000 draws → 20 000 distinct.
2. **`src/lib/checkout/order-insert.ts`** (plain module — `'use server'` files cannot export a class): `classifyUniqueViolation` reads the constraint from `message`/`details`; `runOrderInsert` → `one_pending_order_per_buyer_listing` ⇒ `{ duplicate }` (reuse path unchanged), `orders_order_number_key` ⇒ INSERT retried **exactly once**, any other 23505 ⇒ `OrderInsertConflictError` (buyer sees "Could not create the order — please try again", the constraint and attempt count go to `console.error`). `insertPendingOrder` in `checkout.ts` now delegates to it; the outer catch maps the typed error. 13 unit tests in `order-insert.test.ts` (all three classes, retry-once, retry-then-duplicate, no-retry on other, non-unique passthrough, buyer-safe message).
3. **Guard additions** (`fee-checkout-snapshot.guard`): every order the run creates matches `^GV-[A-HJ-NP-Z2-9]{10}$` and all are distinct; the service role can draw a number; buyer and seller sessions get `42501` on `generate_order_number`.

**Verification after the fix:** parity loop **20/20 clean with NO retry** (12/12 tests each run, 8 100 real checkouts, zero 409s, zero residue). Gate: `supabase db reset` (migration applied in order after `20260921201844`), `pnpm seed:games --env=local` + seed re-apply, `tsc --noEmit` clean, **full suite 164 files / 1450 tests passed** (1 file + 2 tests skipped, pre-existing), `payssion.test.ts` 29/29, `dispatch.test.ts` 6/6.

**Production exposure of the old generator, for the record:** every order ever inserted had a per-insert failure chance ≈ N/10⁶ (N = orders in the table); today small, but it grows linearly. Orders already carrying 6-digit numbers are unaffected and remain unique.

**Founding-seller flake (harness-only, fixed):** the test stamped `founding_since` with the JS clock; the resolver compares the anchor with the DB's `now()` and the Docker VM clock sits up to a few hundred ms either side of the host's (measured host−DB: −19 … −373 ms under load, sign varies), so the anchor landed in the DB's future → `founding_applied=false`. Now anchored on `profiles.created_at`, as the PR 1 backfill does.
