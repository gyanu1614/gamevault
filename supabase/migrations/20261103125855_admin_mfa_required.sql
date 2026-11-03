-- ============================================================================
-- Every staff power requires a two-factor session.
--
-- Problem (reproduced on a local stack 2026-11-03,
-- admin-mfa-gate.guard.integration.test.ts): the second factor was checked by
-- the (admin) page layout only. A layout does not protect what sits behind it,
-- so with just a staff password (an aal1 session) is_admin() answered true,
-- takedown_listing ran, and admin-only tables could be read straight through
-- the API.
--
--   1. staff_session_ok(): the session passed two-factor (the `aal` claim of
--      the verified JWT) or it is the service role. Every staff check asks it.
--   2. is_admin, get_admin_role, has_permission, get_my_permissions,
--      is_super_admin_safe, assert_moderator and the admin branch of
--      sell_access_kind_of all require it. An aal1 staff member is an ordinary
--      user to the database until they pass /admin/mfa.
--   3. The 16 policies that read admin_roles directly now go through those
--      helpers, so they cannot skip the check. Four of them also forgot
--      is_active (payouts, review_edit_history, seller_restrictions x2): a
--      deactivated admin kept that access. Same role sets otherwise.
--   4. The audit log: every active staff member could read every row, and two
--      policies said so. Owner role only now. The "Super admins can delete"
--      policy goes too (the immutability trigger already blocks deletes, and a
--      policy promising otherwise is misleading).
--   5. admin_roles: "Authenticated users can view admin status for chat" let
--      any signed-in user list every staff member and role. Own row only now;
--      chat asks chat_staff_senders(conversation) instead, which only names
--      staff who wrote in a conversation the caller belongs to.
--   6. admin_context(): one call for "who is this admin": role, permissions,
--      profile and the session level (lib/admin/context.ts). It replaces four
--      sequential reads per check.
--
-- Production: the one staff account has a verified TOTP factor (checked
-- 2026-11-03), so nobody is locked out; an aal1 session still reaches /admin/mfa
-- because it reads the caller's OWN admin_roles row, which stays allowed.
-- ============================================================================

begin;

-- 1. The session check --------------------------------------------------------
create or replace function public.staff_session_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or coalesce(auth.role(), '') = 'service_role';
$$;

comment on function public.staff_session_ok() is
  'True when this session may use staff powers: the verified JWT passed two-factor (aal2), or the service role. Called by the staff checks, not by clients.';

-- 2. The staff checks ---------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_session_ok() and exists (
    select 1 from public.admin_roles
    where user_id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.get_admin_role()
returns public.admin_role_enum
language sql
stable
security definer
set search_path = public
as $$
  select role from public.admin_roles
  where user_id = auth.uid()
    and is_active = true
    and public.staff_session_ok();
$$;

create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_session_ok() and exists (
    select 1
    from public.admin_roles ar
    join public.role_permissions rp on ar.role = rp.role
    where ar.user_id = auth.uid()
      and ar.is_active = true
      and rp.permission = required_permission
  );
$$;

create or replace function public.get_my_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(rp.permission), array[]::text[])
  from public.admin_roles ar
  join public.role_permissions rp on ar.role = rp.role
  where ar.user_id = auth.uid()
    and ar.is_active = true
    and public.staff_session_ok();
$$;

create or replace function public.is_super_admin_safe()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_session_ok() and exists (
    select 1 from public.admin_roles
    where user_id = auth.uid()
      and role = 'super_admin'
      and is_active = true
  );
$$;

create or replace function public.assert_moderator()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return;
  end if;
  if public.staff_session_ok() and exists (
    select 1 from public.admin_roles
    where user_id = auth.uid()
      and is_active = true
      and role in ('admin', 'super_admin', 'moderator')
  ) then
    return;
  end if;
  raise exception 'forbidden: moderator role required';
end;
$$;

create or replace function public.sell_access_kind_of(p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role   text;
  v_status text;
begin
  if p_user is null then return 'none'; end if;

  select role, seller_status into v_role, v_status from public.profiles where id = p_user;
  if v_role = 'seller' then
    return case when coalesce(v_status, 'active') = 'active' then 'seller' else 'seller_blocked' end;
  end if;
  -- Publishing as staff is a staff power: it needs the second factor too.
  if public.staff_session_ok() and exists (
    select 1 from public.admin_roles
    where user_id = p_user and is_active = true and role in ('admin', 'super_admin')
  ) then
    return 'admin';
  end if;
  if exists (
    select 1 from public.seller_applications
    where user_id = p_user and status in ('pending', 'under_review', 'info_requested')
  ) then
    return 'applicant';
  end if;
  return 'none';
end;
$$;

-- 3. Policies that read admin_roles directly ----------------------------------
alter policy "Admins can view activity log" on public.admin_activity_log
  to authenticated
  using ((select public.is_admin()));

alter policy "System can insert activity log" on public.admin_activity_log
  to authenticated
  with check ((select public.is_admin()));

alter policy "Admins can view their notifications" on public.admin_notifications
  to authenticated
  using ((select public.is_admin()));

alter policy "Users can create dispute messages" on public.dispute_messages
  to authenticated
  with check (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_messages.dispute_id
        and ((select auth.uid()) in (d.buyer_id, d.seller_id) or (select public.is_admin()))
    )
  );

alter policy "Users can view their dispute messages" on public.dispute_messages
  to authenticated
  using (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_messages.dispute_id
        and ((select auth.uid()) in (d.buyer_id, d.seller_id) or (select public.is_admin()))
    )
  );

alter policy "Admins can manage all disputes" on public.disputes
  to authenticated
  using ((select public.get_admin_role()) in ('admin', 'super_admin', 'moderator'));

alter policy "Admins can view all price history" on public.listing_price_history
  to authenticated
  using ((select public.is_admin()));

alter policy "Admins can update cancellation requests" on public.order_cancellation_requests
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter policy "Admins can view all cancellation requests" on public.order_cancellation_requests
  to authenticated
  using ((select public.is_admin()));

alter policy "Admins can view all payouts" on public.payouts
  to authenticated
  using ((select public.get_admin_role()) in ('admin', 'super_admin'));

alter policy promo_code_usages_admin_all on public.promo_code_usages
  to authenticated
  using ((select public.get_admin_role()) in ('admin', 'super_admin'));

alter policy promo_codes_admin_all on public.promo_codes
  to authenticated
  using ((select public.get_admin_role()) in ('admin', 'super_admin'));

alter policy referral_earnings_select_admin on public.referral_earnings
  to authenticated
  using ((select public.is_admin()));

alter policy "Admins can view all edit history" on public.review_edit_history
  to authenticated
  using ((select public.get_admin_role()) in ('admin', 'super_admin', 'moderator'));

alter policy "Admins can insert restrictions" on public.seller_restrictions
  to authenticated
  with check ((select public.is_admin()));

alter policy "Admins can view all restrictions" on public.seller_restrictions
  to authenticated
  using ((select public.is_admin()));

-- 4. Audit log: the owner role only --------------------------------------------
drop policy if exists "Admins can read audit logs" on public.audit_logs;
drop policy if exists "Admins can view all audit logs" on public.audit_logs;
drop policy if exists "Super admins can delete audit logs" on public.audit_logs;
drop policy if exists "Owner reads audit logs" on public.audit_logs;
create policy "Owner reads audit logs" on public.audit_logs
  for select to authenticated
  using ((select public.is_super_admin_safe()));

comment on table public.audit_logs is
  'Audit trail for critical operations. Append-only (a trigger rejects updates and deletes); readable by the owner role only. No retention job runs yet.';

-- 5. Who is staff: own row only, plus the chat question -------------------------
drop policy if exists "Authenticated users can view admin status for chat" on public.admin_roles;

create or replace function public.chat_staff_senders(p_conversation_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct m.sender_id
  from public.messages m
  join public.admin_roles ar on ar.user_id = m.sender_id and ar.is_active = true
  where m.conversation_id = p_conversation_id
    and exists (
      select 1 from public.conversations c
      where c.id = p_conversation_id
        and ((select auth.uid()) in (c.buyer_id, c.seller_id) or public.is_admin())
    );
$$;

comment on function public.chat_staff_senders(uuid) is
  'Which senders in this conversation are DropMarket staff (the chat shows them as support). Only answers for a participant or staff, so nobody can list the staff.';

-- 6. One call for "who is this admin" -------------------------------------------
create or replace function public.admin_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'aal', auth.jwt() ->> 'aal',
    'role', ar.role,
    'is_active', ar.is_active,
    'last_active_at', ar.last_active_at,
    'permissions', coalesce(
      (select jsonb_agg(rp.permission) from public.role_permissions rp where rp.role = ar.role),
      '[]'::jsonb
    ),
    'username', p.username,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url
  )
  from public.admin_roles ar
  left join public.profiles p on p.id = ar.user_id
  where ar.user_id = auth.uid()
    and ar.is_active = true;
$$;

comment on function public.admin_context() is
  'The caller''s staff context in one call: role, permissions, profile and the session level (aal) from the verified JWT. NULL for anyone who is not active staff. It reports aal and does not require aal2: the caller decides (lib/admin/context.ts).';

-- Grants ------------------------------------------------------------------------
-- staff_session_ok runs inside the definer checks above (as their owner).
revoke all on function public.staff_session_ok() from public, anon, authenticated;
revoke all on function public.chat_staff_senders(uuid) from public, anon;
grant execute on function public.chat_staff_senders(uuid) to authenticated;
revoke all on function public.admin_context() from public, anon;
grant execute on function public.admin_context() to authenticated;

commit;
