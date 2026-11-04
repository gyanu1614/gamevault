-- ============================================================================
-- Chat emails: one email per burst of messages, not one per message.
--
-- Before: the order chat called notifyNewMessage after EVERY send. It emailed
-- when the recipient had no older unread message from the sender, so while
-- the recipient was reading along, every line ("Hey" / "how are you" /
-- "what's your user?") was its own email, and Resend's rate limit filled up.
-- The /account/messages inbox never emailed at all.
--
-- Now every message (any surface) only stamps a queue row; the email waits
-- until the chat goes quiet and goes out once, carrying what is still unread:
--
--   QUIET     2 min   send once nothing new has arrived for this long,
--   MAX_WAIT 10 min   but never hold a batch longer than this,
--   COOLDOWN 15 min   and at most one email per conversation per recipient
--                     in this window (a slow back-and-forth = a few emails,
--                     not one per message).
--   Nothing unread when it is due (they read it in the app) = no email.
--
--   1. chat_email_queue: one row per (conversation, recipient). Service role
--      only; no client can read or write it.
--   2. messages_enqueue_email: AFTER INSERT trigger. Skips system notices
--      (sender NULL), messages from a non-participant (admin), and the
--      seller's "Delivery Evidence" post (the buyer gets the Order Delivered
--      email for that). Never blocks a send.
--   3. chat_email_claim_due / chat_email_complete: the sender route claims
--      due rows with a lease (FOR UPDATE SKIP LOCKED, so two runs never
--      double-send), gets everything the email needs in the same call, and
--      reports back in ONE call per run.
--   4. Every minute, pg_cron runs chat_email_kick(): a single indexed EXISTS
--      on the queue; only when something is due does it call
--      /api/cron/chat-email-digest through pg_net. It needs two Vault
--      secrets on the project (site_url, cron_secret); without them it does
--      nothing, so local stacks and previews never call production.
--   5. cron.job_run_details is trimmed daily (a minute job adds 1,440 rows a
--      day).
--
-- Tests: src/test/guards/chat-email-digest.guard.integration.test.ts
-- ============================================================================

begin;

create extension if not exists pg_net with schema extensions;

-- 1. Queue --------------------------------------------------------------------
create table if not exists public.chat_email_queue (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  -- First message of the batch not emailed yet; NULL = nothing waiting.
  batch_started_at timestamptz,
  last_message_at timestamptz not null,
  send_after timestamptz,
  last_sent_at timestamptz,
  -- Lease held by the sender route while it emails this batch.
  claimed_at timestamptz,
  attempts smallint not null default 0,
  primary key (conversation_id, recipient_id)
);

comment on table public.chat_email_queue is
  'Chat email batching: one row per (conversation, recipient). Stamped by the messages_enqueue_email trigger, drained by /api/cron/chat-email-digest. Service role only.';

create index if not exists chat_email_queue_due_idx
  on public.chat_email_queue (send_after)
  where batch_started_at is not null;

create index if not exists chat_email_queue_recipient_idx
  on public.chat_email_queue (recipient_id);

alter table public.chat_email_queue enable row level security;
revoke all on table public.chat_email_queue from public, anon, authenticated;
grant all on table public.chat_email_queue to service_role;

-- 2. Enqueue ------------------------------------------------------------------
create or replace function public.chat_message_enqueue_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_quiet constant interval := interval '2 minutes';
  c_max_wait constant interval := interval '10 minutes';
  c_cooldown constant interval := interval '15 minutes';
  v_recipient uuid;
  v_now timestamptz := now();
begin
  begin
    select case
             when new.sender_id = c.buyer_id then c.seller_id
             when new.sender_id = c.seller_id then c.buyer_id
           end
      into v_recipient
      from public.conversations c
     where c.id = new.conversation_id;

    if v_recipient is null or v_recipient = new.sender_id then
      return null;
    end if;

    insert into public.chat_email_queue as q
      (conversation_id, recipient_id, batch_started_at, last_message_at, send_after)
    values
      (new.conversation_id, v_recipient, v_now, v_now, v_now + c_quiet)
    on conflict (conversation_id, recipient_id) do update set
      batch_started_at = coalesce(q.batch_started_at, v_now),
      last_message_at = greatest(q.last_message_at, v_now),
      send_after = greatest(
        least(v_now + c_quiet, coalesce(q.batch_started_at, v_now) + c_max_wait),
        coalesce(q.last_sent_at + c_cooldown, '-infinity'::timestamptz)
      ),
      attempts = case when q.batch_started_at is null then 0 else q.attempts end;
  exception when others then
    -- Never block a message on its email.
    raise warning 'chat_message_enqueue_email: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists messages_enqueue_email on public.messages;
create trigger messages_enqueue_email
  after insert on public.messages
  for each row
  when (new.sender_id is not null and new.content not like 'Delivery Evidence%')
  execute function public.chat_message_enqueue_email();

-- 3. Claim + complete ---------------------------------------------------------
create or replace function public.chat_email_claim_due(p_limit integer default 50)
returns table (
  conversation_id uuid,
  recipient_id uuid,
  claimed_at timestamptz,
  recipient_email text,
  recipient_name text,
  sender_name text,
  order_id uuid,
  order_number text,
  unread_count integer,
  messages jsonb
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  c_lease constant interval := interval '5 minutes';
  v_now timestamptz := clock_timestamp();
begin
  return query
  with due as (
    select q.conversation_id, q.recipient_id
    from public.chat_email_queue q
    where q.batch_started_at is not null
      and q.send_after <= v_now
      and (q.claimed_at is null or q.claimed_at < v_now - c_lease)
    order by q.send_after
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
    for update skip locked
  ),
  claimed as (
    update public.chat_email_queue q
       set claimed_at = v_now,
           attempts = q.attempts + 1
      from due
     where q.conversation_id = due.conversation_id
       and q.recipient_id = due.recipient_id
    returning q.conversation_id, q.recipient_id
  )
  select
    cl.conversation_id,
    cl.recipient_id,
    v_now,
    rp.email,
    coalesce(nullif(rp.full_name, ''), rp.username, 'Gamer'),
    coalesce(sp.username, nullif(sp.full_name, ''), 'Someone'),
    c.order_id,
    o.order_number,
    coalesce(un.n, 0),
    coalesce(un.msgs, '[]'::jsonb)
  from claimed cl
  join public.conversations c on c.id = cl.conversation_id
  join public.profiles rp on rp.id = cl.recipient_id
  left join public.profiles sp
    on sp.id = case when c.buyer_id = cl.recipient_id then c.seller_id else c.buyer_id end
  left join public.orders o on o.id = c.order_id
  left join lateral (
    select
      count(*)::integer as n,
      jsonb_agg(
        jsonb_build_object(
          'content', left(t.content, 300),
          'created_at', t.created_at,
          'has_attachment', coalesce(cardinality(t.attachments), 0) > 0
        ) order by t.created_at
      ) filter (where t.rn <= 5) as msgs
    from (
      select m.content, m.created_at, m.attachments,
             row_number() over (order by m.created_at desc) as rn
      from public.messages m
      where m.conversation_id = cl.conversation_id
        and m.is_read = false
        and m.sender_id is not null
        and m.sender_id <> cl.recipient_id
        and m.content not like 'Delivery Evidence%'
    ) t
  ) un on true;
end;
$$;

comment on function public.chat_email_claim_due(integer) is
  'Chat email sender: lease up to p_limit due batches and return what each email needs (recipient, sender name, order, unread count, the latest 5 unread messages oldest first). Service role only.';

-- p_results: [{ conversation_id, recipient_id, claimed_at, outcome }],
-- outcome = 'sent' | 'skipped' (nothing unread, opted out, no address) | 'failed'.
create or replace function public.chat_email_complete(p_results jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c_cooldown constant interval := interval '15 minutes';
  c_retry constant interval := interval '2 minutes';
  c_max_attempts constant integer := 5;
  v_done integer;
begin
  with r as (
    select
      (e->>'conversation_id')::uuid as conversation_id,
      (e->>'recipient_id')::uuid as recipient_id,
      (e->>'claimed_at')::timestamptz as claimed_at,
      e->>'outcome' as outcome
    from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) e
  )
  update public.chat_email_queue q
     set claimed_at = null,
         last_sent_at = case when r.outcome = 'sent' then now() else q.last_sent_at end,
         -- Retry a failed send (a few times); otherwise this batch is done,
         -- and anything that arrived after the claim starts the next one.
         batch_started_at = case
           when r.outcome = 'failed' and q.attempts < c_max_attempts then q.batch_started_at
           when q.last_message_at > r.claimed_at then r.claimed_at
           else null
         end,
         send_after = case
           when r.outcome = 'failed' and q.attempts < c_max_attempts then now() + c_retry
           when q.last_message_at > r.claimed_at then
             greatest(q.send_after, case when r.outcome = 'sent' then now() + c_cooldown else now() end)
           else null
         end,
         attempts = case
           when r.outcome = 'failed' and q.attempts < c_max_attempts then q.attempts
           else 0
         end
    from r
   where q.conversation_id = r.conversation_id
     and q.recipient_id = r.recipient_id
     and q.claimed_at = r.claimed_at;
  get diagnostics v_done = row_count;
  return v_done;
end;
$$;

comment on function public.chat_email_complete(jsonb) is
  'Chat email sender: release the leases taken by chat_email_claim_due with each outcome (sent / skipped / failed). Service role only.';

-- 4. The minute kick ----------------------------------------------------------
create or replace function public.chat_email_kick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.chat_email_queue
    where batch_started_at is not null and send_after <= now()
  ) then
    return;
  end if;

  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'site_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  exception when others then
    return;
  end;
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_get(
    url := rtrim(v_url, '/') || '/api/cron/chat-email-digest',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 10000
  );
end;
$$;

comment on function public.chat_email_kick() is
  'pg_cron, every minute: if a chat email batch is due, call /api/cron/chat-email-digest (Vault secrets site_url + cron_secret). No-op otherwise.';

revoke all on function public.chat_message_enqueue_email() from public, anon, authenticated;
revoke all on function public.chat_email_claim_due(integer) from public, anon, authenticated;
revoke all on function public.chat_email_complete(jsonb) from public, anon, authenticated;
revoke all on function public.chat_email_kick() from public, anon, authenticated;
grant execute on function public.chat_email_claim_due(integer) to service_role;
grant execute on function public.chat_email_complete(jsonb) to service_role;

-- 5. Schedules ----------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron missing: chat email schedule skipped';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname in ('chat-email-digest', 'cron-history-cleanup');
  perform cron.schedule('chat-email-digest', '* * * * *', 'select public.chat_email_kick()');
  perform cron.schedule(
    'cron-history-cleanup',
    '17 3 * * *',
    $job$delete from cron.job_run_details where end_time < now() - interval '7 days'$job$
  );
end;
$$;

commit;
