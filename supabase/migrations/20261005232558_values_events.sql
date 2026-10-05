-- MM2 Events archive (2026-10-05): one row per in-game event (Halloween 2015 →
-- Halloween 2026 upcoming), for /<game>/events and /<game>/events/<event>.
-- Researched seed: scripts/values-seeds/murder-mystery-2.events.json, loaded
-- by `pnpm values:mm2:events` (service role), so an event can be added or
-- corrected without a deploy.
--
-- Posture is values_items' (20260918225751 §8): RLS on, anon/authenticated
-- SELECT of published rows only, no write grants — the loader writes with the
-- service role. No functions, so no EXECUTE grants to review.
--
-- Additive and idempotent. Safe to push before the code that reads it.
--
-- Rollback: drop table public.values_events;

create table if not exists public.values_events (
  id                      uuid primary key default gen_random_uuid(),
  game_id                 uuid not null references public.games(id) on delete cascade,
  slug                    text not null,
  name                    text not null,
  season                  text not null,
  year                    smallint not null,
  status                  text not null,
  starts_on               date,
  ends_on                 date,
  currency                text,
  format                  text,
  summary                 text not null,
  how_items_were_obtained text,
  -- [{ name, slug|null, kind, rarity|null, how|null }] — item slugs resolve to
  -- values_items at read time (prices stay live).
  items                   jsonb not null default '[]'::jsonb,
  sources                 jsonb not null default '[]'::jsonb,
  confidence              text not null default 'high',
  checked_at              date not null,
  is_published            boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint values_events_game_slug_key unique (game_id, slug),
  constraint values_events_season_check
    check (season in ('halloween','christmas','easter','valentines','summer','anniversary','collab','other')),
  constraint values_events_status_check check (status in ('ended','live','upcoming')),
  constraint values_events_confidence_check check (confidence in ('high','medium','low')),
  constraint values_events_year_check check (year between 2012 and 2100),
  constraint values_events_dates_check check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint values_events_items_array_check check (jsonb_typeof(items) = 'array'),
  constraint values_events_sources_array_check check (jsonb_typeof(sources) = 'array')
);

create index if not exists values_events_game_start_idx
  on public.values_events (game_id, year desc, starts_on desc nulls first);

alter table public.values_events enable row level security;

drop policy if exists values_events_public_read on public.values_events;
create policy values_events_public_read on public.values_events
  for select to anon, authenticated using (is_published);

revoke all on public.values_events from anon, authenticated;
grant select on public.values_events to anon, authenticated;

drop trigger if exists values_events_touch_updated_at on public.values_events;
create trigger values_events_touch_updated_at
  before update on public.values_events
  for each row execute function public.values_touch_updated_at();

-- Proof: published rows are readable, nothing is writable by a session role.
do $$
begin
  if not has_table_privilege('anon', 'public.values_events', 'SELECT') then
    raise exception 'values_events: anon cannot read';
  end if;
  if has_table_privilege('anon', 'public.values_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.values_events', 'UPDATE') then
    raise exception 'values_events: a session role can write';
  end if;
end $$;
