# Order numbers — DM-XXXX-XXXX handoff

**Date:** 2026-09-21 · **Branch:** `feat/order-number-dm` (worktree `../gamevault-order-number`) · **PR:** https://github.com/gyanu1614/gamevault/pull/85 · **Not merged. ⚠️ `db push` REQUIRED** (migration `20260921234649`). No fee logic, rates, layout or copy touched beyond the number itself.

## What changed (5 commits + this file)
1. **Migration `20260921234649_order_number_dm_format_search_key.sql`** — `generate_order_number()` now returns `DM-` + 4 + `-` + 4 symbols from the same 32-symbol alphabet (no 0/O/1/I), same `gen_random_bytes` source, same existence loop + `RAISE` after 5 misses, same `SECURITY DEFINER`/`search_path`/service-role-only grants. Existing `GV-` numbers untouched. Adds `orders.order_number_search` (STORED generated: upper-case, every non-alphanumeric stripped) + `orders_order_number_search_idx` (btree `text_pattern_ops`; no `pg_trgm` on this DB, so contains-matches still scan — table is small). Self-check: format, 1000-draw uniqueness, grants, generated column, expression parity with the TS helper, index. `NOTIFY pgrst` so the column is filterable at once. Local: 20 000 draws → 20 000 distinct. `src/types/database.ts` regenerated (+4 lines).
2. **Display swaps removed** — `account/orders/[orderId]/page.tsx`, `account/orders/page.tsx` (also dropped the `#`-and-strip-prefix render), `chat/ChatInterface.tsx` now render `displayOrderRef(order_number, id)` = stored number, else 8-char id prefix. GV- orders display as issued (unit-tested).
3. **Normalised lookups** — `src/lib/orders/order-number.ts` (`normalizeOrderNumber`, `orderNumberSearchPattern`, `displayOrderRef`, `ORDER_NUMBER_RE`). Six sites: `admin-orders.ts` list search, `EnhancedAdminHeader.tsx` entity search, `seller-compatible.ts` ×2 seller order lists (all `ilike('order_number_search', %KEY%)`), plus client filters in `account/orders/page.tsx` and `account/messages/page.tsx`. `"dm abcd efgh"`, `"DMABCDEFGH"`, `"gv 123 456"` all hit. Symbol-only query matches nothing (was: nothing; never "everything"). Side benefit: the key is alphanumeric, so no ilike/PostgREST metacharacter reaches the filter string any more.
4. **Provider description fields** — `CreateChargeInput.orderNumber`. Sites changed: Payssion `description` (was 8-char UUID prefix), BTCPay `metadata.itemDesc` (was full UUID), CoinGate `title` (was full UUID) → `DropMarket order <order_number>`. Machine links (`track_id`/`order_id`, `metadata.orderId`, `order_id`) unchanged. `checkout.ts` selects `order_number` on the insert (`runOrderInsert` passes it through), the raced-order and retry-payment reads, and passes it to all three `createCharge` calls. `dispatch.ts` admin notice (`orderId.slice(0,8)`) left alone — admin-facing, not a provider field.
5. **Tests** — `order-number.test.ts` (11, unit: regex, display of DM/GV/none, normalisation, pattern); `order-number.guard.integration.test.ts` (7: 200 distinct DM draws, trigger stamps DM, GV row reads back as issued, DB↔TS normalisation parity, lookup hits DM and GV through every typed variant, partial + symbol-only); provider tests +3 each (DM, GV, fallback); `order-insert.test.ts` +1 (passthrough); `fee-checkout-snapshot.guard` two regex assertions → `ORDER_NUMBER_RE`.

## Gate (local stack, `.env.test`)
| Check | Result |
|---|---|
| `supabase db reset` (migration applied in order after `20260921230440`, self-check passed) | ✓ |
| `pnpm exec tsc --noEmit` | clean |
| Full `pnpm test` | 166 files / 1478 tests passed, 1 file + 2 tests skipped (pre-existing); zero guard-test residue after |
| `payssion.test.ts` / `dispatch.test.ts` | 32/32 · 6/6 |
| `order-number.guard.integration` / `fee-checkout-snapshot.guard` | 7/7 · 12/12 |

First full run showed 2 failures in `fee-migration-parity` + snapshot PARITY: the documented fresh-stack ordering (fee seed migration runs before `seed:games` adds pairs; header of `fee-migration-parity.guard`). Re-applied `20260921201844_fee_engine_seed_current_rates.sql` once via psql → both green; re-ran the full suite for the number above. Not caused by this PR; production has the catalogue so `db push` does it in one pass.

## Manual steps for Gyanu
1. `supabase db push` (applies `20260921234649`), then in the SQL editor: `SELECT public.generate_order_number();` → `DM-XXXX-XXXX`; `SELECT count(*) FROM orders WHERE order_number_search IS NULL AND order_number IS NOT NULL;` → 0; `SELECT indexname FROM pg_indexes WHERE indexname='orders_order_number_search_idx';` → 1 row.
2. Deploy order: push the migration BEFORE or WITH the deploy. Old code + new DB is fine (readers treat the column as opaque; the display swap regex is prefix-only). New code + old DB is NOT: every `ilike('order_number_search', …)` 400s until the column exists — the admin/seller searches would error.
3. Smoke after deploy: admin header search for an old order typed as `gv 123456` and a new one typed lower-case without dashes; open one GV- order page (renders `GV-…`, not `DM-…`).
4. Rollback: revert the app commits; the migration's header has the SQL to restore the GV- generator and drop the column/index (both harmless to keep).

## Open flags
- Numbers issued between `20260921230440` going live and this push are `GV-` + 10 symbols; they stay valid and searchable, just visibly older-format.
- Contains-search on the search key is a scan (btree serves exact/prefix). Add `pg_trgm` + a GIN index if the admin search ever gets slow.
- `docs/checkout.md` not updated (the number's shape is not documented there; only the migration header and this file describe it).
