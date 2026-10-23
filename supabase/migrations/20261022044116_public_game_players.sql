-- Live player numbers for the public /[game]/sell page (values platform, Step E).
--
-- The trend radar's captures (game_metrics, game_metrics_daily) are
-- service-role only, and stay that way. This one read-only function hands the
-- anon key two aggregate numbers for ONE game and nothing else: the latest
-- concurrent player count (only when captured in the last 2 days) and the
-- 7-day peak. Keyed through game_external_ids (Roblox = universeId), the only
-- place an external identity lives. Uses game_metrics_lookup_idx
-- (platform, external_id, captured_at desc). No row when there is no data.
--
-- SECURITY DEFINER so the caller needs no grant on the tables; search_path is
-- pinned. EXECUTE is revoked by default (20260913100000) and granted here to
-- anon + authenticated only; listed in db-p0-grants.guard's allow-list.

create or replace function public.public_game_players(p_game_id uuid)
returns table (playing_now integer, peak_7d integer, captured_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with ext as (
    select e.external_id
    from game_external_ids e
    where e.game_id = p_game_id and e.platform = 'roblox'
    limit 1
  ),
  latest as (
    select m.playing, m.captured_at
    from game_metrics m
    join ext on ext.external_id = m.external_id
    where m.platform = 'roblox'
    order by m.captured_at desc
    limit 1
  ),
  peak as (
    select greatest(
      (select max(m.playing) from game_metrics m join ext on ext.external_id = m.external_id
        where m.platform = 'roblox' and m.captured_at > now() - interval '7 days'),
      (select max(d.max_playing) from game_metrics_daily d join ext on ext.external_id = d.external_id
        where d.platform = 'roblox' and d.day > current_date - 7)
    ) as peak_7d
  )
  select
    case when latest.captured_at > now() - interval '2 days' then latest.playing end,
    peak.peak_7d,
    latest.captured_at
  from latest, peak
  where peak.peak_7d is not null or latest.captured_at > now() - interval '2 days';
$$;

revoke all on function public.public_game_players(uuid) from public, anon, authenticated;
grant execute on function public.public_game_players(uuid) to anon, authenticated;
