/**
 * "Who is this admin?": the ONE staff check every admin page, action and route
 * goes through, answered once per request.
 *
 * It is a single auth check (getUser) plus a single RPC (admin_context, migration
 * 20261103125855) that returns role, permissions, profile and the session's
 * two-factor level together. It used to be four sequential calls per check, and a
 * page made up to seven checks (requireAdmin had 188 call sites, none memoised).
 *
 * The answer is memoised per request by the request's own headers object, which
 * works in server components, server actions and route handlers alike. React
 * cache() would only cover a render, not an action.
 *
 * Two-factor is enforced HERE, not only in the (admin) layout: a layout does not
 * protect the server actions behind it. `aal` comes from the database's view of
 * the verified JWT, and a session below aal2 is `needs_mfa`, never `ok`. The
 * database's own staff checks require aal2 as well, so a mistake in one layer
 * still fails closed.
 *
 * Not a 'use server' module: nothing here is callable from the browser.
 */

import type { User } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { shouldTouchAdminLastActive } from '@/lib/admin/last-active'
import type { AdminRole, AdminUser } from '@/lib/admin/permissions-constants'

export type AdminGate =
  | { status: 'ok'; admin: AdminUser; user: User }
  /** No valid session. */
  | { status: 'signed_out' }
  /** Signed in, but not active staff. */
  | { status: 'not_admin'; user: User }
  /** Active staff without the second factor in this session: send to /admin/mfa. */
  | { status: 'needs_mfa'; user: User }

type AdminContextRow = {
  aal: string | null
  role: AdminRole
  is_active: boolean
  last_active_at: string | null
  permissions: string[] | null
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

async function loadAdminGate(): Promise<AdminGate> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'signed_out' }

  const { data, error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: unknown }>)(
    'admin_context',
  )
  const row = (error ? null : data) as AdminContextRow | null
  if (!row) return { status: 'not_admin', user }
  if (row.aal !== 'aal2') return { status: 'needs_mfa', user }

  // Only when stale (lib/admin/last-active). AUTH-030: admin_roles has no user
  // write policy, so it is touched as the backend, scoped to the verified user.
  if (shouldTouchAdminLastActive(row.last_active_at)) {
    await (createServiceRoleClient().from('admin_roles').update as any)({ last_active_at: new Date().toISOString() }).eq(
      'user_id',
      user.id,
    )
  }

  const admin = {
    userId: user.id,
    email: user.email || '',
    role: row.role,
    isActive: row.is_active,
    permissions: row.permissions ?? [],
    lastActiveAt: row.last_active_at,
    // Profile fields for the admin chrome.
    username: row.username,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    badges: [],
  } as AdminUser
  return { status: 'ok', admin, user }
}

const perRequest = new WeakMap<object, Promise<AdminGate>>()

/** The request's identity: next/headers hands back one object per request. */
function requestKey(): object | null {
  try {
    return headers() as unknown as object
  } catch {
    return null // Outside a request (a script or a unit test): no memo.
  }
}

export function getAdminGate(): Promise<AdminGate> {
  const key = requestKey()
  if (!key) return loadAdminGate()
  let gate = perRequest.get(key)
  if (!gate) {
    gate = loadAdminGate()
    perRequest.set(key, gate)
  }
  return gate
}

/** The admin for this request, or null (signed out, not staff, or no second factor). */
export async function getVerifiedAdmin(): Promise<AdminUser | null> {
  const gate = await getAdminGate()
  return gate.status === 'ok' ? gate.admin : null
}
