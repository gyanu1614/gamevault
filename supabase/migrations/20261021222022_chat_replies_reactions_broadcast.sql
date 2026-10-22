-- Chat: replies, reactions, and instant delivery over a private broadcast.
--
-- Why: the order chat listened with postgres_changes (every WAL change on
-- `messages`, RLS-checked per subscriber inside Realtime). On the Free plan
-- that lagged or dropped, and the 20-60 s resync poll was what actually
-- showed the other side's message. Supabase's recommended path for chat is
-- Broadcast from the database: an AFTER trigger calls
-- realtime.broadcast_changes() into the topic chat:<conversation id>, and a
-- private channel may only be joined by someone an RLS policy on
-- realtime.messages lets in (checked once, at join).
--
--   1. messages.reply_to_id: the message being replied to, same conversation
--      only (BEFORE INSERT check). Not updatable: the UPDATE grant stays
--      (is_read, read_at) from 20260927184110, so history stays evidence.
--   2. message_reactions: one reaction per person per message, the six chat
--      emoji (src/lib/chat/reactions.ts). conversation_id is copied from the
--      message by a trigger (never trusted from the client); it keys the
--      RLS check and the broadcast topic.
--   3. chat_broadcast_change(): one AFTER trigger function for both tables.
--      A broadcast failure never blocks a send: the client's resync covers it.
--   4. realtime.messages SELECT policy: a participant (or admin) joins
--      chat:<their conversation id>. No INSERT policy, so a browser can't
--      broadcast into a chat; only the trigger (as the definer) does.
--
-- Tests: src/test/guards/chat-reply-reactions.guard.integration.test.ts

begin;

-- 1. Replies -----------------------------------------------------------------
alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null;

create index if not exists messages_reply_to_id_idx on public.messages (reply_to_id) where reply_to_id is not null;

create or replace function public.messages_reply_same_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.messages m
    where m.id = new.reply_to_id and m.conversation_id = new.conversation_id
  ) then
    raise exception 'reply_to_id must be a message in the same conversation'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_reply_same_conversation on public.messages;
create trigger messages_reply_same_conversation
  before insert on public.messages
  for each row when (new.reply_to_id is not null)
  execute function public.messages_reply_same_conversation();

-- 2. Reactions ---------------------------------------------------------------
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id),
  constraint message_reactions_emoji_check check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏'))
);

comment on table public.message_reactions is
  'One emoji reaction per person per chat message. conversation_id is copied from the message (trigger) and keys RLS + the chat:<id> broadcast.';

create index if not exists message_reactions_conversation_idx on public.message_reactions (conversation_id);
create index if not exists message_reactions_user_idx on public.message_reactions (user_id);

create or replace function public.message_reactions_set_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select m.conversation_id into new.conversation_id
  from public.messages m
  where m.id = new.message_id;
  if new.conversation_id is null then
    raise exception 'message % not found', new.message_id using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists message_reactions_set_conversation on public.message_reactions;
create trigger message_reactions_set_conversation
  before insert on public.message_reactions
  for each row execute function public.message_reactions_set_conversation();

alter table public.message_reactions enable row level security;

drop policy if exists "Participants read reactions" on public.message_reactions;
create policy "Participants read reactions" on public.message_reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = message_reactions.conversation_id
        and (select auth.uid()) in (c.buyer_id, c.seller_id)
    )
    or public.is_admin()
  );

drop policy if exists "Participants react as themselves" on public.message_reactions;
create policy "Participants react as themselves" on public.message_reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      exists (
        select 1 from public.conversations c
        where c.id = message_reactions.conversation_id
          and (select auth.uid()) in (c.buyer_id, c.seller_id)
      )
      or public.is_admin()
    )
  );

drop policy if exists "People change their own reaction" on public.message_reactions;
create policy "People change their own reaction" on public.message_reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "People remove their own reaction" on public.message_reactions;
create policy "People remove their own reaction" on public.message_reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.message_reactions from public, anon, authenticated;
grant select, delete on public.message_reactions to authenticated;
-- user_id defaults to auth.uid(); conversation_id comes from the trigger.
grant insert (message_id, emoji) on public.message_reactions to authenticated;
grant update (emoji) on public.message_reactions to authenticated;
grant all on public.message_reactions to service_role;

-- 3. Broadcast ---------------------------------------------------------------
create or replace function public.chat_broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform realtime.broadcast_changes(
      'chat:' || coalesce(new.conversation_id, old.conversation_id)::text,
      case tg_table_name when 'messages' then 'message' else 'reaction' end,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  exception when others then
    -- Never block a send on Realtime: the client resync picks the row up.
    raise warning 'chat_broadcast_change(%): %', tg_table_name, sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists messages_broadcast on public.messages;
create trigger messages_broadcast
  after insert or update on public.messages
  for each row execute function public.chat_broadcast_change();

drop trigger if exists message_reactions_broadcast on public.message_reactions;
create trigger message_reactions_broadcast
  after insert or update or delete on public.message_reactions
  for each row execute function public.chat_broadcast_change();

-- Trigger functions: nobody calls these directly.
revoke all on function public.messages_reply_same_conversation() from public, anon, authenticated;
revoke all on function public.message_reactions_set_conversation() from public, anon, authenticated;
revoke all on function public.chat_broadcast_change() from public, anon, authenticated;

-- 4. Who may join chat:<conversation id> --------------------------------------
-- realtime.messages is created by the Realtime service; a local stack with
-- Realtime switched off may not have it yet, so the policy is conditional.
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages missing: chat broadcast policy skipped';
    return;
  end if;

  execute 'drop policy if exists "Chat participants receive their thread" on realtime.messages';
  -- The CASE keeps the uuid cast off any topic that isn't chat:<uuid>, so a
  -- different private topic never errors here (and the PK lookup stays indexed).
  execute $policy$
    create policy "Chat participants receive their thread" on realtime.messages
      for select to authenticated
      using (
        realtime.messages.extension = 'broadcast'
        and exists (
          select 1 from public.conversations c
          where c.id = (
            case
              when (select realtime.topic()) ~ '^chat:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then substr((select realtime.topic()), 6)::uuid
            end
          )
          and ((select auth.uid()) in (c.buyer_id, c.seller_id) or public.is_admin())
        )
      )
  $policy$;
end;
$$;

commit;
