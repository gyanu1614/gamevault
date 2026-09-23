/**
 * No server action may invalidate the whole site.
 *
 * `revalidatePath('/', 'layout')` invalidates EVERY route nested under the
 * root layout — all ~950 prerendered pages. `revalidatePath('/')` does the
 * same to the home page's whole cache entry. The 2026-09-22 build audit
 * measured six of these in `lib/actions/auth.ts` alone (signup, login,
 * logout, updateProfile, uploadProfileAvatar, registerAsSeller), so every
 * login and every logout dropped the entire prerender cache and the pages
 * re-rendered — ~7 Supabase queries for a category page — on the next visit.
 * That, not render cost, was the Fluid CPU bill.
 *
 * Nothing in the shared chrome is server-rendered from the session: the nav,
 * account menu and founding badge all read `useAuth()` in the client
 * (`components/navbar-floating.tsx`, `hooks/use-auth.tsx`), so the site-wide
 * invalidation bought nothing in the first place.
 *
 * Anything that genuinely changes shared public content revalidates the tags
 * or paths of what it changed (`lib/revalidation/*`). The allow-list below is
 * empty and is meant to stay that way; an entry needs the same review a
 * `force-dynamic` would get.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

/**
 * Files permitted to invalidate the whole site, each with the reason it
 * cannot be expressed as a tag or a concrete path.
 *
 * Deliberately empty.
 */
const ALLOW_LIST: Record<string, string> = {}

/**
 * `revalidatePath('/', 'layout')` — drops every route under the root layout.
 * `revalidatePath('/')` — drops the home page's cache entry.
 *
 * Matches both quote styles and tolerates whitespace inside the call. A
 * trailing `'page'` argument is matched too: `revalidatePath('/', 'page')`
 * is narrow (home only) but is still written here so the rule reads as one
 * thing — invalidating `/` belongs to a revalidation seam, not an action.
 */
const WHOLE_SITE_CALL = /revalidatePath\(\s*['"]\/['"]\s*(?:,\s*['"](?:layout|page)['"]\s*)?\)/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/** Strip comments so a `revalidatePath('/')` mentioned in prose is not a hit. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('no layout-wide revalidation', () => {
  const files = walk(SRC).filter((f) => !f.includes(`${sep}test${sep}`))

  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('no server action invalidates the whole site', () => {
    const offenders: string[] = []

    for (const file of files) {
      const rel = relative(ROOT, file)
      if (rel in ALLOW_LIST) continue

      const source = stripComments(readFileSync(file, 'utf8'))
      if (!WHOLE_SITE_CALL.test(source)) continue

      // Report the offending line so the failure names the call site.
      const line = source
        .split('\n')
        .findIndex((l) => WHOLE_SITE_CALL.test(l))
      offenders.push(`${rel}:${line + 1}`)
    }

    expect(
      offenders,
      offenders.length
        ? `These call sites invalidate every prerendered page. Revalidate the ` +
          `tag or the concrete path of what changed instead (see ` +
          `src/lib/revalidation/tags.ts), or add the file to ALLOW_LIST with ` +
          `a reason:\n  ${offenders.join('\n  ')}`
        : '',
    ).toEqual([])
  })

  it('the allow-list is empty (an entry needs review)', () => {
    expect(Object.keys(ALLOW_LIST)).toEqual([])
  })
})
