import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Every admin template write must refresh the seller form's cached template
 * (getSellTemplate, tag SELL_TEMPLATE_TAG) as well as the admin pages, or a
 * seller keeps seeing the old fields for up to an hour.
 */
const SRC = readFileSync('src/lib/actions/admin-template-builder.ts', 'utf8')

describe('admin template writes revalidate the seller template', () => {
  it('no bare admin revalidatePath: writes go through refreshTemplates()', () => {
    // The only direct call is the one inside refreshTemplates itself.
    expect(SRC.split("revalidatePath('/admin/games', 'layout')").length - 1).toBe(1)
    expect(SRC.match(/refreshTemplates\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(16)
  })
  it('refreshTemplates revalidates the sell-template tag', () => {
    const fn = SRC.slice(SRC.indexOf('function refreshTemplates'), SRC.indexOf('function refreshTemplates') + 300)
    expect(fn).toContain('revalidateTag(SELL_TEMPLATE_TAG)')
    expect(fn).toContain("revalidatePath('/admin/games', 'layout')")
  })
})
