-- ============================================================================
-- Fix zombie listings: reset ended_at when a listing re-activates
-- ============================================================================
-- The import RPC's `on conflict do update` sets listing_status from the incoming
-- crawl but never touches ended_at. So a listing that expire-sab-listings marked
-- 'ended' (with ended_at set), then reappeared in a later crawl, flips back to
-- 'active' while KEEPING its stale ended_at — a "zombie" that is active yet
-- carries an end timestamp. The reputable-pricing correction filters on
-- listing_status only, so it re-admits these, but the mixed state is a landmine
-- for any future ended_at-aware logic (snapshots, expiry, monitors).
--
-- Rather than copy-and-patch the ~400-line import RPC, a small BEFORE trigger
-- keeps ended_at consistent with listing_status on every write, from any writer:
--   active  -> ended_at must be NULL
--   ended   -> stamp ended_at if the caller didn't
--
-- Also backfills the current table so today's zombies are cleaned immediately.
-- Safe to re-run.
-- ============================================================================

begin;

create or replace function public.sab_sync_ended_at()
returns trigger
language plpgsql
as $$
begin
  if new.listing_status = 'active' then
    -- An active listing has not ended.
    new.ended_at := null;
  elsif new.listing_status = 'ended' and new.ended_at is null then
    -- Just ended and the caller didn't stamp it — stamp now.
    new.ended_at := now();
  end if;
  return new;
end
$$;

comment on function public.sab_sync_ended_at() is
  'Keeps sab_market_raw_listings.ended_at consistent with listing_status on '
  'every insert/update: active => NULL, ended => stamped. Fixes zombie rows '
  'that re-activated but kept a stale ended_at.';

drop trigger if exists sab_sync_ended_at_trg on public.sab_market_raw_listings;
create trigger sab_sync_ended_at_trg
  before insert or update on public.sab_market_raw_listings
  for each row execute function public.sab_sync_ended_at();

-- Backfill: clear ended_at on rows that are active but carry a stale timestamp.
update public.sab_market_raw_listings
set ended_at = null
where listing_status = 'active'
  and ended_at is not null;

commit;
