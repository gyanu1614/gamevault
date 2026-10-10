-- Growth point 28 — the automatic SEO pipeline.
--
--   seo_settings         one row: the value-page data gate's mode (report|enforce)
--   seo_value_evidence   per value page: our data behind it (offers tracked, days
--                        of history, the last MATERIAL price move) — the inputs
--                        of the shared index rule (src/lib/games/indexability.ts)
--   seo_index_overrides  the owner's explicit per-URL index/noindex decisions
--   seo_url_events       the change log: every page change worth re-crawling,
--                        and its IndexNow delivery state (sent by a cron, retried)
--   seo_url_inspections  latest Google URL Inspection result per URL
--   seo_section_daily    index rate + search clicks per sitemap section per day
--   seo_alerts           what the daily Google check flagged (posted to Discord)
--   seo_value_series()   read-only aggregate: per value item, its daily price
--                        history as arrays (days of history + the backfill of
--                        the last material move)
--
-- Posture: RLS on every table. The three tables a static public page reads to
-- decide its robots meta (settings, evidence, overrides) get a SELECT policy for
-- anon + authenticated — they hold only public facts (the same counts and prices
-- the pages print). No anon/authenticated write anywhere; the rest are
-- service-role only. The function is service-role only (default revoke posture
-- from 20260913100000, restated explicitly). Idempotent.

-- ── 1. seo_settings ─────────────────────────────────────────────────────────
create table if not exists public.seo_settings (
  id                 smallint primary key default 1,
  gate_mode          text not null default 'report',
  -- The day the owner plans to switch the gate on (shown on /admin/seo).
  planned_enforce_on date,
  enforced_since     timestamptz,
  -- The deployment the post-deploy step last diffed (VERCEL_DEPLOYMENT_ID), and
  -- when: a code-dated page whose sitemap lastmod is newer is logged once.
  last_deploy_id     text,
  lastmod_diff_at    timestamptz,
  updated_by         uuid,
  updated_at         timestamptz not null default now(),
  constraint seo_settings_singleton check (id = 1),
  constraint seo_settings_gate_mode_check check (gate_mode in ('report', 'enforce'))
);
comment on table public.seo_settings is
  'Single row. gate_mode=report: the value-page data gate is computed and shown on /admin/seo but changes no robots meta; enforce: failing pages are noindex and out of the sitemap.';

insert into public.seo_settings (id, gate_mode, planned_enforce_on)
values (1, 'report', date '2026-10-16')
on conflict (id) do nothing;

alter table public.seo_settings enable row level security;
revoke all on table public.seo_settings from anon, authenticated;
grant select (id, gate_mode, planned_enforce_on, enforced_since) on table public.seo_settings to anon, authenticated;
drop policy if exists seo_settings_public_read on public.seo_settings;
create policy seo_settings_public_read on public.seo_settings for select to anon, authenticated using (true);

-- ── 2. seo_value_evidence ───────────────────────────────────────────────────
create table if not exists public.seo_value_evidence (
  game_slug         text not null,
  item_slug         text not null,
  -- Offers we track behind the price right now (values_prices.sample_size,
  -- sab_price_display.external_sample_size, max adopt_me_pet_values.reputable_count).
  observations      integer not null default 0,
  -- Distinct days with a price in the item's history table.
  history_days      integer not null default 0,
  -- The headline value right now (null: unpriced).
  value_usd         numeric,
  -- The value(s) at the last material move, per series (Adopt Me: per variant).
  anchors           jsonb not null default '{}'::jsonb,
  -- The ONE date behind the visible "Updated", JSON-LD dateModified and sitemap
  -- lastmod: the last move of at least 5% AND $0.25 (the IndexNow thresholds).
  price_moved_at    timestamptz,
  passes_gate       boolean not null default false,
  passes_changed_at timestamptz,
  -- Google has it indexed or it earned clicks (from the daily Google check):
  -- the gate never hides such a page on its own.
  is_protected      boolean not null default false,
  refreshed_at      timestamptz not null default now(),
  primary key (game_slug, item_slug)
);
comment on column public.seo_value_evidence.price_moved_at is
  'Last MATERIAL price move (>=5% and >=$0.25 vs the anchor). Source of the visible date, dateModified and sitemap lastmod. Never bumped by a re-crawl that found the same price.';

alter table public.seo_value_evidence enable row level security;
revoke all on table public.seo_value_evidence from anon, authenticated;
grant select on table public.seo_value_evidence to anon, authenticated;
drop policy if exists seo_value_evidence_public_read on public.seo_value_evidence;
create policy seo_value_evidence_public_read on public.seo_value_evidence for select to anon, authenticated using (true);

-- ── 3. seo_index_overrides ──────────────────────────────────────────────────
create table if not exists public.seo_index_overrides (
  path       text primary key,
  verdict    text not null,
  reason     text not null,
  decided_at timestamptz not null default now(),
  constraint seo_index_overrides_verdict_check check (verdict in ('index', 'noindex')),
  constraint seo_index_overrides_path_check check (path like '/%')
);

-- Owner decision 2026-10-09: these five indexed Steal a Brainrot pages have no
-- price at all; hide them now. (The five with 1–4 data points stay protected
-- until they pass the gate.)
insert into public.seo_index_overrides (path, verdict, reason) values
  ('/steal-a-brainrot/values/berenjello-angello', 'noindex', 'owner 2026-10-09: indexed but no price'),
  ('/steal-a-brainrot/values/fizzy-soda',         'noindex', 'owner 2026-10-09: indexed but no price'),
  ('/steal-a-brainrot/values/malame-amarele',     'noindex', 'owner 2026-10-09: indexed but no price'),
  ('/steal-a-brainrot/values/noo-la-polizia',     'noindex', 'owner 2026-10-09: indexed but no price'),
  ('/steal-a-brainrot/values/dolphini-jetskini',  'noindex', 'owner 2026-10-09: indexed but no price')
on conflict (path) do nothing;

alter table public.seo_index_overrides enable row level security;
revoke all on table public.seo_index_overrides from anon, authenticated;
grant select on table public.seo_index_overrides to anon, authenticated;
drop policy if exists seo_index_overrides_public_read on public.seo_index_overrides;
create policy seo_index_overrides_public_read on public.seo_index_overrides for select to anon, authenticated using (true);

-- ── 4. seo_url_events ───────────────────────────────────────────────────────
create table if not exists public.seo_url_events (
  id              bigint generated always as identity primary key,
  url             text not null,
  reason          text not null,
  changed_at      timestamptz not null default now(),
  indexnow_status text not null default 'pending',
  attempts        integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at         timestamptz,
  last_error      text,
  gsc_state       text,
  last_inspected  timestamptz,
  constraint seo_url_events_status_check
    check (indexnow_status in ('pending', 'sent', 'failed', 'skipped')),
  constraint seo_url_events_url_check check (url like 'https://%')
);
create index if not exists seo_url_events_due_idx
  on public.seo_url_events (next_attempt_at) where indexnow_status = 'pending';
create index if not exists seo_url_events_url_idx on public.seo_url_events (url, changed_at desc);
create index if not exists seo_url_events_changed_idx on public.seo_url_events (changed_at desc);

alter table public.seo_url_events enable row level security;
revoke all on table public.seo_url_events from anon, authenticated;

-- ── 5. seo_url_inspections ──────────────────────────────────────────────────
create table if not exists public.seo_url_inspections (
  url              text primary key,
  section          text not null,
  verdict          text,
  previous_verdict text,
  coverage_state   text,
  indexing_state   text,
  robots_state     text,
  page_fetch_state text,
  google_canonical text,
  user_canonical   text,
  last_crawl_at    timestamptz,
  inspected_at     timestamptz,
  clicks_90d       integer not null default 0,
  impressions_90d  integer not null default 0,
  search_synced_at timestamptz
);
create index if not exists seo_url_inspections_inspected_idx on public.seo_url_inspections (inspected_at nulls first);

alter table public.seo_url_inspections enable row level security;
revoke all on table public.seo_url_inspections from anon, authenticated;

-- ── 6. seo_section_daily ────────────────────────────────────────────────────
create table if not exists public.seo_section_daily (
  day          date not null,
  section      text not null,
  sitemap_urls integer not null default 0,
  inspected    integer not null default 0,
  indexed      integer not null default 0,
  clicks       integer not null default 0,
  impressions  integer not null default 0,
  primary key (day, section)
);

alter table public.seo_section_daily enable row level security;
revoke all on table public.seo_section_daily from anon, authenticated;

-- ── 7. seo_alerts ───────────────────────────────────────────────────────────
create table if not exists public.seo_alerts (
  id         bigint generated always as identity primary key,
  kind       text not null,
  url        text,
  section    text,
  message    text not null,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  posted_at  timestamptz,
  constraint seo_alerts_kind_check
    check (kind in ('indexed-page-dropped', 'section-index-rate-drop', 'robots-blocked', 'fetch-error', 'canonical-mismatch'))
);
create index if not exists seo_alerts_created_idx on public.seo_alerts (created_at desc);
create index if not exists seo_alerts_dedupe_idx on public.seo_alerts (kind, url, created_at desc);

alter table public.seo_alerts enable row level security;
revoke all on table public.seo_alerts from anon, authenticated;

-- ── 8. seo_value_series(source, game) ───────────────────────────────────────
-- One row per (item, series): the item's daily price history as two parallel
-- arrays in date order. Steal a Brainrot: the default mutation's median.
-- Adopt Me: one series per variant, real (non-estimated) prices only. Generic
-- pipeline: values_price_history.cheapest_usd for that game.
create or replace function public.seo_value_series(p_source text, p_game_slug text)
returns table (item_slug text, series_key text, days date[], vals numeric[])
language sql
stable
set search_path = public
as $$
  select b.slug, ''::text,
         array_agg(h.history_date order by h.history_date),
         array_agg(h.median_usd order by h.history_date)
  from sab_price_history h
  join sab_brainrots b on b.id = h.brainrot_id
  join sab_mutations m on m.id = h.mutation_id and m.slug = 'default'
  where p_source = 'sab'
  group by b.slug
  union all
  select p.slug, h.variant,
         array_agg(h.history_date order by h.history_date),
         array_agg(h.cash_value_usd order by h.history_date)
  from adopt_me_price_history h
  join adopt_me_pets p on p.id = h.pet_id
  where p_source = 'adopt-me' and h.is_estimated = false
  group by p.slug, h.variant
  union all
  select i.slug, ''::text,
         array_agg(h.history_date order by h.history_date),
         array_agg(h.cheapest_usd order by h.history_date)
  from values_price_history h
  join values_items i on i.id = h.item_id
  join games g on g.id = i.game_id and g.slug = p_game_slug
  where p_source = 'pipeline'
  group by i.slug
$$;

revoke all on function public.seo_value_series(text, text) from public, anon, authenticated;
grant execute on function public.seo_value_series(text, text) to service_role;
