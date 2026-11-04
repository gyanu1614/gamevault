-- Stock alerts per trait (owner, 2026-10-26): Notify Me on a pet page is for
-- the trait the buyer picked (Neon Fly Ride Parrot), not for any listing of
-- the pet — otherwise an FR listing would email someone waiting for NFR.
--
-- variant null  = any trait (the items grid's Notify Me, an item with no stock)
-- variant 'x'   = only a live listing whose value_variant is 'x'
--
-- Ships with 20261104130856_stock_alerts (neither is released yet).

alter table public.stock_alerts
  add column variant text check (variant ~ '^[a-z0-9][a-z0-9-]{0,63}$');

comment on column public.stock_alerts.variant is
  'The listing value_variant the alert waits for; null = any variant of the item.';

-- One "any" row plus one row per variant, per user and item.
alter table public.stock_alerts
  drop constraint stock_alerts_user_id_game_id_item_slug_key;
alter table public.stock_alerts
  add constraint stock_alerts_user_game_item_variant_key
  unique nulls not distinct (user_id, game_id, item_slug, variant);

-- A listing goes live, or a live listing is linked to an item or variant:
-- the item's "any" alerts and that variant's alerts become due.
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
       or old.value_variant is distinct from new.value_variant
     ) then
    update public.stock_alerts
       set due_at = now()
     where game_id = new.game_id
       and item_slug = new.value_item_slug
       and (variant is null or variant = new.value_variant)
       and notified_at is null
       and due_at is null;
  end if;
  return null;
end;
$$;

revoke execute on function public.stock_alerts_mark_due() from public, anon, authenticated;

drop trigger trg_listings_stock_alert_due on public.listings;
create trigger trg_listings_stock_alert_due
  after insert or update of status, value_item_slug, value_variant on public.listings
  for each row execute function public.stock_alerts_mark_due();

-- The claim now also returns the variant (the email names the trait and
-- links to it). A new OUT column needs drop + create.
drop function public.stock_alerts_claim_due(integer);
create function public.stock_alerts_claim_due(p_limit integer default 50)
returns table (id uuid, user_id uuid, game_id uuid, item_slug text, variant text)
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
  returning a.id, a.user_id, a.game_id, a.item_slug, a.variant;
$$;

revoke execute on function public.stock_alerts_claim_due(integer) from public, anon, authenticated;
