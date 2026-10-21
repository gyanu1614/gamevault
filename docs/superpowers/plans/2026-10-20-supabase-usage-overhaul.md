# Supabase Usage Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Get the Supabase org back under the Free-plan quotas before the 2026-10-22 restriction and keep it there as traffic grows: database < 450 MB, egress < 2 GB/month, no Disk IO spikes.

**Architecture:** Supabase holds only live data and final prices. Heavy work (crawls, price maths, rollups, backups) runs on GitHub runners and writes results only. Everything visitors see (pages, images, price data) is served and cached by Vercel, refreshed by events, not by the clock.

**Spec / evidence:** `docs/handoff/supabase-usage-audit-2026-10-20.md` (4-agent code audit with file:line). Live check 2026-10-20: **DB 793 MB / 500 MB**. `sab_market_raw_listings` 310 MB, `values_raw_listings` 188 MB, `sab_price_history` 97 MB, `adopt_me_market_raw_listings` 79 MB.

## Global constraints
- pnpm only. One worktree (`.claude/worktrees/usage-overhaul`, branch `perf/supabase-usage-overhaul` and follow-ups).
- **Never** run dev/build/tests against prod `.env.local`. Tests and builds use this worktree's local stack (`pnpm db:up`, `pnpm test:reset`).
- Prod data writes and `db push` are the owner's: the plan gives the commands.
- Release ONLY on the owner's word RELEASE. "Merge" = PR + merge + note.
- Migration timestamps = real current second, ordered after their dependants. New SQL functions are service-role-only unless granted. SECURITY DEFINER pins `search_path = public`.
- Money seams untouched (single-RPC rule). Every new money-adjacent change gets a test.
- Files ≤ ~400 lines; split above 500. Shared helpers over copies.
- Each task = failing test first → fix → green → `tsc` → targeted suite → commit. One heavy process at a time (8 GB Mac).

## When each change takes effect
| Kind | Live when |
|---|---|
| GitHub workflow / `scripts/*` / `pnpm reprice` code | on merge to main (runners check out main) |
| SQL migration | on the owner's `supabase db push` |
| Pages, Vercel crons, API routes | on RELEASE (release branch). Note: release also ships #203/#206, whose 2 db pushes must go first |

---

## Phase 0 — Emergency space (owner runs SQL, today)
Target: DB ≈ 380–450 MB. Script: `docs/handoff/supabase-space-cleanup-2026-10-20.sql`.
- [ ] 0.1 Delete dead raw rows: `values_raw_listings` inactive and > 3 days old (the pipeline reads only active rows inside FRESH_WINDOW_HOURS). `adopt_me_market_raw_listings` ended > 7 days ago (reprice reads only `active`). No FKs or readers.
- [ ] 0.2 Slim `sab_market_raw_listings.raw_payload` to the 4 keys anything reads (`title`, `seller_sales_count`, `is_canonical_band`, `income_band.upper`; readers: `src/lib/pricing/games/sab.ts:384-387`, `scripts/check-sab-price-drift.mjs`, `scripts/audit-sab-cheapest.mts`).
- [ ] 0.3 `VACUUM FULL` the three tables one at a time, outside a pricing run. Re-check `pg_database_size`.

## Phase 1 — Jobs and database (PR A: merge + db push)
- [x] 1.1 **G2G double publish** (C2): `--no-publish` at `scripts/collect-g2g-sab.mjs:646`. Test: a unit test on the spawned args.
- [x] 1.2 **Steal an Egg retire bug** (B3): `.eq('is_active', true)` at `scripts/lib/sae-write.mjs:173-177`. Test: the retire query filter.
- [x] 1.3 **Import function** (B1/C3), migration `create or replace sab_import_market_listings`:
  - store the slim payload;
  - don't re-assign `title` on conflict when it is unchanged (stops the parse trigger);
  - skip rows whose price, status and quantity are unchanged (refresh only `observed_at` via a narrow update).
  - Test: integration on the local stack (import twice → second import writes no full row; payload keys = 4).
- [x] 1.4 **Retention** (B2/B4/C4): migration that makes the `sab_roll_up_raw_listings` predicate sargable (`observed_at < cutoff::timestamptz`). Add `raw_market_prune()` (service role) deleting `values_raw_listings` inactive > 3 d and `adopt_me_market_raw_listings` ended > 7 d, batched. Called from `sab-retention-nightly.yml`. Test: integration with aged fixtures.
- [x] 1.5 **Keyset paging** (C1/C5/A9): one shared helper (`selectAllByKey`, `src/lib/supabase/keyset.ts`) replacing OFFSET `.range()` in `sab.ts selectPage`, `adopt-me.ts`, `values-pipeline.ts`. Test: unit with a fake client (page seams, no dupes, stops on short page).
- [x] 1.6 **SAB catalogue read** (C1): read `sab_price_display` / one RPC instead of paging the non-inlinable `sab_public_price_catalog` view per 1000 rows. Test: reprice parity on a fixture.
- [x] 1.7 **`seo_value_series`** (C6): stop paging the RPC with `.range()` (one call, or a date window). Test: refresh unit.
- [x] 1.8 **Duplicate / dead indexes** (B5/B8; `valid_price_idx` and `pending_idx` kept until idx_scan has a full day of stats): drop `sab_price_history_variant_time_idx` (dup of unique key), `adopt_me_price_history_pet_variant_date_idx`, `idx_listings_category_id`, `idx_listings_slug`, `sab_market_evidence_display_variant_idx`, and the SAB raw `source_idx` and `valid_price_idx` (no code path). idx_scan stats reset at today's restart, so each drop is justified by code search, not the stats.
- [x] 1.9 **seo-hourly** (A8): inspection batch every 3rd UTC hour (8/day, still covers the sitemap); IndexNow stays hourly. The duplicate Vercel `seo-gsc` cron goes in Phase 2 (release-side).
- [x] 1.10 **Backup** (A10): exclude rebuildable and log tables.
- [x] 1.11 **Recompute filters** (C9): `sab_publish_market_estimates` UPDATE only active rows; `sab_recompute_tradeable` only changed rows.
- [x] 1.12 **Pricing workflow order**: checked, no change. With 1.1 the G2G import no longer runs the heavy chain; the SAB reprice runs alone at the end of `sab` and `adopt-me` already `needs: sab`. Serialising SAE/MM2 would only lengthen the run.

## Phase 2 — Pages and caching (PR B: RELEASE)
- [ ] 2.1 **Footer 1-hour cap** (A2/A5): resolve test-seller ids inside the cached callback, raise to 86400. Test: build manifest shows 604800/86400 (local stack build), and a unit test that the footer's cache entry has no 3600 window.
- [ ] 2.2 **Nightly revalidate cron** (A5): category and hub route patterns only, no site-wide tags.
- [ ] 2.3 **SAB snapshot cron** (A6/B5): drop the 498-path `revalidatePath` loop and the duplicate history write.
- [ ] 2.4 **Value item pages** (A4): one shared per-game catalogue read (single cache entry), history capped to a date window, SAB history ordered newest-first (fixes the "oldest 1000 rows" chart bug).
- [ ] 2.5 **List pages** (A13): `/adopt-me/blog` stat strip and calculators read bounded windows.
- [ ] 2.6 **Sitemaps** (A8/A13): one cached sitemap input shared by the 10 sections.
- [ ] 2.7 **/browse** (A7): explicit columns instead of `*` + full joined rows (pagination already merged in #210).
- [ ] 2.8 **Navbar** (A11): `config->>currency_icon_url` instead of the whole `category_configs`; spotlight games only when the menu opens.
- [ ] 2.9 **/shop/[slug]** (A12): revalidate 3600 + tag revalidation.
- [ ] 2.10 **Listing views** (C7): counter in its own small table (no listings row rewrite); drop the two `view_count` indexes. Migration + action change.
- [ ] 2.11 **Value beacons** (C8): stop the DB insert per view (PostHog already records it), or batch.
- [ ] 2.12 After release: confirm in API logs that cached reads (`rpc/footer_game_activity`) run ~1–2×/day (A3).

## Phase 3 — Images (PR C: RELEASE + one backfill)
- [ ] 3.1 Footer and nav icons use the existing `-64.webp` variant.
- [ ] 3.2 Thumbnails at upload (listing images, values art, blog covers) + an owner-run backfill script; cards use thumbnails.
- [ ] 3.3 Store banner cache header; static art (hero, item art) served by Vercel where it is fixed.

## Phase 4 — Signed-in load (PR D: RELEASE)
- [ ] 4.1 AuthProvider: no profile re-read on visibility SIGNED_IN when the user id is unchanged; select needed columns.
- [ ] 4.2 Navbar polls lean on realtime; `admin_roles` cached; conversations index.
- [ ] 4.3 Order chat 60 s floor; post-payment refresh backoff; pay poll pauses when hidden.
- [ ] 4.4 Seller messages: one query instead of 1+N+1; filtered realtime channel.
- [ ] 4.5 Presence heartbeat throttle; `/account/orders` seller query gated.
- [ ] 4.6 Intent prefetch: `kind: auto` (no full render of dynamic pages on hover).

## Phase 5 — Large files (one PR per area, behaviour-preserving)
Rule: split by responsibility into named units. Components `PascalCase` (one per file), hooks `useThing`, server-only helpers in `*.server.ts`, route-private helpers in the route's `_lib/`, shared logic in `src/lib/<domain>/`. Function names say what they do: `loadSabCatalogue`, `buildPriceRows`, `formatPayoutRail`. Target ≤ 400 lines per file. Each split: tsc + tests + one local-stack browser pass for UI.

Order (usage-related first, money code last and most carefully):
1. `src/components/navbar-floating.tsx` (2771)
2. `src/lib/api/seller-compatible.ts` (1568)
3. `src/app/(marketplace)/[gameSlug]/[categorySlug]/page.tsx` (1061)
4. `scripts/collect-eldorado-sab-api-v6.mjs` (2105), `src/lib/sab/price-correction.ts` (1298)
5. `[gameSlug]/calculator/_CalculatorClient.tsx` (1625), `_CurrencyPageClient.tsx` (1264), `_BundleCurrencyPageClient.tsx` (1137), `_ListingDetailClient.tsx` (1400), `inventory/_InventoryTool.tsx` (1003)
6. Admin: `ModerationPageClient.tsx` (1400), `SellerDetailClient.tsx` (1258), `ApplicationDetail.tsx` (1230), `GameWizard.tsx` (1092), `admin-seller-review.ts` (1178)
7. Account / auth / home: `account/listings/page.tsx` (1356), `AuthDialogBody.tsx` (1221), `SellerCtaCard.tsx` (1030)
8. Content: `src/lib/email/index.ts` (1485, one file per email), `src/lib/legal/documents.ts` (1795, one file per document)
9. Money (extra care, traced first): `sell-wizard.ts` (1300), `orders.ts` (1139), `CheckoutForm.tsx` (1450), `_PayClient.tsx` (1054)

Skip: `src/types/database.types.ts` (generated), `_ogFallback.ts` (embedded image data).

## Phase 6 — Verify everything after release
- [ ] Every GitHub job: one manual `workflow_dispatch` run each, green, timings recorded.
- [ ] Supabase: DB size, egress/day, Disk IO budget, API requests/day, compared with the 2026-10-09 baseline.
- [ ] Record results in the SESSION memory file.
