/**
 * Step 1b — sub-categories never appear in pickers.
 *
 * global_categories carries 5 primaries (parent_id IS NULL) and the promoted
 * sub-categories (limiteds, skins, coaching, … with parent_id set). Every
 * query that LISTS global categories for nav, templates or an admin picker
 * must filter `parent_id IS NULL`; lookups by slug / id are exempt because
 * they resolve one known row.
 *
 * Static: scans src for `.from('global_categories')` and inspects the chained
 * call. A listing query is one with no `.eq('slug'` / `.eq('id'` / `.in('slug'`
 * key filter; it must contain `.is('parent_id', null)`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

const KEY_LOOKUP = /\.(eq|in)\(\s*['"](slug|id)['"]/
const PARENT_FILTER = /\.is\(\s*['"]parent_id['"]\s*,\s*null\s*\)/

describe('global_categories listings filter parent_id IS NULL', () => {
  it('every list query of global_categories in src filters primaries only', () => {
    const offenders: string[] = []
    let listQueries = 0
    for (const file of walk(join(process.cwd(), 'src'))) {
      const text = readFileSync(file, 'utf8')
      let idx = text.indexOf(".from('global_categories')")
      while (idx !== -1) {
        // the chained builder ends at the first blank line or statement terminator after the call
        const rest = text.slice(idx, idx + 600)
        const end = rest.search(/\n\s*\n|\)\s*as unknown|;\s*\n/)
        const chain = end === -1 ? rest : rest.slice(0, end)
        if (!KEY_LOOKUP.test(chain)) {
          listQueries++
          if (!PARENT_FILTER.test(chain)) {
            const line = text.slice(0, idx).split('\n').length
            offenders.push(`${file.replace(process.cwd() + '/', '')}:${line}`)
          }
        }
        idx = text.indexOf(".from('global_categories')", idx + 1)
      }
    }
    expect(listQueries).toBeGreaterThan(0)
    expect(offenders).toEqual([])
  })
})
