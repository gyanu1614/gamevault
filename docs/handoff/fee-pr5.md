# Fee engine — PR 5 handoff (readers + copy + cleanup; PR 6 absorbed)

**Date:** 2026-09-22 · **Branch:** `feat/fee-engine-readers` (worktree `../gamevault-fee-pr5`) · **PR:** https://github.com/gyanu1614/gamevault/pull/87 · **Not merged, no `db push` run.** No rate changed; only who reads them.
Design: `docs/design/fee-engine.md` §4, §5, §6 (PR 5 ✅, PR 6 absorbed), §7, §9 A5–A13 (updated in `~/gamevault`; the file is gitignored).

## Commits (one per part)
1. `f6ef88c8` **Admin Fees tab** per enabled pair (`/admin/games/[id]/edit` → Fees): live headline rate + producing rule, category default, upcoming rules, promos, risk band. `src/lib/actions/admin-fees.ts` (requireAdmin → service role → validate → write → `fee_config_audit` row with actor → `revalidateFeeReaders()`). Migration **`20260922163106_fee_rules_admin_schedule.sql`**: `fee_rule_schedule_base` (closes the open pair rule at the new start + inserts, one call; notice enforced) and `fee_rule_cancel_scheduled` (deletes an unstarted rule, re-opens what it closed) — service-role only.
2. `354d1d99` **Seller preview** (`previewSellerFee`, new + edit wizard) and `/[game]/sell` title via `getPairHeadlineRate` under `FEE_RULES_TAG`; `fee-preview-parity.guard`.
3. `ccdd56cc` **`/sell/fees`** (force-static, resolver with NULL seller, sitemap + footer) and **`/fees`** legal seller section → rules + link, no numbers. `/sell/fees` is a `PUBLIC_EXCEPTIONS` entry in `protected-routes.ts`; wizard chrome matches only `/sell/{new,edit,bulk}`.
4. `0383efd6` **Copy de-numbered** (table below), rank card/tiers page in points with floor, admin seller detail likewise, order row reads `seller_commission_pct`; `fee-copy.guard`.
5. `421b1be2` **Cleanup**: TS constants + `commissionPct()` deleted (grep + tsc clean; `fee-checkout-single-path.guard` now fails on any reappearance); `FeeSummaryCard`, `handleGuestCheckout`, `rateLimitCreateOrder` deleted; migration **`20260922173229_fee_engine_drop_dead_tables.sql`** (drops `category_fee_config`, `game_fee_overrides`, `seller_tier_config.commission_rate`/`fee_multiplier`; `get_seller_tier_info` re-created returning `discount_pts`); types regenerated.

## Old → new copy (needs your approval BEFORE merge — nothing else invented)
| Surface | Old | New |
|---|---|---|
| Homepage WhyCard (`HomePage.tsx`) | "Sellers pay 5–10% — not the 17–26% the big marketplaces skim — so listings start cheaper here and stay cheaper." | "Some of the lowest seller fees in the market — sellers keep more of every sale, so listings start cheaper here and stay cheaper." |
| Homepage mobile strip + cards (`MobileHome.tsx` ×2) | "Sellers pay 5–10%, not the 17–26% others skim." | "Lowest seller fees — sellers keep more, so listings cost less." |
| /browse FAQ | "Sellers pay a 5–10% fee — far below the 17–26% the big marketplaces charge — so…" | "Sellers pay some of the lowest fees in the market — set per category and published on our Seller Fees page — so listings start cheaper here and stay cheaper." |
| Category page meta + OG + empty state (×3) | "…list in minutes at 5–7% fees." | "…list in minutes with low seller fees." |
| Root OG image | "Seller Fees From 5%" | "Lowest Seller Fees" |
| /buy landing sub-copy | "…pay commission only when it sells (from 5% for most categories), and…" | "…pay commission only when it sells, and…" |
| /buy landing FAQ (+JSON-LD) | "…5% for most currency, 7% for items, and 12–20% for accounts by risk band (see the Fees & Charges page)…" | "…Commission is set per category and can differ per game; the current schedule is published on the Seller Fees page…" |
| Blog SAB sell guide "What It Costs" | "…between 5% and 10%: items 7%, currency 5%/10% Roblox economies, top-ups 5%. …a $40 Secret costs you $2.80… The full schedule… on the [fees page](/fees)." | "…commission is set by category, with some game economies carrying their own rate. Brainrots sell as items, so the items rate applies… The current schedule… is on the [seller fees page](/sell/fees); payout fees are on the [fees page](/fees)." |
| Blog founding hooks (×2), Discord recruit embed, /[game]/sell FAQ + card, /[game]/sell description | "lock a lower commission / rate for life" | "get a discounted commission / rate for their first year" |
| /early-seller + /founding perk chip (×2), founding welcome email | "2% lower fees, locked for life" / "you keep 2% lower fees for life" | `FOUNDING_FEE_PERK_LABEL` = "Half-price commission for your first year" / "you get half-price commission for your first year" |
| /early-seller + /founding hero (×2) | "lower fees for life" | "a founding fee discount" |
| `FOUNDING_PERKS[0]` (config, unused) | "A permanently reduced commission — 2 points off every category rate, locked to your account for life." | "Half-price commission for your first year — the founding rate on every category, applied automatically to each sale." |
| /account/tiers hero + TierCard + admin seller detail | "Commission rate 10.0%" / "Platform fee 8.0%" | "Off your category rate −0.5 pts · floor 8%" / "Standard rate" (bronze) |
| /fees legal "Seller commissions" | five rows of 5/7/12–20% | rules paragraph + bullets, link to /sell/fees (buyer/withdrawal sections untouched) |
| Order detail "DropMarket Fee · 8%" fallback | `8` when subtotal is 0 | snapshot pct when present, else derived, else 0 |

"First year" = `platform_fee_settings.founding_months` (12). If you change that setting, change `FOUNDING_FEE_PERK_LABEL` too (one place).

## Gate (local stack, `.env.test`, after `supabase db reset` → `pnpm seed:games --env=local` → PR 1 seed + PR 4 file re-applied)
| Check | Result |
|---|---|
| `supabase db reset` (both PR 5 migrations apply from scratch, in order, after PR 4) + reseed | OK — 233 games / 405 pairs / 41 rules / 0 resolver gaps |
| `pnpm exec tsc --noEmit` | clean |
| Full `pnpm test` (serial files) | **1535 tests passed, 2 skipped (pre-existing coingate skips), 0 test failures** across 170 files. One file (`fee-migration-parity.guard`) failed its *teardown residue check* twice — the residue was a 3-user + 1-listing throwaway fixture that belonged to **another session running guard tests on the shared local stack** at the same time (ids differed per run, vanished on their own within seconds, 0 residue after every run). Rerun quiet: parity 14/14 + resolver 42/42, 0 residue. |
| `fee-admin-rules.guard.integration` (new) | 11/11 — 42501 for sessions, notice refusal, atomic close-and-insert (gap-free through the resolver), later-rule refusal writes nothing, cancel re-opens, promo start/end, unbounded promo refused |
| `fee-preview-parity.guard.integration` (new, §7.4) | 7/7 — preview == resolver == `seller_commission_pct` on real checkouts for one pair per type + Roblox-economy currency + banded account, × ranked / founding-active / founding-expired |
| `fee-copy.guard` (new, §7.3) | 22/22 — 19 pinned marketing files, allow-list with reasons, `/fees` seller section number-free |
| `fee-checkout-snapshot.guard` (405 real checkouts) / `fee-migration-parity` / `fee-resolver` / `fee-checkout-single-path` (+2 cases) | 12/12 · 14/14 · 42/42 · 6/6 |
| `payssion.test.ts` / `dispatch.test.ts` / `db-p0-grants` / `table-posture` | 32/32 · pass · 57/57 · 9/9 |
| `node scripts/check-public-route-caching.mjs` | 40 public routes OK (`/sell/fees` included) |
| Skeletons | no existing page layout changed (numbers replaced in place); `/sell/fees` is static, no loading.tsx needed |
| "escrow"/"hold" wording | none added |

## Manual steps
1. Approve (or edit) the copy table above; every line is one string.
2. Merge order: PR #83 → #84 → #86 must be live first. `supabase db push` from this branch applies `20260922163106` then `20260922173229` (**irreversible**: drops the two dead tables + two columns). Do it with the deploy — until the deploy, nothing calls the new functions; after the deploy, `/admin/games/[id]/edit` → Fees needs `fee_rule_schedule_base`, and `/account/tiers` needs the re-created `get_seller_tier_info` (the old one still answers with `commission_rate`, which the page no longer reads — safe either way).
3. After push: `SELECT to_regclass('public.category_fee_config');` → NULL; `SELECT public.get_seller_tier_info('<a seller id>')->>'discount_pts';` → a number.
4. First admin fee edit: check `fee_config_audit` gained a row with your id as `actor`, then reload `/sell/fees` and the game's `/[game]/sell` title.
5. Local stacks after `supabase db reset`: same re-seed recipe as PR 4 (`pnpm seed:games --env=local`, re-apply `20260921201844`, re-apply `20260922001513`); the two PR 5 migrations need nothing extra.

## Flags
- The wizard preview says "Your exact fee is shown at checkout" (no number) if the resolver errors — never a constant (A4 posture).
- `/sell/fees` shows the "from <date>" column only while a dated base rule exists (PR 4's start until it lands); after that the column disappears on the next revalidate.
- Withdrawal / buyer-fee numbers on `/fees` are untouched (PR 7); `fee-copy.guard` deliberately does not pin `documents.ts` beyond the seller section.
