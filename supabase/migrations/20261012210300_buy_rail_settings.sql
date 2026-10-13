-- Buy rails (growth point 2): one on/off switch per surface for the sticky
-- desktop rails + the phone buy bar. Single row, every switch ON by default.
--
-- Public pages read it through the anon client (cached under the
-- 'buy-rails:settings' tag; /admin/buy-rails revalidates it). The read FAILS
-- OPEN in code: a missing row or a failed read means "on". No anon or
-- authenticated write; the admin action writes with the service role.
-- Idempotent.

create table if not exists public.buy_rail_settings (
  id          smallint primary key default 1,
  blog        boolean not null default true,
  value_item  boolean not null default true,
  value_list  boolean not null default true,
  calculator  boolean not null default true,
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  constraint buy_rail_settings_singleton check (id = 1)
);
comment on table public.buy_rail_settings is
  'Single row. Per-surface switches for the buy rails / phone buy bar (blog posts, value item pages, value lists, calculators). Default on.';

insert into public.buy_rail_settings (id) values (1)
on conflict (id) do nothing;

alter table public.buy_rail_settings enable row level security;
revoke all on table public.buy_rail_settings from anon, authenticated;
grant select (id, blog, value_item, value_list, calculator) on table public.buy_rail_settings to anon, authenticated;
drop policy if exists buy_rail_settings_public_read on public.buy_rail_settings;
create policy buy_rail_settings_public_read on public.buy_rail_settings for select to anon, authenticated using (true);
