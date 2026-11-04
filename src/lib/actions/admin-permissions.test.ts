/**
 * AUTH-030 — admin_roles has no user write policy any more, so the only
 * app-side writer (the `last_active_at` touch in the one staff check,
 * lib/admin/context) must go through the service role, or it silently no-ops.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('AUTH-030 — admin_roles touches use the service role', () => {
  it('src/lib/admin/context.ts updates admin_roles only via createServiceRoleClient', () => {
    const src = readFileSync('src/lib/admin/context.ts', 'utf8')
    expect(src).toMatch(/createServiceRoleClient\(\)\.from\('admin_roles'\)\.update/)
    expect(src).not.toMatch(/supabase(?: as any)?\s*\n?\s*\.from\('admin_roles'\)\s*\n?\s*\.update/)
  })

  it('the layout and requireAdmin no longer write it themselves', () => {
    for (const f of ['src/lib/actions/admin-permissions.ts', 'src/app/(admin)/layout.tsx']) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/from\('admin_roles'\)/)
    }
  })
})
