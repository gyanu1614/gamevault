-- Growth point 28 follow-up: when a value page was first seen.
--
-- Owner 2026-10-10: a brand-new value page with 5+ offers shows in Google at
-- once; the 7-days-of-history rule applies only after its first week. The gate
-- needs to know a page's age, so seo_value_evidence records it. Backfilled by
-- the next evidence refresh from the item's earliest price-history day.
-- Additive, nullable: older code ignores it. Keeps the table's existing grants
-- (anon/authenticated SELECT; writes service-role only).
alter table public.seo_value_evidence add column if not exists first_seen_at timestamptz;

comment on column public.seo_value_evidence.first_seen_at is
  'When we first saw a price for this page (earliest history day, else the first refresh). Pages under 7 days old pass the data gate on offers alone.';
