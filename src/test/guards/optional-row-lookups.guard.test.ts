import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

/**
 * Found in the /founding end-to-end run (2026-10-14): every signed-in user
 * without an admin role or a seller application fired two 406s on each page
 * load — `.single()` on a lookup that is legitimately empty. Browser-side
 * lookups that may find nothing use `.maybeSingle()` (null, no error).
 */
describe('optional row lookups in the browser', () => {
  it.each([
    ['src/hooks/use-auth.tsx', "from('seller_applications')"],
    // The navbar's admin check moved into the cached hook (2026-10-20).
    ['src/hooks/use-is-admin.ts', ".from('admin_roles')"],
  ])('%s: %s may find nothing → maybeSingle()', (file, table) => {
    const src = read(file)
    let at = src.indexOf(table)
    expect(at).toBeGreaterThan(-1)
    while (at > -1) {
      const chain = src.slice(at, src.indexOf('\n\n', at) > -1 ? src.indexOf('\n\n', at) : at + 400)
      expect(chain).not.toMatch(/\.single\(\)/)
      expect(chain).toMatch(/\.maybeSingle\(\)/)
      at = src.indexOf(table, at + table.length)
    }
  })
})
