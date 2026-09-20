/**
 * sab_count_unrepriced() — the question the stale-row guard actually needs.
 *
 * PR #76 shipped two things in one commit that contradict each other: writes
 * became incremental (a correction's computed_at only moves when its listings
 * were re-observed), and a guard was added that alerts when >25 rows of
 * sab_price_display carry a price_updated_at older than 6h. price_updated_at IS
 * computed_at, so every item the crawl did not visit in the last 6h was
 * "stale" by construction and the guard failed on every run (1584 rows at
 * 03:02Z, 688 at 22:56Z on 2026-09-20), emailing every three hours.
 *
 * Row AGE is not the signal. The partial-freeze shape the guard exists to catch
 * — "the crawl landed new listings and the price did not follow" — is evidence
 * NEWER than the price. That is what this function counts, and this static
 * read of the migration pins the properties that make the count honest.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

function sql(): string {
  const file = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith('_sab_count_unrepriced.sql'),
  )
  if (!file) throw new Error('sab_count_unrepriced migration not found')
  return readFileSync(join(MIGRATIONS, file), 'utf8')
}

describe('sab_count_unrepriced', () => {
  const body = sql()

  it('compares each key\'s NEWEST active matched observation to its computed_at', () => {
    // Only listings the correction would actually price count as evidence: the
    // correction reads active+matched rows, so a re-observed ended or unmatched
    // listing must not make a price look behind.
    expect(body).toMatch(/listing_status\s*=\s*'active'/)
    expect(body).toMatch(/parse_status\s*=\s*'matched'/)
    expect(body).toMatch(/max\(observed_at\)/)
    expect(body).toMatch(/observed_at\s*>\s*c\.computed_at/)
  })

  it('counts only keys that HAVE a correction — never-priced keys are a different question', () => {
    // A key with listings but no correction row (filtered out of the catalog
    // view) would otherwise read as "unrepriced" forever and cry wolf.
    expect(body).toMatch(/join public\.sab_price_corrections c/)
    expect(body).not.toMatch(/left join public\.sab_price_corrections/)
  })

  it('applies a grace window so a crawl in progress is not a false positive', () => {
    // The daily Vercel cron can land mid-crawl: listings just imported, reprice
    // not yet run. The grace is a parameter so the in-job check can pass 0.
    expect(body).toMatch(/p_grace_seconds/)
    expect(body).toMatch(/observed_at\s*<\s*now\(\)\s*-\s*make_interval\(secs\s*=>\s*(coalesce\()?p_grace_seconds/)
  })

  it('is service-role only and pins search_path', () => {
    expect(body).toMatch(
      /revoke all on function public\.sab_count_unrepriced\(integer\) from public, anon, authenticated/,
    )
    expect(body).toMatch(/grant execute on function public\.sab_count_unrepriced\(integer\) to service_role/)
    expect(body).toContain('set search_path = public')
  })
})
