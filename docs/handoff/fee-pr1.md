# Fee engine — PR 1 handoff (schema + resolver + money-neutral seed)

**Date:** 2026-09-21 · **Branch:** `feat/fee-engine-schema` (worktree `../gamevault-fee-pr1`) · **PR:** https://github.com/gyanu1614/gamevault/pull/83 · **Not merged, no `db push` run.**
Design: `docs/design/fee-engine.md` (local, gitignored; §6 status table updated). Scope = PR 1 only; checkout untouched.

## Migrations, in apply order
1. `supabase/migrations/20260921201609_fee_engine_schema_and_resolver.sql` — `fee_rules`, `platform_fee_settings`, `profiles.founding_since`, `seller_tier_config.discount_pts`, `orders.seller_commission_pct` + `seller_fee_trace`, both column guards re-created, notice + sync triggers, `resolve_seller_fee`, view `fee_resolution_gaps`, audit index, `fee_engine_version()` marker.
2. `supabase/migrations/20260921201844_fee_engine_seed_current_rates.sql` — category rules currency 5 / items 7 / account 15 / top_up 5 / service 7 / gift_card 7; pair rules Roblox-economy currency 10, GTA accounts 20; rank steps 0; settings (floor 8, founding 50% / 12 months, notice 14 d); `founding_since := created_at` for every founding seller. Idempotent; self-checks no pair resolves through the fallback.

## Approved deviations from the draft (encoded, tested)
- Founding: 50% off base for **12 months**, anchor `COALESCE(founding_since, created_at)`, every founding seller past or future. `legacy_founding_pts` retired. PR 2 absorbed.
- Trace gains `fallback_count` (0|1) + `resolver_version` (1); `fee_resolution_gaps` view (security_invoker, service_role only). Ops check: `docs/checkout.md` §8.1.
- Rank steps seeded 0 (money-neutral); ladder 0/0.5/1/1.5/2 + floor 8 is PR 4 data.

## Test results (local stack, `.env.test`, after `supabase db reset`)
| Check | Result |
|---|---|
| `fee-resolver.guard.integration.test.ts` | 31/31 — 12 worked examples, 23P01 overlap, promo needs `ends_at`, notice trigger, 42501 on new guarded columns, anon EXECUTE, determinism, `p_at`, gaps view |
| `fee-migration-parity.guard.integration.test.ts` | 7/7 — **405/405 pairs** `resolve_seller_fee(NULL,id) == commissionPct()`, 0 via fallback; founding parity |
| `db-p0-grants` + `table-posture` guards | 66/66 with allow-list entries (`resolve_seller_fee`; `fee_rules`, `platform_fee_settings` public-read) |
| Full suite `pnpm test` | 160 files / 1415 tests passed, 1 file + 2 tests skipped (pre-existing skips) |
| `pnpm exec tsc --noEmit` | clean |

## Manual steps for Gyanu
1. Review PR #83 (4 commits: migrations → tests → types regen → docs).
2. `supabase db push` from the branch: applies `20260921201609` then `20260921201844` in that order (one push does both; the seed's own checks abort the transaction if the catalogue leaves a gap).
3. Immediately after push, in the SQL editor: `SELECT count(*) FROM public.game_categories gc WHERE (SELECT rule_id FROM public.resolve_seller_fee(NULL, gc.id)) IS NULL;` → must be 0; `SELECT count(*) FROM profiles WHERE founding_seller AND founding_since IS NULL;` → 0.
4. Merge. Nothing changes for sellers until PR 3.
5. Local stacks: after any `supabase db reset`, run `pnpm seed:games --env=local` then re-apply the seed file once (`psql "$DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20260921201844_fee_engine_seed_current_rates.sql`) so the pair-scope rules exist for the reseeded pairs. Production already has the catalogue, so `db push` needs nothing extra.

## Open questions / flags
- **Founding sellers are not money-neutral at PR 3**: today base − 2 pts for life; after the switch base × 0.5 for 12 months from `created_at`. Approved, but any founding seller past 12 months since sign-up loses the discount the moment PR 3 lands — decide whether that needs its own notice.
- New pairs created after the seed inherit only the **category-scope** rate (e.g. a new SAB currency pair would be 5%, not 10%) until an admin adds a pair rule — same as adding a game to `ROBLOX_ECONOMY_GAMES` today, but now data, not code. Admin UI is PR 5.
- `src/types/database.ts` regen diff is large (schema had drifted since the last regen); all generated, nothing hand-edited.
- `docs/checkout.md` was untracked on main; committed whole in this PR.
- `FOUNDING_DISCOUNT_PTS` stays in TS until PR 6 (as instructed).
