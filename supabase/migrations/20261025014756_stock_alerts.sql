-- Stock alerts (owner, 2026-10-24): "Notify Me" on an item nobody sells yet.
-- One row per (user, game, item). When a listing of that item goes live, the
-- trigger marks the row due; the app claims due rows atomically and emails
-- each user once (stock_alerts_claim_due), then keeps the row as history.
--
-- Posture: service-role only (revoked from anon/authenticated, RLS on with no
-- policies). Server actions authenticate the user from the session, then write
-- with the service role scoped to that user id.

create table public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  item_slug text not null check (item_slug ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  created_at timestamptz not null default now(),
  -- Set when a live listing of the item exists; cleared when the user re-arms.
  due_at timestamptz,
  -- Set when the email went out (claim); null again if the send failed.
  notified_at timestamptz,
  unique (user_id, game_id, item_slug)
);

comment on table public.stock_alerts is
  'Notify Me in-stock alerts. Service-role only; written by src/lib/actions/stock-alerts.ts, sent by src/lib/stock-alerts/dispatch.ts.';

-- The dispatcher's claim: due and not yet sent.
create index stock_alerts_due_idx on public.stock_alerts (due_at)
  where due_at is not null and notified_at is null;
-- The trigger's lookup: open alerts for one item.
create index stock_alerts_open_item_idx on public.stock_alerts (game_id, item_slug)
  where notified_at is null;

alter table public.stock_alerts enable row level security;
revoke all on table public.stock_alerts from anon, authenticated;

-- A listing of an item goes live (or a live listing gets linked to the item):
-- every open alert on that item becomes due.
create or replace function public.stock_alerts_mark_due()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active'
     and new.value_item_slug is not null
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'active'
       or old.value_item_slug is distinct from new.value_item_slug
     ) then
    update public.stock_alerts
       set due_at = now()
     where game_id = new.game_id
       and item_slug = new.value_item_slug
       and notified_at is null
       and due_at is null;
  end if;
  return null;
end;
$$;

revoke execute on function public.stock_alerts_mark_due() from public, anon, authenticated;

create trigger trg_listings_stock_alert_due
  after insert or update of status, value_item_slug on public.listings
  for each row execute function public.stock_alerts_mark_due();

-- Claim up to p_limit due alerts in one statement (skip rows another
-- dispatcher holds), so two concurrent runs never email the same alert.
create or replace function public.stock_alerts_claim_due(p_limit integer default 50)
returns table (id uuid, user_id uuid, game_id uuid, item_slug text)
language sql
security definer
set search_path = public
as $$
  update public.stock_alerts a
     set notified_at = now()
    from (
      select s.id
        from public.stock_alerts s
       where s.due_at is not null
         and s.notified_at is null
       order by s.due_at
       limit greatest(1, least(coalesce(p_limit, 50), 500))
       for update skip locked
    ) picked
   where a.id = picked.id
  returning a.id, a.user_id, a.game_id, a.item_slug;
$$;

revoke execute on function public.stock_alerts_claim_due(integer) from public, anon, authenticated;
