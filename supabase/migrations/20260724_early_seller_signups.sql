-- Early-seller waitlist (beta "first 100 sellers" campaign).
-- Public, unauthenticated submissions from the beta banner CTA. Kept
-- deliberately minimal — this is a pre-launch interest list, not a KYC
-- record. Reviewed by admins; converted to real seller applications later.

create table if not exists public.early_seller_signups (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  email         text not null,
  discord       text,
  -- Free-text: which games / categories they plan to sell.
  sells         text,
  -- Optional short pitch / note from the applicant.
  note          text,
  -- Light abuse/dedup context — not shown publicly.
  ip            text,
  user_agent    text,
  status        text not null default 'new'
                  check (status in ('new', 'contacted', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);

-- One signup per email (case-insensitive). A repeat submit just updates
-- the existing row via the server action's upsert.
create unique index if not exists early_seller_signups_email_key
  on public.early_seller_signups (lower(email));

create index if not exists early_seller_signups_status_idx
  on public.early_seller_signups (status, created_at desc);

-- RLS on, no public policies — all access goes through the service-role
-- server action (insert) and admin tooling. The anon key can't read or
-- write this table directly.
alter table public.early_seller_signups enable row level security;
