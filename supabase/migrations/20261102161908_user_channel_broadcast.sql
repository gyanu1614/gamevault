-- ============================================================================
-- Live updates: one private broadcast topic per user, user:<id>, instead of
-- Postgres Changes on five tables.
--
-- Why (incident 2026-11-02): Realtime's Postgres Changes decodes every WAL
-- change on every published table and re-checks RLS per subscriber per row,
-- inside the database. Its list_changes poll was the single biggest consumer
-- of database time (970k calls since 2026-10-20), and every signed-in buyer
-- held three listeners (profiles, seller_applications x2) for the whole
-- session, plus the navbar's notifications listener on every page.
-- Supabase's guidance for scale is Broadcast from the database: an AFTER
-- trigger sends a small message to a private topic, and the topic's RLS is
-- checked once, when the client joins. The order chat already works this way
-- (chat:<conversation id>, migration 20261021222022).
--
--   1. user_channel_send(): the one sender. Never blocks the write that
--      fired it (a missed event is caught by the client's focus refetch).
--   2. Events on user:<id>:
--        message            a new chat message in one of my conversations
--                           (both parties), with a short preview
--        notification       a new notifications row for me
--        seller_application my application was filed / changed status
--        profile            my role / shop / seller fields changed
--        order              an order I'm party to changed status
--   3. realtime.messages SELECT policy: a signed-in user joins user:<their
--      own id> only.
--   4. The five tables leave the supabase_realtime publication, and go back
--      to REPLICA IDENTITY DEFAULT (FULL was only for Postgres Changes' old
--      records; it made every UPDATE write the whole old row to WAL).
--
-- Tests: src/test/guards/user-channel-broadcast.guard.integration.test.ts
-- ============================================================================

begin;

-- 1. The sender ---------------------------------------------------------------
create or replace function public.user_channel_send(p_user_id uuid, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  begin
    perform realtime.send(p_payload, p_event, 'user:' || p_user_id::text, true);
  exception when others then
    raise warning 'user_channel_send(%): %', p_event, sqlerrm;
  end;
end;
$$;

comment on function public.user_channel_send(uuid, text, jsonb) is
  'Broadcast one event to the private topic user:<id>. Called by triggers only; never raises.';

-- 2. Triggers -----------------------------------------------------------------
create or replace function public.user_channel_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid;
  v_seller uuid;
  v_payload jsonb;
begin
  select c.buyer_id, c.seller_id into v_buyer, v_seller
  from public.conversations c
  where c.id = new.conversation_id;

  v_payload := jsonb_build_object(
    'id', new.id,
    'conversation_id', new.conversation_id,
    'sender_id', new.sender_id,
    'content', left(new.content, 200),
    'created_at', new.created_at
  );
  perform public.user_channel_send(v_buyer, 'message', v_payload);
  if v_seller is distinct from v_buyer then
    perform public.user_channel_send(v_seller, 'message', v_payload);
  end if;
  return null;
end;
$$;

drop trigger if exists messages_user_channel on public.messages;
create trigger messages_user_channel
  after insert on public.messages
  for each row execute function public.user_channel_on_message();

create or replace function public.user_channel_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.user_channel_send(
    new.user_id,
    'notification',
    jsonb_build_object('id', new.id, 'type', new.type, 'created_at', new.created_at)
  );
  return null;
end;
$$;

drop trigger if exists notifications_user_channel on public.notifications;
create trigger notifications_user_channel
  after insert on public.notifications
  for each row execute function public.user_channel_on_notification();

create or replace function public.user_channel_on_seller_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  perform public.user_channel_send(new.user_id, 'seller_application', jsonb_build_object('status', new.status));
  return null;
end;
$$;

drop trigger if exists seller_applications_user_channel on public.seller_applications;
create trigger seller_applications_user_channel
  after insert or update on public.seller_applications
  for each row execute function public.user_channel_on_seller_application();

-- The fields the navbar / auth provider show (use-auth REALTIME_PROFILE_KEYS).
create or replace function public.user_channel_on_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.user_channel_send(
    new.id,
    'profile',
    jsonb_build_object(
      'role', new.role,
      'shop_name', new.shop_name,
      'shop_slug', new.shop_slug,
      'username', new.username,
      'avatar_url', new.avatar_url,
      'badges', new.badges,
      'seller_tier', new.seller_tier,
      'seller_status', new.seller_status,
      'full_name', new.full_name
    )
  );
  return null;
end;
$$;

drop trigger if exists profiles_user_channel on public.profiles;
create trigger profiles_user_channel
  after update of role, shop_name, shop_slug, username, avatar_url, badges, seller_tier, seller_status, full_name
  on public.profiles
  for each row
  when (
    (new.role, new.shop_name, new.shop_slug, new.username, new.avatar_url, new.badges, new.seller_tier, new.seller_status, new.full_name)
    is distinct from
    (old.role, old.shop_name, old.shop_slug, old.username, old.avatar_url, old.badges, old.seller_tier, old.seller_status, old.full_name)
  )
  execute function public.user_channel_on_profile();

create or replace function public.user_channel_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb := jsonb_build_object('order_id', new.id, 'status', new.status);
begin
  perform public.user_channel_send(new.buyer_id, 'order', v_payload);
  if new.seller_id is distinct from new.buyer_id then
    perform public.user_channel_send(new.seller_id, 'order', v_payload);
  end if;
  return null;
end;
$$;

-- Status changes AND the delivery-side fields the order page shows (proof,
-- cancellation, chat window) — anything the other party does that the open
-- order page must re-render for.
drop trigger if exists orders_user_channel on public.orders;
create trigger orders_user_channel
  after update on public.orders
  for each row
  when (old.* is distinct from new.*)
  execute function public.user_channel_on_order();

revoke all on function public.user_channel_send(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.user_channel_on_message() from public, anon, authenticated;
revoke all on function public.user_channel_on_notification() from public, anon, authenticated;
revoke all on function public.user_channel_on_seller_application() from public, anon, authenticated;
revoke all on function public.user_channel_on_profile() from public, anon, authenticated;
revoke all on function public.user_channel_on_order() from public, anon, authenticated;

-- 3. Who may join user:<id> ----------------------------------------------------
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages missing: user channel policy skipped';
    return;
  end if;
  execute 'drop policy if exists "Users receive their own channel" on realtime.messages';
  execute $policy$
    create policy "Users receive their own channel" on realtime.messages
      for select to authenticated
      using (
        realtime.messages.extension = 'broadcast'
        and (select realtime.topic()) = 'user:' || (select auth.uid())::text
      )
  $policy$;
end;
$$;

-- 4. Postgres Changes off -----------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['messages', 'notifications', 'orders', 'profiles', 'seller_applications'] loop
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity default', t);
  end loop;
end;
$$;

comment on table public.orders is 'Orders. Live updates go out on user:<buyer/seller id> (orders_user_channel trigger), not Postgres Changes.';
comment on table public.seller_applications is 'Seller applications. Status changes go out on user:<id> (seller_applications_user_channel trigger) and drive the Become-a-Seller CTA in use-auth.tsx.';
comment on table public.notifications is 'In-app notifications. New rows go out on user:<id> (notifications_user_channel trigger) so the navbar bell reacts at once.';

commit;
