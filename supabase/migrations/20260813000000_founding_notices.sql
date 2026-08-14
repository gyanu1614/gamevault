-- Founding-seller notices — the admin-controlled announcement feed shown on the
-- Founding Seller HQ page (/founding). One-to-many: the owner posts titled
-- notices that render as the "What's happening" stream for every founder.
--
-- Deliberately simple (v1): title + body + a pin flag + a published gate. No
-- per-recipient targeting or read state yet (those are later phases). Public
-- read is limited to PUBLISHED notices via RLS so the HQ page (which is reached
-- by unauthenticated magic-link visitors) can render them with the anon key;
-- all writes go through admin-only server actions using the service role.

create table if not exists public.founding_notices (
  id            uuid primary key default gen_random_uuid(),
  -- Short headline, trader-voice. Rendered bold at the top of each stream item.
  title         text not null,
  -- Optional supporting line(s). Plain text; the UI handles line breaks.
  body          text,
  -- Pinned notices sort to the top and get the amber/lime accent dot.
  pinned        boolean not null default false,
  -- Manual ordering tiebreaker within the same pin state (higher = earlier).
  priority      integer not null default 0,
  -- Draft vs live. Only published rows are readable by anon (see policy).
  published     boolean not null default true,
  -- Admin (auth.users.id) who created it — for the admin table, never shown to
  -- founders. Nullable so a service-role insert without a user context works.
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Feed ordering: pinned first, then priority, then newest.
create index if not exists founding_notices_feed_idx
  on public.founding_notices (published, pinned desc, priority desc, created_at desc);

alter table public.founding_notices enable row level security;

-- Anon/authenticated may read ONLY published notices (the HQ feed). Writes are
-- service-role only (admin server actions), so no insert/update/delete policy
-- is granted to public roles.
drop policy if exists founding_notices_public_read on public.founding_notices;
create policy founding_notices_public_read
  on public.founding_notices
  for select
  using (published = true);

-- Keep updated_at fresh on edits.
create or replace function public.touch_founding_notices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists founding_notices_touch_updated_at on public.founding_notices;
create trigger founding_notices_touch_updated_at
  before update on public.founding_notices
  for each row
  execute function public.touch_founding_notices_updated_at();
