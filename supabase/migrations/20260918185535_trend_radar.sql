-- Phase 1 · Step 2 — Trend radar (day-2 entry for new Roblox games)
--
-- Adds the generic external-identity and metrics tables the radar (and Step 3's
-- price crawlers) key off, the review state on games, an audit log of every
-- trigger, and the weekly Eldorado chart snapshot the rmt_chart signal diffs.
--
-- Posture: every new table has RLS enabled with NO anon/authenticated policy
-- and its default table grants revoked — they are written and read by the
-- service role only (signed internal routes, admin server actions). No SQL
-- functions or views are created (default-revoke posture from 20260913100000
-- has nothing to cover). Idempotent: safe to re-run.

-- ── 1. game_external_ids — the ONE place an external identity lives ──────────
create table if not exists public.game_external_ids (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games(id) on delete cascade,
  platform    text not null,
  external_id text not null,
  created_at  timestamptz not null default now(),
  constraint game_external_ids_platform_check
    check (platform in ('roblox', 'steam', 'appstore', 'wikidata')),
  constraint game_external_ids_platform_external_id_key unique (platform, external_id),
  constraint game_external_ids_game_id_platform_key unique (game_id, platform)
);
comment on table public.game_external_ids is
  'External identity per (game, platform): Roblox universeId, Steam appid, App Store trackId. Icons, metrics and price crawlers key off this. No per-platform columns on games.';

alter table public.game_external_ids enable row level security;
revoke all on table public.game_external_ids from anon, authenticated;

-- ── 2. game_metrics — generic time series, one row per game per run ──────────
create table if not exists public.game_metrics (
  id               bigint generated always as identity primary key,
  platform         text not null,
  external_id      text not null,
  playing          integer not null default 0,
  visits           bigint,
  favorites        bigint,
  in_top_trending  boolean not null default false,
  in_up_and_coming boolean not null default false,
  captured_at      timestamptz not null default now(),
  constraint game_metrics_platform_check
    check (platform in ('roblox', 'steam', 'appstore'))
);
comment on column public.game_metrics.in_top_trending is
  'Membership in Roblox''s own "Top Trending" sort at capture time (free from the same call). Kept so thresholds can be tuned from evidence.';

create index if not exists game_metrics_lookup_idx
  on public.game_metrics (platform, external_id, captured_at desc);
create index if not exists game_metrics_captured_at_idx
  on public.game_metrics (captured_at);

alter table public.game_metrics enable row level security;
revoke all on table public.game_metrics from anon, authenticated;

-- ── 3. game_metrics_daily — rollup after the raw retention window ────────────
create table if not exists public.game_metrics_daily (
  platform    text not null,
  external_id text not null,
  day         date not null,
  max_playing integer not null,
  avg_playing integer not null,
  samples     integer not null,
  primary key (platform, external_id, day)
);

alter table public.game_metrics_daily enable row level security;
revoke all on table public.game_metrics_daily from anon, authenticated;

-- ── 4. games — review state ──────────────────────────────────────────────────
-- Existing rows default to approved. A pending game is ALSO is_active=false,
-- so the existing RLS policy (is_active = true OR service_role) and every
-- public reader's is_active filter keep it out of nav, sitemap and hubs.
alter table public.games add column if not exists review_status text not null default 'approved';
alter table public.games add column if not exists review_note text;
alter table public.games add column if not exists trend_detected_at timestamptz;
alter table public.games add column if not exists trend_peak_playing integer;
alter table public.games add column if not exists review_snoozed_until timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'games_review_status_check'
  ) then
    alter table public.games
      add constraint games_review_status_check
      check (review_status in ('pending', 'approved', 'rejected', 'declining'));
  end if;
end $$;

create index if not exists games_review_status_idx
  on public.games (review_status)
  where review_status <> 'approved';

-- ── 5. trend_events — audit log of every trigger ─────────────────────────────
create table if not exists public.trend_events (
  id                 uuid primary key default gen_random_uuid(),
  platform           text not null,
  external_id        text not null,
  game_id            uuid references public.games(id) on delete set null,
  signal             text not null,
  value              numeric not null default 0,
  name               text,
  flags              jsonb not null default '{}'::jsonb,
  -- Draft item taxonomy from the game's Fandom wiki (read-only evidence for
  -- the review card). Lives here, on the event that created the game, not in
  -- any catalogue table.
  draft              jsonb,
  discord_message_id text,
  created_at         timestamptz not null default now(),
  handled_at         timestamptz,
  constraint trend_events_platform_check
    check (platform in ('roblox', 'eldorado')),
  constraint trend_events_signal_check
    check (signal in ('top30_entry', 'growth_48h', 'rmt_chart', 'endpoint_failure'))
);
comment on column public.trend_events.flags is
  'Evidence for the trigger: rank/topN, growth inputs, ambiguity, slug collision, prepare step results, or endpoint health for endpoint_failure.';

create index if not exists trend_events_dedup_idx
  on public.trend_events (platform, external_id, signal, created_at desc);
create index if not exists trend_events_created_at_idx
  on public.trend_events (created_at desc);
create index if not exists trend_events_game_id_idx
  on public.trend_events (game_id);

alter table public.trend_events enable row level security;
revoke all on table public.trend_events from anon, authenticated;

-- ── 6. rmt_chart_snapshots — previous Eldorado game list to diff against ─────
create table if not exists public.rmt_chart_snapshots (
  id          bigint generated always as identity primary key,
  source      text not null default 'eldorado',
  names       text[] not null,
  captured_at timestamptz not null default now()
);

create index if not exists rmt_chart_snapshots_lookup_idx
  on public.rmt_chart_snapshots (source, captured_at desc);

alter table public.rmt_chart_snapshots enable row level security;
revoke all on table public.rmt_chart_snapshots from anon, authenticated;
