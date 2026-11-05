/**
 * The sidebar hides pages by role, but on 2026-11-04 the actions behind them took
 * any staff account: a moderator or support login could edit games, seller leads
 * and founding invites by calling the action directly. Harmless with one staff
 * account; it must hold before a second one exists.
 *
 * Every admin action checks a role list. "Any staff" is a decision with a reason,
 * made here.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { limitSignupForRole } from '@/lib/admin/staff-roles'

const ACTIONS = join(process.cwd(), 'src/lib/actions')
const read = (name: string) => readFileSync(join(ACTIONS, name), 'utf8')

const ANY_STAFF: Record<string, string> = {
  'admin-permissions.ts': 'defines the check',
  'admin-dashboard.ts': 'the dashboard opens for every staff role',
  'admin-active-sellers.ts': 'Active Sellers opens for every staff role',
  'admin-seller-detail.ts': 'opens for every staff role; the address is limited by limitSignupForRole',
}

describe('admin actions check a role', () => {
  const files = readdirSync(ACTIONS).filter((f) => f.endsWith('.ts') && !f.includes('.test.'))

  it('no action takes any staff account unless listed here with a reason', () => {
    const open = files.filter((f) => /await requireAdmin\(\)/.test(read(f)) && !(f in ANY_STAFF))
    expect(open).toEqual([])
  })

  it.each([
    ['admin-games.ts', 'ADMIN_ONLY'],
    ['admin-game-wizard.ts', 'ADMIN_ONLY'],
    ['admin-fees.ts', 'ADMIN_ONLY'],
    ['seller-leads.ts', 'ADMIN_ONLY'],
    ['founding-invite.ts', 'ADMIN_ONLY'],
    ['founding-notices.ts', 'ADMIN_ONLY'],
    ['early-seller.ts', 'ADMIN_ONLY'],
    ['admin-orders.ts', 'SUPPORT_STAFF'],
    ['refund-to-source.ts', 'SUPPORT_STAFF'],
    ['admin-seller-review.ts', 'MODERATOR_STAFF'],
    ['kyc-documents.ts', 'MODERATOR_STAFF'],
  ])('%s uses %s', (file, list) => {
    expect(read(file)).toContain(`requireRole(${list})`)
  })
})

describe('limitSignupForRole', () => {
  const signup = { country: 'GB', discord: 'trader', full_name: 'Sam Example', address_line: '1 Test Street', city: 'Testville' }

  it.each(['admin', 'super_admin'])('%s sees the name and address', (role) => {
    expect(limitSignupForRole(signup, role)).toEqual(signup)
  })

  it.each(['moderator', 'support'])('%s does not', (role) => {
    expect(limitSignupForRole(signup, role)).toEqual({ country: 'GB', discord: 'trader', full_name: null, address_line: null, city: null })
  })

  it('passes through a seller with no signup answers', () => {
    expect(limitSignupForRole(null, 'moderator')).toBeNull()
  })
})

describe('the seller detail read', () => {
  it('limits the legal name on the profile block too', () => {
    expect(read('admin-seller-detail.ts')).toMatch(/full_name: seesLegalDetails\(staff\.role\) \? profile\.full_name \?\? null : null/)
  })
})

describe('queue alerts reach moderators', () => {
  it('listings.moderate is a real permission with rows behind it', () => {
    const seed = readFileSync(join(process.cwd(), 'supabase/seeds/role_permissions.local.sql'), 'utf8')
    expect(seed).toContain("('moderator', 'listings.moderate')")
    expect(readFileSync(join(process.cwd(), 'src/lib/admin/permissions-constants.ts'), 'utf8')).toContain("'listings.moderate'")
    const migrations = readdirSync(join(process.cwd(), 'supabase/migrations'))
    expect(migrations.some((m) => m.endsWith('_listings_moderate_permission.sql'))).toBe(true)
  })

  it('the out-of-date note about a thin permission table is gone', () => {
    expect(readFileSync(join(process.cwd(), 'src/lib/utils/notifications.ts'), 'utf8')).not.toMatch(/thin on\s*\n?.*prod/)
  })
})
