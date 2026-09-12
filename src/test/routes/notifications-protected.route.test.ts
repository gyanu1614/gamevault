/**
 * ROUTE-003 — /notifications had no server-side gate.
 *
 * It sat outside PROTECTED_ROUTE_PREFIXES, so access control was a client
 * `useEffect` calling router.replace('/login?redirect=...'). The RSC payload
 * and page shell were served to unauthenticated visitors before that effect
 * ran. The notification rows themselves are RLS-bound, so this was a weak
 * gate rather than a data leak — but the gate belongs in middleware, which is
 * where every other authenticated surface is gated.
 *
 * Adding the prefix also fixes logout: the logout handler shares this list
 * (navbar-floating.tsx), so signing out on /notifications now sends the user
 * home instead of refreshing them in place on a page they can no longer use.
 */
import { describe, it, expect } from 'vitest'
import {
  PROTECTED_ROUTE_PREFIXES,
  isProtectedPath,
} from '@/lib/auth/protected-routes'

describe('ROUTE-003 — /notifications is gated server-side', () => {
  it('is listed as a protected prefix', () => {
    expect(PROTECTED_ROUTE_PREFIXES).toContain('/notifications')
  })

  it('matches the exact route', () => {
    expect(isProtectedPath('/notifications')).toBe(true)
  })

  it('matches sub-paths at a / boundary', () => {
    expect(isProtectedPath('/notifications/anything')).toBe(true)
  })

  it('does not swallow a sibling route sharing the prefix string', () => {
    // Boundary-correct matching is the property that lets /seller-agreement
    // stay public next to /seller; assert the same holds for this prefix.
    expect(isProtectedPath('/notifications-public')).toBe(false)
    expect(isProtectedPath('/notificationsettings')).toBe(false)
  })

  it('leaves admin notifications covered by the /admin prefix, not this one', () => {
    expect(isProtectedPath('/admin/notifications')).toBe(true)
  })
})
