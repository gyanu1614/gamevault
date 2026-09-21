-- sab_pipeline_locks + sab_pipeline_lock_acquire/_release: a marker that keeps
-- a manual full reprice and the scheduled crawl's import from overlapping
-- silently.
--
-- Why: 2026-09-19 20:04Z, an 18-minute manual `pnpm reprice --game=sab --full`
-- run from the owner's machine overlapped the scheduled crawl's import. Batch
-- 22 of the import hit HTTP 546, then "canceling statement due to lock
-- timeout" on every retry, and the job died with 10,837 listings crawled and
-- not landed. Nothing in either log said what was holding the lock or that
-- two writers were running at all.
--
-- Not pg_advisory_lock: a session-level advisory lock lives on the Postgres
-- session that took it, and PostgREST pools sessions — the request that took
-- it and the request that would release it land on different backends, and a
-- transaction-level one ends with the RPC. A row with a TTL is the honest
-- primitive for a lock spanning many requests, and the TTL is what keeps a
-- crashed holder from blocking the pipeline forever.
--
-- Acquire is ONE statement (insert ... on conflict do update ... where), so
-- two contenders cannot both win: the row's primary key is the compare, the
-- WHERE is the swap condition. A lock is taken over only when it has expired
-- or when the same holder re-acquires (a refresh). Release deletes only when
-- the holder matches, so a late release from a restarted process cannot free
-- a lock someone else has since taken.
--
-- Callers: runSabCorrection (src/lib/pricing/games/sab.ts — the runner, the
-- manual --full, and the thin correct-prices route all go through it) and the
-- collector's import phase (scripts/collect-eldorado-sab-api-v6.mjs). Both
-- use the name 'sab-pipeline'. Client logic: src/lib/pricing/pipeline-lock.ts.

create table if not exists public.sab_pipeline_locks (
  name         text primary key,
  holder       text not null,
  acquired_at  timestamptz not null default now(),
  expires_at   timestamptz not null
);

comment on table public.sab_pipeline_locks is
  'Cross-process markers for pipeline stages that must not overlap (import vs reprice). One row per lock name; the TTL bounds a crashed holder.';

-- No policies: service_role bypasses RLS and is the only intended caller.
alter table public.sab_pipeline_locks enable row level security;
revoke all on table public.sab_pipeline_locks from public, anon, authenticated;
grant select, insert, update, delete on table public.sab_pipeline_locks to service_role;

create or replace function public.sab_pipeline_lock_acquire(
  p_name text,
  p_holder text,
  p_ttl_seconds integer
)
returns table (
  acquired boolean,
  holder text,
  acquired_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  won public.sab_pipeline_locks%rowtype;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'lock name is required';
  end if;
  if p_holder is null or length(trim(p_holder)) = 0 then
    raise exception 'lock holder is required';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds < 1 or p_ttl_seconds > 6 * 3600 then
    raise exception 'ttl must be between 1 second and 6 hours (got %)', p_ttl_seconds;
  end if;

  insert into public.sab_pipeline_locks (name, holder, acquired_at, expires_at)
  values (p_name, p_holder, now(), now() + make_interval(secs => p_ttl_seconds))
  on conflict (name) do update
    set holder      = excluded.holder,
        acquired_at = excluded.acquired_at,
        expires_at  = excluded.expires_at
    where sab_pipeline_locks.expires_at < now()
       or sab_pipeline_locks.holder = excluded.holder
  returning * into won;

  if found then
    return query select true, won.holder, won.acquired_at, won.expires_at;
    return;
  end if;

  -- Held by someone else and not expired: report them so the caller's log
  -- line can say who, since when, and until when.
  return query
    select false, l.holder, l.acquired_at, l.expires_at
    from public.sab_pipeline_locks l
    where l.name = p_name;
end;
$$;

create or replace function public.sab_pipeline_lock_release(
  p_name text,
  p_holder text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.sab_pipeline_locks
  where name = p_name
    and holder = p_holder;
  return found;
end;
$$;

comment on function public.sab_pipeline_lock_acquire(text, text, integer) is
  'Atomically take the named lock for p_holder with a TTL, or take over an expired one. Returns acquired=false plus the live holder otherwise.';
comment on function public.sab_pipeline_lock_release(text, text) is
  'Release the named lock if p_holder holds it. Returns whether a row was deleted.';

revoke all on function public.sab_pipeline_lock_acquire(text, text, integer) from public, anon, authenticated;
revoke all on function public.sab_pipeline_lock_release(text, text) from public, anon, authenticated;
grant execute on function public.sab_pipeline_lock_acquire(text, text, integer) to service_role;
grant execute on function public.sab_pipeline_lock_release(text, text) to service_role;
