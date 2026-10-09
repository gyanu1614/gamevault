/**
 * notifyAdmins must reach every active admin / super_admin even when
 * role_permissions has no row for the permission (prod only seeds
 * applications.review, so signup + moderation alerts never fired —
 * owner, 2026-10-09). Email is mocked; the notification rows are checked.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createServiceRoleClient } from '@/lib/supabase/service'

const sendAdminNoticeEmail = vi.fn(async () => ({ success: true }))
vi.mock('@/lib/email', () => ({ sendAdminNoticeEmail }))

const { notifyAdmins } = await import('./notifications')

const svc = createServiceRoleClient() as any
let adminId: string | null = null

beforeAll(async () => {
  const { data } = await svc.from('admin_roles').select('user_id').eq('is_active', true).in('role', ['admin', 'super_admin']).limit(1)
  adminId = data?.[0]?.user_id ?? null
})
afterAll(async () => {
  if (adminId) await svc.from('notifications').delete().eq('user_id', adminId).eq('type', 'guardtest_admin_alert')
})

describe('notifyAdmins', () => {
  it('reaches an admin for a permission nobody has in role_permissions, and emails them', async () => {
    if (!adminId) return
    await notifyAdmins({
      permission: 'guardtest.nobody_has_this',
      type: 'guardtest_admin_alert',
      title: 'guardtest',
      message: 'guardtest',
      link: '/admin',
      email: { subject: 'guardtest', body: 'guardtest' },
    })
    const { data } = await svc.from('notifications').select('id').eq('user_id', adminId).eq('type', 'guardtest_admin_alert')
    expect((data ?? []).length).toBeGreaterThanOrEqual(1)
    expect(sendAdminNoticeEmail).toHaveBeenCalled()
  })
})
