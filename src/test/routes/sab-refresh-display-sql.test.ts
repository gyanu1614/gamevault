import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * ROUTE-013. sab_refresh_price_display() froze the values pages for a month by
 * failing on every run with "DELETE requires a WHERE clause" (SQLSTATE 21000):
 * the project's roles run with safe-update mode, which rejects an unqualified
 * UPDATE or DELETE even inside a plpgsql SECURITY DEFINER body.
 *
 * This guards the SQL text rather than the database, because the guard is a
 * Supabase platform setting that does not exist on the local stack (verified:
 * no safe-update entry in pg_settings or pg_available_extensions), so a local
 * integration test would pass while production still failed.
 *
 * The established idiom in this codebase is `where <identity column> is not
 * null` — see sab_recompute_tradeable, which does exactly that and succeeds.
 */

const MIGRATIONS = join(process.cwd(), 'supabase/migrations')

/** The latest migration that defines a given function. */
function latestDefinitionOf(functionName: string): string {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse()

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
    if (
      new RegExp(
        // `(?![\\w"])` so a function whose name merely STARTS with this one
        // does not match: sab_refresh_price_display_changed is a separate
        // function (migration 20260922172054) and would otherwise shadow the
        // real definition here, making this guard assert against the wrong SQL.
        `create\\s+or\\s+replace\\s+function\\s+(public\\.)?"?${functionName}"?(?![\\w"])`,
        'i',
      ).test(sql)
    ) {
      return sql
    }
  }
  throw new Error(`no migration defines ${functionName}`)
}

/** Strip comments so commentary about DELETE is not mistaken for a statement. */
function statementsOf(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
}

describe('ROUTE-013 — sab_refresh_price_display survives safe-update mode', () => {
  const sql = statementsOf(latestDefinitionOf('sab_refresh_price_display'))

  it('deletes from sab_price_display with a qualifying predicate', () => {
    const del = sql.match(
      /delete\s+from\s+(?:public\.)?sab_price_display([\s\S]*?);/i,
    )
    expect(del, 'expected a DELETE on sab_price_display').not.toBeNull()
    expect(del![1].toLowerCase()).toContain('where')
  })

  it('has no unqualified DELETE anywhere in the function', () => {
    const unqualified = /delete\s+from\s+[a-z_."]+\s*;/i.test(sql)
    expect(
      unqualified,
      'an unqualified DELETE will fail with SQLSTATE 21000 under safe-update mode',
    ).toBe(false)
  })

  it('has no unqualified UPDATE anywhere in the function', () => {
    // An UPDATE whose SET clause runs straight to the semicolon with no WHERE.
    const unqualified = /update\s+[a-z_."]+\s+set\s+[^;]*;/i.test(sql)
      ? !/update[\s\S]*?set[\s\S]*?where/i.test(sql)
      : false
    expect(unqualified).toBe(false)
  })

  it('still refreshes the whole table — the predicate must not narrow it', () => {
    // `is not null` on an identity column is true for every row. A predicate
    // that filtered on anything else would silently make this a partial refresh.
    const del = sql.match(
      /delete\s+from\s+(?:public\.)?sab_price_display\s+where\s+([^;]+);/i,
    )
    expect(del).not.toBeNull()
    expect(del![1].replace(/\s+/g, ' ').trim().toLowerCase()).toBe(
      'brainrot_id is not null',
    )
  })

  it('keeps the function service-role only', () => {
    const full = latestDefinitionOf('sab_refresh_price_display')
    expect(full).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.sab_refresh_price_display\(\)\s+from\s+public,\s*anon,\s*authenticated/i,
    )
    expect(full).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.sab_refresh_price_display\(\)\s+to\s+service_role/i,
    )
  })
})
