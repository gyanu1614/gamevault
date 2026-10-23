-- One match log for marketplace names that don't match a catalogue item exactly
-- (owner, 2026-10-23: "a small change in Eldorado shouldn't break").
--
-- Exact matching stays first in every price run. What it leaves over is
-- resolved here (scripts/lib/name-match.mjs + market-names.mjs):
--   auto       the run paired the name with an item (near-identical spelling,
--              clear lead, item not already matched); used from then on
--   confirmed  an admin confirmed or linked it (Values tab); used from then on
--   rejected   an admin said no; never matched automatically again
--   unmatched  no confident item yet; `suggestions` holds the closest ones and
--              `offers` how many listings use the name, for review + alerts
-- `market_name` is the market's own identity: Adopt Me = Eldorado's "Item
-- name"; values_items games = the structured market key (type|variant|name).
-- Written by the price jobs and the admin actions with the service role only.

create table if not exists public.market_name_matches (
  game_slug     text not null,
  source        text not null default 'eldorado',
  market_name   text not null,
  item_slug     text,
  status        text not null,
  score         numeric(4,3),
  suggestions   jsonb not null default '[]'::jsonb,
  offers        integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  decided_by    uuid references auth.users(id) on delete set null,
  decided_at    timestamptz,
  constraint market_name_matches_pkey primary key (game_slug, source, market_name),
  constraint market_name_matches_status_check check (status in ('auto', 'confirmed', 'rejected', 'unmatched')),
  constraint market_name_matches_item_check check (status = 'unmatched' or item_slug is not null or status = 'rejected')
);

comment on table public.market_name_matches is
  'Marketplace names that exact matching missed: automatic close matches, admin decisions and the unmatched review list. Price jobs + admin only.';

create index if not exists market_name_matches_review_idx
  on public.market_name_matches (game_slug, status, last_seen_at desc);

alter table public.market_name_matches enable row level security;
revoke all on table public.market_name_matches from anon, authenticated;
grant select, insert, update, delete on table public.market_name_matches to service_role;
