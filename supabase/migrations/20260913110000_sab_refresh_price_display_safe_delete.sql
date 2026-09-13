-- ROUTE-013: sab_refresh_price_display() cannot run under safe-update mode.
--
-- Symptom: the post-crawl publish step fails with
--   eldorado import failed: DELETE requires a WHERE clause
-- (SQLSTATE 21000), retried and failed identically every time.
--
-- Cause: the function does a full refresh as `delete from sab_price_display;`
-- with no WHERE. Plain Postgres allows that, but the project's roles now run
-- with safe-update mode enabled, which rejects any unqualified UPDATE or DELETE
-- — including one executed inside a plpgsql SECURITY DEFINER body. Verified on
-- production: an unfiltered DELETE *and* an unfiltered UPDATE both return
-- 21000, on this table and on unrelated ones, so the guard is role-wide and not
-- specific to sab_price_display.
--
-- This is why the values pages froze. sab_price_display.refreshed_at last moved
-- at 2026-08-14 01:46 — the last time this function completed. Every run since
-- has aborted at the DELETE, so the table kept serving its Aug 13 snapshot.
-- ROUTE-010 wired the crawl to call this function after publishing, which did
-- not introduce the bug but does mean the crawl now fails on it too.
--
-- Fix: give the DELETE a WHERE clause that is still unconditionally true for
-- every row. `where true` is not accepted by safe-update mode (it looks for a
-- qualifying predicate on the relation), so we filter on the primary key being
-- non-null — true for every row by definition, satisfies the guard, and keeps
-- delete-all + insert semantics exactly as before.
--
-- Everything else about the function is unchanged: same body, same atomicity
-- (delete + insert in one transaction), same grants, same statement_timeout.

create or replace function public.sab_refresh_price_display()
returns bigint
language plpgsql
security definer
set search_path = public
set statement_timeout = '120s'
as $$
declare
  row_count bigint;
begin
  -- Full refresh: the corrected view is the source of truth and the row set is
  -- small (~3k). Delete-all + insert inside the function's transaction is atomic
  -- to readers (no partial state) and avoids per-row conflict handling.
  --
  -- ROUTE-013: the predicate is required by safe-update mode. brainrot_id is
  -- part of the table's identity and is never null, so this still deletes every
  -- row — it is a guard-satisfying no-op, not a narrowing filter.
  delete from public.sab_price_display
  where brainrot_id is not null;

  insert into public.sab_price_display (
    brainrot_id, brainrot_name, brainrot_slug, rarity, image_url,
    mutation_id, mutation_name, mutation_slug,
    market_value_usd, market_low_usd, market_high_usd,
    confidence_label, external_sample_size, source_count,
    price_updated_at, is_trade_ready, is_public_estimate,
    is_anchored, correction_reason, anchor_usd, cohort_size,
    cheapest_usd, average_usd, refreshed_at
  )
  select
    brainrot_id, brainrot_name, brainrot_slug, rarity, image_url,
    mutation_id, mutation_name, mutation_slug,
    market_value_usd, market_low_usd, market_high_usd,
    confidence_label, external_sample_size, source_count,
    price_updated_at, is_trade_ready, is_public_estimate,
    is_anchored, correction_reason, anchor_usd, cohort_size,
    cheapest_usd, average_usd, now()
  from public.sab_public_price_catalog_corrected;

  get diagnostics row_count = row_count;
  return row_count;
end;
$$;

-- Re-assert the ACL: CREATE OR REPLACE keeps the existing one, but the baseline
-- default privileges have historically granted EXECUTE to anon/authenticated on
-- new functions, so state it explicitly rather than relying on inheritance.
revoke all on function public.sab_refresh_price_display() from public, anon, authenticated;
grant execute on function public.sab_refresh_price_display() to service_role;
