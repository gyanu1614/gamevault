-- Drop duplicate and dead indexes (2026-10-20 usage audit, B5/B8).
--
-- Each costs disk on a 500 MB plan and a write on every insert/update of its
-- table. Every lookup stays indexed by the index named on the right. The
-- justification is the schema and a code search, not idx_scan: the stats were
-- reset by the 2026-10-20 restart.

-- = UNIQUE (brainrot_id, mutation_id, history_date); a btree scans either
-- direction, so the DESC copy adds nothing (21 MB live).
drop index if exists public.sab_price_history_variant_time_idx;

-- = UNIQUE (pet_id, variant, history_date), same reason.
drop index if exists public.adopt_me_price_history_pet_variant_date_idx;

-- Identical to listings_category_id_idx (both btree on category_id).
drop index if exists public.idx_listings_category_id;

-- UNIQUE listings_slug_key already indexes every slug lookup.
drop index if exists public.idx_listings_slug;

-- (brainrot_id, mutation_id) is a strict prefix of
-- sab_market_evidence_display_group_idx; the table is rebuilt twice a day.
drop index if exists public.sab_market_evidence_display_variant_idx;

-- (source_id, fetched_at desc), 51 MB live: no query filters on source_id
-- ordered by fetched_at (the freshness lookups use the variant index, the
-- expire job keysets on id, the reparse orders by fetched_at with no source).
drop index if exists public.sab_market_raw_listings_source_idx;
