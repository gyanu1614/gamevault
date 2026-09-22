# Fee engine — PR 3 handoff (checkout → resolver, snapshot)

**Date:** 2026-09-21 · **Branch:** `feat/fee-engine-checkout` (worktree `../gamevault-fee-pr3`) · **PR:** https://github.com/gyanu1614/gamevault/pull/84 · **Not merged, no `db push`.**
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
2. Review PR #84 (4 commits: resolver seam → checkout switch + integration test → createOrder deletion + pins → handoff). Merge. No migration, no `db push` for this PR.
3. First hour after deploy: `SELECT count(*) FROM public.fee_resolution_gaps;` → 0, and `SELECT seller_commission_pct, seller_fee_trace->>'rule_kind' FROM orders ORDER BY created_at DESC LIMIT 5;` shows non-NULL snapshots. A spike of "Could not price this order" in Sentry means the resolver/grants are not live.
4. Rollback = revert the checkout commit (`d36e8c1e`); the columns stay, nullable, harmless.

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

**Proposed fix (NOT written — awaiting go-ahead; both parts are outside PR 3's scope):**
1. **Migration (the real fix):** make `generate_order_number()` collision-free — e.g. `'GV-' || LPAD(nextval('order_number_seq')::text, 8, '0')` seeded above the current max, or keep the random form but `LOOP … EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_number = candidate)` with a 10-digit space. Sequence is simpler and strictly unique; random-with-check hides the order count. Timestamp per CLAUDE.md, `db push` after PR 1.
2. **`checkout.ts` (defence in depth, one hunk):** in `insertPendingOrder`, classify 23505 by constraint — `error.message`/`details` names it (`one_pending_order_per_buyer_listing` → `duplicate: true`; anything else → return the error so the buyer sees "Failed to create order" and Sentry sees the constraint) — optionally retry the INSERT once when the constraint is `orders_order_number_key`. This changes `checkout.ts`; per instruction it is described here and not written.

**Until the migration lands:** the parity test will go red in roughly 1 run in 12 with exactly the capture above. Do not re-add a retry — it would hide a production-reachable failure; treat that red as the DB bug, not the PR.

**Founding-seller flake (harness-only, fixed):** the test stamped `founding_since` with the JS clock; the resolver compares the anchor with the DB's `now()` and the Docker VM clock sits up to a few hundred ms either side of the host's (measured host−DB: −19 … −373 ms under load, sign varies), so the anchor landed in the DB's future → `founding_applied=false`. Now anchored on `profiles.created_at`, as the PR 1 backfill does.
