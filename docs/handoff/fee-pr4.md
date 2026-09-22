# Fee engine — PR 4 handoff (the new rates: data only)

**Date:** 2026-09-22 · **Branch:** `feat/fee-engine-rates` (worktree `../gamevault-fee-pr4`, from `origin/main` at `dc9dc26c`) · **Not merged, no `db push` run.**
Design: `docs/design/fee-engine.md` §1.1, §6 (PR 4 row ✅ updated in `~/gamevault` only — the file is gitignored), §6.2. Scope = PR 4 only: **one migration, no app code**. Tests and the parity guard are the only TS touched.

## What ships
- `supabase/migrations/20260922001513_fee_engine_rates_2026_10.sql` — one `DO` block, one transaction, self-checking, idempotent for the local re-seed case. Applies **after** PR 1's `20260921201609` + `20260921201844` (and after `20260921230440` / `20260921234649`, which are already on main).
- `src/test/guards/fee-migration-parity.guard.integration.test.ts` — rewritten from the PR 1 "resolver == TS" proof into the two-sided PR 4 proof (below).
- `src/test/guards/fee-resolver.guard.integration.test.ts` — +1 notice-trigger case (UPDATE that only closes a historical rule is refused → why the migration sets `app.fee_backfill` for that one statement), +8 live-table cases (ladder, floor, founding on both sides of the start), and the pre-existing "15 days out is accepted" case now picks a pair with no pair-scope rule (PR 4 gave the fixture's pair one; the exclusion constraint would fire, a different proof).
- `src/test/guards/fee-checkout-snapshot.guard.integration.test.ts` — the 405-pair PARITY loop now compares each order to `resolve_seller_fee(seller, pair)` at order time (pct, payout, `rule_id`) instead of `commissionPct()`. The TS constants are no longer the reference once the ladder is live (a silver fixture seller already gets 14.5 on accounts today); the parity guard is where TS is still pinned, before the start only.
- `docs/handoff/fee-pr4.md` (this file).

## ⚠️ The start date — read this first
The spec said `2026-10-06T00:00:00Z` with the notice trigger enforcing it. The trigger requires `starts_at ≥ now() + 14 days`, so a 2026-10-06 00:00 start is only insertable **before 2026-09-22 00:00 UTC — already past** when this PR was written (07:15 UTC). Hard-coding 2026-10-06 would make every push fail; hard-coding a later date just moves the cliff.

**What the migration does instead:** `v_start = GREATEST('2026-10-06 00:00 UTC', first 00:00 UTC on or after now() + notice_days)`. The announced date is the floor; it slips only as far as the notice requires, to a midnight UTC.

| Pushed on (UTC) | Rates start |
|---|---|
| 2026-09-22 | **2026-10-07 00:00 UTC** (what the local stack got) |
| 2026-09-23 | 2026-10-08 |
| any later day D | D + 15 days, 00:00 UTC |

The new base rows are inserted with `app.fee_backfill` **off**, so `fee_rules_enforce_notice()` validates every one of them — the notice is enforced by the trigger, not waived. The GUC is on for exactly one statement: closing the PR 1 rows (the trigger re-checks `starts_at` = 2026-01-01 on UPDATE and would refuse; pinned by the new resolver-guard case). Promos are exempt by design.

**The push prints the date:** `NOTICE: fee engine PR 4: rates start at <ts> — …`. That is the date to announce to sellers. Afterwards it is `SELECT min(starts_at) FROM fee_rules WHERE note LIKE 'PR4:%'`. Both tests read the date from the DB, so they are valid whatever day the push lands.

## What the migration writes (verified on the local stack, 405-pair catalogue)
1. **Closes** every open-ended base rule (the 9 PR 1 seed rows: 6 category + grow-a-garden, grow-a-garden-2 currency 10, gta-v account 20) at `v_start` — `ends_at`, not delete, so `p_at` still reconstructs history.
2. **Category defaults** from `v_start`: items 10 · service 10 · top_up 5 · gift_card 5 (7→5 correction) · currency 5 · account 10.
3. **Pair rules** from `v_start`, keyed through `game_categories`, **25 rows** on this catalogue:

| Rule | Matched (pair exists) | **Skipped — no such (game, type) pair** |
|---|---|---|
| currency 10 | anime-defenders, blade-ball, creatures-of-sonaria, death-ball, dragon-adventures, escape-tsunami-for-brainrots, fisch, fix-it-up, grow-a-garden, grow-a-garden-2, pet-simulator-99, pets-go, royale-high, tap-simulator, toilet-tower-defense (15) | **steal-a-brainrot** — the game exists but has only `account` + `items` pairs, no `currency` pair |
| account 15 | call-of-duty, fortnite, r6-siege (3) | — |
| account 20 | gta-v, **gta-vi** (2) | **gtavi**, **gta-6** — no such games; `gta-vi` ("Grand Theft Auto 6") is the catalogue's slug, included on the spec's "whichever slugs exist" (see flags) |
| service 15 | — | **call-of-duty** — no `service` pair (the catalogue has **no** `service` or `gift_card` pairs at all: 144 account / 167 items / 42 currency / 52 top_up) |
| top_up 10 | 99-nights-in-the-forest, bite-by-night, bloxstrike, run-a-restaurant, sniper-duels (5) | — |
| **promo currency 0** [start, start + 6 mo) | **none** | **r6-siege** — no currency pair; **fc-25**, **fc-26** — no such games; **ea-sports-fc-26** (the FC 26 game) — no currency pair either. **0 promo rows written.** |

The migration prints matched/missing per list as `NOTICE`s at push time, so a prod catalogue that differs from local is visible in the push output, and the parity guard re-derives the same sets from the spec.

4. **Rank ladder + settings — effective at push time, not at the start.** `seller_tier_config.discount_pts` and `platform_fee_settings` are undated single-value tables (no history), as the spec anticipated: bronze 0 · silver 0.5 · gold 1.0 · diamond 1.5 · legendary 2.0; `rank_floor_pct 8.00`, `founding_discount_pct 50`, `founding_months 12` (the last three unchanged from PR 1). Consequence, pinned by the resolver guard: from the moment of the push a ranked seller gets their step on any base **above** 8 — today that is only accounts (15 → legendary 13, silver 14.5) and the two Roblox-economy currency pairs (10 → 8/9/…). Bases of 5 and 7 are untouched, so items/currency/top_up sellers see nothing until the start. This is a price **cut** for ranked sellers, never a rise, so no notice issue; if you would rather have the ladder land on the start date too, push this migration on the start day minus nothing (i.e. the ladder is the only part of PR 4 that cannot be pre-dated).
5. **Self-checks (abort the transaction otherwise):** exactly 6 open-ended category rules, all at `v_start`, with the target numbers; every pair resolves at `v_start − 1 s` **identically to before the migration ran** (captured in a temp table first) and never via the fallback; every pair resolves at `v_start` to its PR 4 pair rule or category default, never via the fallback; every promo row is `[v_start, v_start + 6 months)` at 0; all five tiers exist.

## Test results (local stack `gamevault-sab-pages`, `.env.test`, migration applied with `supabase migration up`, then re-applied by psql to prove idempotency)
| Check | Result |
|---|---|
| `fee-migration-parity.guard.integration` (rewritten) | **13/13** — one start date ≥ floor at 00:00 UTC; **405/405 pairs == `commissionPct()` at start − 1 s** and none to a PR 4 row; **405/405 pairs == the spec table at the start** (and at +24 h), all to PR 4 rows, none via fallback; six open-ended category rules only; PR 1 defaults closed exactly at the start; pair-rule set == spec ∩ catalogue with nothing unlisted; promo set == spec ∩ catalogue (empty); ladder; settings; founding × 0.5 on both sides (7 → 10 base on an items pair); founding backfill intact |
| `fee-resolver.guard.integration` | **41/41** (was 31 + 1 new trigger case + 8 live-table cases + "15 days out" re-pointed) — items: legendary 7 before → 8.00 at the floor from the start (`floor_applied` false), gold 9, silver 9.5, diamond 8.5, bronze 10; unlisted currency 5 → 5, no step either side; listed currency (fisch) 5 → 10 headline, legendary 5 → 8; unlisted account 15 → 10 headline, legendary **13 already before the start** → 8; gta-v legendary 18 both sides, diamond 18.5; call-of-duty account 15 via its pair rule; listed top_up 5 → 10 / legendary 8, unlisted top_up 5 no step; founding beats rank at the start (5.00, rank_pts 0) |
| `fee-checkout-snapshot.guard.integration` (PARITY re-pointed at the resolver) | **12/12** — 405 real checkouts (silver fixture seller): every order's pct / payout / `trace.rule_id` == `resolve_seller_fee(seller, pair)` at order time, ruled trace, zero residue |
| `pnpm exec tsc --noEmit` | clean |
| Full `pnpm test` | **166 files / 1494 tests passed**, 1 file + 2 tests skipped (pre-existing coingate live-API skips) |

Parity result: **money-neutral for every non-founding seller until the start**; from the start every pair is on the table above. The ladder is the one thing that moves at push time (a cut, ranked sellers only, bases above 8).

## Manual steps for Gyanu
1. Merge order / push order: PR #83 (PR 1) → PR #84 (PR 3) → PR #85 (already on main) → this. `supabase db push` from this branch applies everything pending in filename order; PR 1's seed must already have run (the migration closes its rows and aborts if the category defaults are not exactly six afterwards).
2. **Push on the day you want the clock to start** — the date is `push day + 15 days, 00:00 UTC` (floor 2026-10-06). Read the `NOTICE` lines in the push output: the start date, `closed 9 open-ended base rule(s)`, the matched/missing slugs per list, `… 6 category defaults, 25 pair rule(s), 0 promo(s)`. If a list's "matched" set on prod differs from the table above, the prod catalogue differs from local — say so before announcing.
3. Immediately after the push, SQL editor:
   ```sql
   SELECT min(starts_at) AS rates_start FROM public.fee_rules WHERE note LIKE 'PR4:%';
   SELECT count(*) FROM public.fee_rules WHERE kind='base' AND ends_at IS NULL;                 -- 6 category + 25 pairs = 31
   SELECT count(*) FROM public.game_categories gc
    WHERE (SELECT rule_id FROM public.resolve_seller_fee(NULL, gc.id, (SELECT min(starts_at) FROM fee_rules WHERE note LIKE 'PR4:%'))) IS NULL;  -- 0
   SELECT tier, discount_pts FROM public.seller_tier_config ORDER BY sort_order;                -- 0 / .5 / 1 / 1.5 / 2
   ```
4. Announce the date to sellers (the Terms' 14-day notice is satisfied by construction; the announcement is the human half). PR 5 makes the public fee page read the table; until then `/fees` copy still quotes the constants.
5. **Rollback before the start** is a clean no-op (§6.2): `DELETE FROM fee_rules WHERE note LIKE 'PR4:%'`, then re-open the seed rows under `app.fee_backfill='on'` from psql: `UPDATE fee_rules SET ends_at = NULL WHERE note LIKE 'Seed:%' AND kind='base'`, and `UPDATE seller_tier_config SET discount_pts = 0`. **After** the start, a rollback is a new dated rule set with its own notice — do not delete rows sellers have been charged under.
6. Local stacks after `supabase db reset`: `pnpm seed:games --env=local`, re-apply the PR 1 seed file, **then re-apply this migration file** (`psql "$DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20260922001513_fee_engine_rates_2026_10.sql`). It detects its own category rows, reuses their start and runs under the backfill GUC to add pair rules for the reseeded pairs only.

## Open questions / flags
- **`gta-vi` at 20 is a judgment call.** The spec listed gta-v / gtavi / gta-6 "whichever slugs exist"; the catalogue's GTA 6 slug is `gta-vi` (name "Grand Theft Auto 6"), which today resolves as mid-band **15** (the TS `ACCOUNT_RISK_BANDS` only knows `gtavi`/`gta-6`, so it never matched either). Including it means gta-vi accounts move 15 → 20 at the start. If that was not intended, delete the one row: `DELETE FROM fee_rules WHERE note = 'PR4: gta-vi account 20.00'` (before the start; no notice implications, it is a rate that never applied). The parity guard lists `gta-vi` in the spec, so remove it there too.
- **`ea-sports-fc-26` was added to the promo slug list** on the same reasoning (the spec's `fc-25`/`fc-26` do not exist). It matched nothing — FC 26 has only `account` + `top_up` pairs — so no row was written; it is there so a later `currency` pair for FC 26 gets the promo on a re-run. Remove from the list if unwanted.
- **`steal-a-brainrot` has no currency pair** on this catalogue (account + items only), so the SAB currency-10 rule the spec (and today's TS `ROBLOX_ECONOMY_GAMES`) names has never applied and still does not. `call-of-duty` has no `service` pair. `service` and `gift_card` have **no pairs anywhere** — their category defaults are dormant until a pair is created (`ensureGameCategory`); when one is, it inherits the category default (service 10 / gift_card 5), not a pair rule.
- **Promos: 0 rows.** None of r6-siege / fc-25 / fc-26 / ea-sports-fc-26 has a currency pair. If the promo is wanted, create the pair(s) first, then re-run the migration file by psql (idempotent; promo rows are guarded by note) or insert the promo row by hand (promos need no notice).
- **The ladder lands at push, not at the start** (undated table, as the spec allowed). See "What the migration writes" 4. If it must coincide with the start, the only data-only option is to push on the start date.
- Carried from PR 1/PR 3: founding sellers past 12 months since sign-up lose the founding discount the moment PR 3 deploys (unchanged here; still needs a notice decision).
- **Shared local stack state:** this migration is now applied on the running local Supabase (`gamevault-sab-pages`, the stack every worktree shares). Any other worktree still carrying the PR 1 version of `fee-migration-parity.guard` will fail its "six open-ended seed rows" test there until it has this branch; nothing else in the suite reads the closed rows.
- `fee_config_audit` gets no row from this migration (audit rows are written by the admin action, PR 5); provenance is the `note` column (`PR4: …`) and the migration file.
