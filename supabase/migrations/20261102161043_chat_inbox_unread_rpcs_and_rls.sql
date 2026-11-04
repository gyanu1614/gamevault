-- ============================================================================
-- Chat load: the inbox and the unread badge in ONE call each, the indexes
-- they need, and chat RLS that evaluates auth.uid() / is_admin() once per
-- statement instead of once per row.
--
-- Why (incident 2026-11-02): production went CPU-starved at ~4 req/s while
-- a handful of users chatted. The inbox ran one "last message" query PER
-- conversation and re-ran the whole list on every message, send and read;
-- the navbar badge ran two queries a minute on every page. 06:00 UTC the
-- same day served 38k req/h at 0.13 s; 22:00 choked on 11k req/h (3.8k of
-- them chat).
--
--   1. Indexes: messages (conversation_id, created_at desc) for thread
--      reads and "last message"; a partial index on unread messages; the
--      inbox order per participant. The single-column conversation_id index
--      is dropped: the composite's leading column covers it (FK included).
--   2. RLS: messages / conversations each had two or three overlapping
--      permissive policies, with is_admin() and auth.uid() called per row.
--      One policy per command now, both wrapped in (select ...) so Postgres
--      runs them once (Supabase advisor: auth_rls_initplan,
--      multiple_permissive_policies). Same who-may-do-what as before.
--   3. Security: "Users can update their conversations" let a participant
--      UPDATE every column, so a buyer could re-point seller_id at any user
--      and message strangers through it. Nothing in the app updates a
--      conversation (the on_message_created trigger keeps last_message_at),
--      so UPDATE is gone for signed-in users. anon loses its unused grants.
--   4. my_inbox(): one page of the viewer's conversations with the other
--      party, the order summary, the last message and the unread count,
--      keyset-paginated. my_unread_message_count(): the badge.
--      Both SECURITY DEFINER, pinned to auth.uid(), and they return only
--      the fields the old PostgREST embed already returned.
--
-- Tests: src/test/guards/chat-inbox-rpcs.guard.integration.test.ts
-- ============================================================================

begin;

-- 1. Indexes ------------------------------------------------------------------
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

drop index if exists public.messages_conversation_id_idx;

create index if not exists messages_unread_conversation_idx
  on public.messages (conversation_id)
  where is_read = false;

create index if not exists conversations_buyer_last_message_idx
  on public.conversations (buyer_id, last_message_at desc);

create index if not exists conversations_seller_last_message_idx
  on public.conversations (seller_id, last_message_at desc);

-- 2. RLS: messages ------------------------------------------------------------
drop policy if exists "Admins can view all messages" on public.messages;
drop policy if exists "Conversation participants can view messages" on public.messages;
drop policy if exists "Users can view messages in their conversations" on public.messages;
drop policy if exists "Participants and admins read messages" on public.messages;
create policy "Participants and admins read messages" on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.buyer_id, c.seller_id)
    )
    or (select public.is_admin())
  );

drop policy if exists "Admins can send messages in any conversation" on public.messages;
drop policy if exists "Conversation participants can send messages" on public.messages;
drop policy if exists "Users can send messages in their conversations" on public.messages;
drop policy if exists "Participants and admins send as themselves" on public.messages;
create policy "Participants and admins send as themselves" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      exists (
        select 1 from public.conversations c
        where c.id = messages.conversation_id
          and (select auth.uid()) in (c.buyer_id, c.seller_id)
      )
      or (select public.is_admin())
    )
  );

-- UPDATE stays limited to (is_read, read_at) by the column grant from
-- 20260927184110; this decides which rows.
drop policy if exists "Admins can update any message" on public.messages;
drop policy if exists "Users can update their own messages" on public.messages;
drop policy if exists "Participants and admins mark messages read" on public.messages;
create policy "Participants and admins mark messages read" on public.messages
  for update to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.buyer_id, c.seller_id)
    )
    or (select public.is_admin())
  );

-- 2. RLS: conversations -------------------------------------------------------
drop policy if exists "Admins can view all conversations" on public.conversations;
drop policy if exists "Participants can view conversations" on public.conversations;
drop policy if exists "Users can view their own conversations" on public.conversations;
drop policy if exists "Participants and admins read conversations" on public.conversations;
create policy "Participants and admins read conversations" on public.conversations
  for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id) or (select public.is_admin()));

-- A chat belongs to one order and exactly that order's buyer and seller. order_id
-- is unique, so the first insert wins: a row naming anyone else would lock the real
-- seller out of the chat and show staff a made-up thread as the order's conversation
-- (dispute page, card-dispute evidence). A new chat with no order could reach any
-- user and email them; the app's only insert always has an order, and the last such
-- row dates from April 2026. Existing ones stay readable.
drop policy if exists "Users can create conversations" on public.conversations;
create policy "Users can create conversations" on public.conversations
  for insert to authenticated
  with check (
    (select auth.uid()) in (buyer_id, seller_id)
    and exists (
      select 1 from public.orders o
      where o.id = conversations.order_id
        and o.buyer_id = conversations.buyer_id
        and o.seller_id = conversations.seller_id
    )
  );

-- 3. Security: no client UPDATE / DELETE on conversations ---------------------
drop policy if exists "Users can update their conversations" on public.conversations;
revoke all on table public.conversations from anon;
revoke update, delete, truncate, references, trigger on table public.conversations from authenticated;
revoke all on table public.messages from anon;
revoke delete, truncate, references, trigger on table public.messages from authenticated;

-- 4. RPCs ---------------------------------------------------------------------
create or replace function public.my_unread_message_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.conversations c
  join public.messages m
    on m.conversation_id = c.id
   and m.is_read = false
  where (select auth.uid()) in (c.buyer_id, c.seller_id)
    and m.sender_id is not null
    and m.sender_id <> (select auth.uid());
$$;

comment on function public.my_unread_message_count() is
  'Messages badge: unread messages from the other party across the caller''s conversations (system notices excluded). One indexed query.';

create or replace function public.my_inbox(
  p_limit integer default 30,
  p_before timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as id
  ),
  page as (
    select c.*
    from public.conversations c, me
    where me.id in (c.buyer_id, c.seller_id)
      and (
        p_before is null
        or c.last_message_at < p_before
        or (p_before_id is not null and c.last_message_at = p_before and c.id < p_before_id)
      )
    order by c.last_message_at desc, c.id desc
    limit least(greatest(coalesce(p_limit, 30), 1), 100)
  )
  select coalesce(jsonb_agg(x.row_json order by x.last_message_at desc, x.id desc), '[]'::jsonb)
  from (
    select
      p.id,
      p.last_message_at,
      jsonb_build_object(
        'id', p.id,
        'order_id', p.order_id,
        'listing_id', p.listing_id,
        'buyer_id', p.buyer_id,
        'seller_id', p.seller_id,
        'last_message_at', p.last_message_at,
        'created_at', p.created_at,
        'buyer', case when b.id is null then null else
          jsonb_build_object('id', b.id, 'username', b.username, 'avatar_url', b.avatar_url) end,
        'seller', case when s.id is null then null else
          jsonb_build_object('id', s.id, 'username', s.username, 'avatar_url', s.avatar_url, 'is_verified', s.is_verified) end,
        'last_message', lm.last_message,
        'unread_count', coalesce(un.n, 0),
        'order', case when o.id is null then null else jsonb_build_object(
          'id', o.id,
          'order_number', o.order_number,
          'status', o.status,
          'total_amount', o.total_amount,
          'quantity', o.quantity,
          'listing', case when l.id is null then null else jsonb_build_object(
            'id', l.id,
            'title', l.title,
            -- The inbox shows the first picture only.
            'images', coalesce(to_jsonb(l.images[1:1]), '[]'::jsonb),
            'game', case when g.id is null then null else
              jsonb_build_object('id', g.id, 'name', g.name, 'slug', g.slug, 'image_url', g.image_url) end,
            'category', case when gc.id is null then null else
              jsonb_build_object('name', gc.name, 'slug', gc.slug, 'type', gc.type) end
          ) end
        ) end
      ) as row_json
    from page p
    cross join me
    left join public.profiles b on b.id = p.buyer_id
    left join public.profiles s on s.id = p.seller_id
    -- Definer: orders RLS does not apply here, so the join itself requires
    -- the caller to be a party to the order.
    left join public.orders o on o.id = p.order_id and me.id in (o.buyer_id, o.seller_id)
    left join public.listings l on l.id = o.listing_id
    left join public.games g on g.id = l.game_id
    left join public.game_categories gc on gc.id = l.game_category_id
    left join lateral (
      select jsonb_build_object('content', m.content, 'sender_id', m.sender_id) as last_message
      from public.messages m
      where m.conversation_id = p.id
      order by m.created_at desc
      limit 1
    ) lm on true
    left join lateral (
      select count(*)::integer as n
      from public.messages m
      where m.conversation_id = p.id
        and m.is_read = false
        and m.sender_id is not null
        and m.sender_id <> me.id
    ) un on true
  ) x;
$$;

comment on function public.my_inbox(integer, timestamptz, uuid) is
  'Account inbox: one page (default 30, max 100) of the caller''s conversations, newest first, with the other party, order summary, last message and unread count. Keyset cursor = (last_message_at, id) of the last row.';

revoke all on function public.my_unread_message_count() from public, anon;
grant execute on function public.my_unread_message_count() to authenticated;
revoke all on function public.my_inbox(integer, timestamptz, uuid) from public, anon;
grant execute on function public.my_inbox(integer, timestamptz, uuid) to authenticated;

commit;
