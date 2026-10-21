-- Values catalogue pipeline (docs/superpowers/specs/2026-10-21-values-catalogue-pipeline-design.md).
-- catalogue_refs: every wiki page the daily run has decided about (an item we
-- hold, or not an item), keyed by the wiki's page id so a rename never makes a
-- duplicate and a page is read once. catalogue_runs: one row per game per run,
-- for /admin and the health check. Service role only.

create table if not exists public.catalogue_refs (
  game_slug     text        not null,
  page_id       bigint      not null,
  wiki_title    text        not null,
  item_slug     text,
  status        text        not null check (status in ('item', 'ignored')),
  first_seen_at timestamptz not null default now(),
  checked_at    timestamptz not null default now(),
  primary key (game_slug, page_id)
);

comment on table public.catalogue_refs is
  'Values catalogue pipeline: wiki pages already decided about (item_slug set = an item we hold).';

create table if not exists public.catalogue_runs (
  id           bigserial   primary key,
  game_slug    text        not null,
  started_at   timestamptz not null,
  finished_at  timestamptz not null default now(),
  trigger      text        not null check (trigger in ('schedule', 'manual')),
  status       text        not null check (status in ('ok', 'nothing_new', 'blocked', 'failed')),
  listed       integer     not null default 0,
  candidates   integer     not null default 0,
  adopted      integer     not null default 0,
  added_slugs  text[]      not null default '{}',
  ignored      integer     not null default 0,
  images_fixed integer     not null default 0,
  message      text,
  details      jsonb       not null default '{}'::jsonb
);

comment on table public.catalogue_runs is
  'Values catalogue pipeline: one row per game per run (admin Values tab + health check).';

create index if not exists catalogue_runs_game_started_idx
  on public.catalogue_runs (game_slug, started_at desc);

alter table public.catalogue_refs enable row level security;
alter table public.catalogue_runs enable row level security;
revoke all on table public.catalogue_refs from anon, authenticated;
revoke all on table public.catalogue_runs from anon, authenticated;
revoke all on sequence public.catalogue_runs_id_seq from anon, authenticated;
