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
- Parity loop: once in ~9 runs one of the 405 concurrent checkouts (8-way) came back without an order; the loop retries that pair once on a fresh listing and prints the error, never retries an amount mismatch. The error text was not captured before the retry was added; three clean runs since. Watch the `[fee-checkout] … needed a retry` warning in CI.
- `docs/design/fee-engine.md` is gitignored; §6 updated in `~/gamevault` only.
- The design's §8.1 `EXPLAIN (ANALYZE, BUFFERS)` verification of the resolver's index plan is still owed (not in this PR's scope).
