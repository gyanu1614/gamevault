/**
 * AUTH-030 — admin_roles has no user write policy any more, so the only two
 * app-side writers (the `last_active_at` touch in requireAdmin and in the
 * admin layout) must go through the service role, or they silently no-op.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('AUTH-030 — admin_roles touches use the service role', () => {
  for (const f of ['src/lib/actions/admin-permissions.ts', 'src/app/(admin)/layout.tsx']) {
    it(`${f} updates admin_roles only via createServiceRoleClient`, () => {
      const src = readFileSync(f, 'utf8')
      const touches = [...src.matchAll(/from\('admin_roles'\)\s*\n?\s*\.update/g)]
      expect(touches.length, 'touch still present').toBeGreaterThan(0)
      // every admin_roles update must be on a service-role client variable
      expect(src).toMatch(/createServiceRoleClient\(\)[\s\S]{0,120}from\('admin_roles'\)[\s\S]{0,40}\.update/)
      expect(src).not.toMatch(/\(supabase(?: as any)?\s*\n?\s*\.from\('admin_roles'\)\s*\n?\s*\.update/)
    })
  }
})
