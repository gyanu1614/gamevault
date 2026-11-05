-- Notify Me only fires for what the site shows, so an alert on an item whose only
-- listings are from a paused store stays open. When that store comes back from
-- Offline Mode no listing changes, so the listings trigger never fires: this one
-- marks those alerts due. The app still checks the item is visible before emailing.
create or replace function public.stock_alerts_mark_due_store_back()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.stock_alerts a
     set due_at = now()
    from public.listings l
   where l.seller_id = new.seller_id
     and l.status = 'active'
     and l.value_item_slug is not null
     and a.game_id = l.game_id
     and a.item_slug = l.value_item_slug
     and (a.variant is null or a.variant = l.value_variant)
     and a.notified_at is null
     and a.due_at is null;
  return null;
end;
$$;

revoke all on function public.stock_alerts_mark_due_store_back() from public, anon, authenticated;

create trigger trg_seller_presence_stock_alert_due
  after update of store_paused on public.seller_presence
  for each row
  when (old.store_paused is true and new.store_paused is not true)
  execute function public.stock_alerts_mark_due_store_back();
