# Post-deploy fix 1 — handoff (after batch 1, PRs #87–#91)

**Date:** 2026-09-23/24 · **Branch:** `fix/post-deploy-1` (worktree `../gamevault-postdeploy`) · **PR:** https://github.com/gyanu1614/gamevault/pull/93 · **Not merged, no `db push` run.** No layout changes beyond the requested columns.

## Commits (one per part)
1. `96c7d187` **/sell/fees per-game "From <date>"**: `getPublicFeeSchedule` lists pairs whose own rule is active now OR at `nextChange`, resolved at both instants (parallel RPCs). Same header, `formatScheduleDateUtc` and show-while-it-moves-a-rate rule as the category table, so the column disappears once the date passes. Guards: `fee-copy` renders the page from fixtures and pins its source against literal rates; `fee-preview-parity` checks page == `resolve_seller_fee(NULL)` now and at `nextChange` for every ruled pair (red on old code: 23 pairs missing locally).
2. `fa9eb771` **withdrawal_methods spec UPSERT** + `withdrawal-methods-spec.guard` (rows == spec; replays the migration on prod's pre-fix shape inside a rolled-back psql transaction: spec restored, PayPal hidden with its fees intact, a legacy BTC row's fees aligned but visibility untouched, one audit row per change, second run a no-op).
3. `8eebeeee` **/admin/fees coming-soon switch**: "Coming soon" checkbox beside "Active" → `withdrawal_methods_set_fees(p_coming_soon)`, audited. Subtitle = the real state (`payoutMethodState`): **live** (active) · **coming soon** (active + coming soon: listed but disabled) · **hidden** (inactive; RLS hides it whatever coming_soon says). The guard proves each label equals what a seller session gets.
4. `8ae3f1b1` **Withdraw page**: Payoneer draws its own gradient ring in CSS (colour stops sampled from the existing PNG; no new asset). The stacked logo PNG made the wordmark an unreadable smudge at badge size. Step 1 copy below. `CoinBadge.test` covers every branch.
5. `169ed5f9` **payout-encryption.test**: key = `randomBytes(32)` per run (env restored after); sample = a TRON-format address generated at runtime (0x41 + 20 random bytes + sha256d, Base58). +1 check that the fixture validates; other assertions unchanged.

## The one migration: `20260924043931_withdrawal_methods_spec.sql`
- §1 UPSERT by `method_name`: **payoneer** fiat 3% · $0 · min fee $5 · $100–$25,000 · live · sort 5 · **usdt_trc20/erc20/polygon** 3% + $5 · min fee $0 · $50–$25,000 · live · sort 10/20/30 (plus display name, description, processing time, icon). Rows already equal are skipped; each change gets one `fee_config_audit` row (actor NULL, note `post-deploy-1: …`).
- §2 every other fiat row (paypal, bank): only `is_active=false, coming_soon=true`. §3 any other crypto row (pre-baseline btc/eth/usdc on prod?): only the shared fee terms 3% + $5 / $50; visibility untouched.
- §4 `withdrawal_methods_set_fees` 8-arg dropped, 9-arg (`p_coming_soon DEFAULT NULL`) created, service-role only. Old code's 8 named args still resolve, so pushing before the deploy is safe.
- Sorts after main (`…184455`) and after #92's `20260923185256`. If #92 is pushed **after** this, `supabase db push` refuses the older file → use `supabase db push --include-all`.

## Copy: old → new (needs approval)
| Surface | Old | New |
|---|---|---|
| Withdraw page, "How Payouts Work" step 1 | "1. Pick the coin and network you want to be paid in." | "1. Choose how you want to be paid: crypto (pick the coin and network) or Payoneer." |
| /sell/fees per-game table header (only while a dated change exists) | "Rate" | "Rate now" + "From 7 October 2026" column; cells "10%" / "unchanged" (same strings as the category table) |
| /admin/fees method subtitle (admin only) | "payoneer · fiat · coming soon" | "live · payoneer" / "coming soon · …" / "hidden · …"; new column "Coming soon" |

## Tests (fresh isolated local stack + PR 4/5 reseed recipe, `.env.test`)
| Check | Result |
|---|---|
| `pnpm exec tsc --noEmit` | clean |
| Full `pnpm test` (integration incl.) | **192 files passed, 1 skipped (coingate live API) · 1703 tests passed, 2 skipped, 0 failed**; guard residue 0 after the run |
| New / extended | `withdrawal-methods-spec` 7/7 · `fee-copy` 27/27 (+3 render, +1 pinned file) · `fee-preview-parity` 8/8 (+1) · `CoinBadge` 4/4 · `payout-encryption` 6/6 |
| Asked-for gates | `db-p0-grants` 57/57 · `table-posture` 10/10 · `fee-legal-withdrawal-parity` 3/3 · `withdrawal-rules` 10/10 · `money-atomicity` 18/18 · `fee-checkout-snapshot` 12/12 |
| `node scripts/check-public-route-caching.mjs` | 40 public routes OK |
| Red on old code | parity: 23 ruled pairs missing from /sell/fees · render: per-game head lacked the column · CoinBadge: PNG branch |

Stack: the shared `:54321` stack carries #92's unmerged migration, so this ran on a separate stack (`project_id gamevault-postdeploy`, ports 544xx, started lean). Those `config.toml` / `.env.test` edits are local and **not committed**.

## Manual steps
1. Approve the copy table. Merge.
2. **Before pushing, read prod once** (my read was blocked, so the §3 rows are unverified): `SELECT method_name, method_type, is_active, coming_soon, fee_percentage, fee_fixed, fee_min, min_withdrawal, max_withdrawal, sort_order FROM withdrawal_methods ORDER BY sort_order;` If btc/eth/usdc rows are **live**, note that /fees says "Crypto payouts (USDT)". Hiding them is your call (/admin/fees → untick Active), not this migration's.
3. `supabase db push` **then** deploy. With the old 8-arg function, the new admin Save would fail until the push; the reverse order is safe.
4. After push: `SELECT key, new_value->>'note' FROM fee_config_audit WHERE new_value->>'note' LIKE 'post-deploy-1%';` expect payoneer (sort 200 → 5, description, etc.) plus any fiat/crypto row that differed; a re-run writes nothing.
5. **/admin/fees → Withdrawal methods:** Payoneer `live · payoneer` 3 / 0 / 5 / 100 / 25000, Active ✓, Coming soon ☐. Each USDT row `live` 3 / 5 / 0 / 50 / 25000. PayPal and bank `hidden`, Active ☐, Coming soon ✓. Tick Coming soon on one row, Save, check the new audit row (actor = you, `coming_soon` false → true), then untick and Save.
6. **/sell/fees:** per-game table reads `Rate now | From 7 October 2026` (prod start = `SELECT min(starts_at) FROM fee_rules WHERE note LIKE 'PR4:%'`). Every pair with a rule starting that day is listed (Roblox economies → 10%, CoD/Fortnite/R6 accounts → 15%). After 7 Oct the column goes on the next revalidate, like the category table's. "Getting paid" shows Payoneer 3% (minimum fee $5), $100.
7. **Withdraw page:** the Payoneer tile shows the rainbow ring; step 1 names Payoneer.
