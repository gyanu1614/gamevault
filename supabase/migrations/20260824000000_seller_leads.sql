-- Seller-lead CRM — OUTBOUND concierge outreach tracking.
--
-- Distinct from early_seller_signups (which is INBOUND: public waitlist
-- self-signups). This table is where an admin logs sellers THEY found on
-- EpicNPC / Sythe / G2G / Eldorado / Discord and are actively courting 1:1 —
-- the tooling for the concierge sales motion that acquires the first sellers.
-- Admin-only; no public access.

create table if not exists public.seller_leads (
  id             uuid primary key default gen_random_uuid(),
  -- Who the lead is. handle = their username on the source platform.
  handle         text not null,
  -- Where we found them (free-text so new platforms need no schema change):
  -- 'epicnpc', 'sythe', 'g2g', 'eldorado', 'discord', 'referral', ...
  source         text,
  -- Optional contact + context.
  contact        text,          -- discord tag / email / profile URL
  game           text,          -- the game they sell (focus SAB first)
  -- Outreach pipeline stage.
  status         text not null default 'new'
                   check (status in (
                     'new',         -- found, not yet contacted
                     'contacted',   -- first outreach sent
                     'replied',     -- they responded
                     'negotiating', -- in conversation
                     'signed_up',   -- created an account / applied
                     'converted',   -- approved seller, has listed
                     'passed',      -- not interested / dead
                     'lost'         -- went cold
                   )),
  -- Free-text running notes on the conversation.
  notes          text,
  -- Follow-up scheduling (drives a "due today" view in the admin UI).
  last_contacted timestamptz,
  next_follow_up timestamptz,
  -- Who on the team owns this lead (admin user id), nullable.
  owner_id       uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Fast pipeline views: by status, and by who's due for follow-up.
create index if not exists seller_leads_status_idx
  on public.seller_leads (status, updated_at desc);
create index if not exists seller_leads_follow_up_idx
  on public.seller_leads (next_follow_up)
  where next_follow_up is not null;

-- Keep updated_at fresh on every write.
create or replace function public.seller_leads_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_seller_leads_touch on public.seller_leads;
create trigger trg_seller_leads_touch
  before update on public.seller_leads
  for each row execute function public.seller_leads_touch_updated_at();

-- RLS on, no public policies — all access is through admin-authed server
-- actions (which use the service-role client). The anon key can't touch it.
alter table public.seller_leads enable row level security;
