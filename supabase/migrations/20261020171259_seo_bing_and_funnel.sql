-- /admin/seo upgrade (2026-10-20): the Google pipeline funnel per section, and
-- Bing Webmaster data, so the page shows progress and both search engines.
--
--   seo_section_daily  += unknown / discovered / crawled — Google's coverage
--                         state counts per sitemap section per day ("URL is
--                         unknown to Google", "Discovered - currently not
--                         indexed", "Crawled - currently not indexed"). The
--                         index count alone sat at ~98 for a week while pages
--                         moved through these stages; now that is visible.
--   seo_bing_daily     one row per day: Bing clicks + impressions
--                      (GetRankAndTrafficStats) and crawl stats (GetCrawlStats:
--                      pages crawled, crawl errors, pages in index, inbound links).
--   seo_bing_pages     Bing's top pages per week (GetPageStats).
--   seo_bing_queries   Bing's top queries per week (GetQueryStats).
--
-- Written once a day by /api/cron/seo-bing (service role); read only by the
-- admin page. Posture: RLS on, no policy, no anon/authenticated grant —
-- service-role only, like seo_section_daily. Additive and idempotent.

alter table public.seo_section_daily
  add column if not exists unknown    integer not null default 0,
  add column if not exists discovered integer not null default 0,
  add column if not exists crawled    integer not null default 0;

create table if not exists public.seo_bing_daily (
  day           date primary key,
  clicks        integer,
  impressions   integer,
  crawled_pages integer,
  crawl_errors  integer,
  in_index      integer,
  in_links      integer,
  synced_at     timestamptz not null default now()
);

create table if not exists public.seo_bing_pages (
  week         date not null,
  url          text not null,
  section      text not null,
  clicks       integer not null default 0,
  impressions  integer not null default 0,
  avg_position numeric(6,2),
  primary key (week, url)
);

create table if not exists public.seo_bing_queries (
  week         date not null,
  query        text not null,
  clicks       integer not null default 0,
  impressions  integer not null default 0,
  avg_position numeric(6,2),
  primary key (week, query)
);

alter table public.seo_bing_daily enable row level security;
alter table public.seo_bing_pages enable row level security;
alter table public.seo_bing_queries enable row level security;
revoke all on table public.seo_bing_daily from anon, authenticated;
revoke all on table public.seo_bing_pages from anon, authenticated;
revoke all on table public.seo_bing_queries from anon, authenticated;

comment on table public.seo_bing_daily is 'Bing Webmaster daily clicks/impressions + crawl stats (in index, crawled, errors). Service role only; /api/cron/seo-bing writes, /admin/seo reads.';
comment on table public.seo_bing_pages is 'Bing Webmaster top pages per week (GetPageStats). Service role only.';
comment on table public.seo_bing_queries is 'Bing Webmaster top queries per week (GetQueryStats). Service role only.';
