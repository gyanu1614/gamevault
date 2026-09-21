/**
 * sab_pipeline_lock_* — the marker that keeps a manual full reprice and the
 * scheduled crawl's import from overlapping silently.
 *
 * 2026-09-19 20:04Z: an 18-minute manual `pnpm reprice --game=sab --full`
 * from the owner's machine overlapped the scheduled crawl's import. Batch 22
 * of the import hit HTTP 546 then "canceling statement due to lock timeout"
 * on every retry and the job died with 10,837 listings crawled and not
 * landed. Nothing said what was holding the lock.
 *
 * A session-level pg_advisory_lock cannot carry this: PostgREST pools
 * connections, so the session that took the lock is not the session the next
 * request lands on. A row with a TTL is the honest primitive. This static read
 * pins what makes it safe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

function sql(): string {
  const file = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith('_sab_pipeline_lock.sql'),
  )
  if (!file) throw new Error('sab_pipeline_lock migration not found')
  return readFileSync(join(MIGRATIONS, file), 'utf8')
}

describe('sab_pipeline_lock_acquire / _release', () => {
  const body = sql()

  it('acquires atomically: one INSERT ... ON CONFLICT, never a read-then-write', () => {
    // Two contenders racing a SELECT + INSERT could both win. ON CONFLICT on
    // the primary key is the one-statement compare-and-set.
    expect(body).toMatch(/insert into public\.sab_pipeline_locks/)
    expect(body).toMatch(/on conflict \(name\) do update/)
  })

  it('takes over ONLY an expired lock, or its own — never a live one held by someone else', () => {
    expect(body).toMatch(/sab_pipeline_locks\.expires_at\s*<\s*now\(\)/)
    expect(body).toMatch(/sab_pipeline_locks\.holder\s*=\s*excluded\.holder/)
  })

  it('reports the current holder when it cannot acquire, so the log line can name it', () => {
    expect(body).toMatch(/returns table\s*\(\s*acquired boolean,\s*holder text,\s*acquired_at timestamptz,\s*expires_at timestamptz\s*\)/)
  })

  it('releases only by the holder that acquired it', () => {
    // A late release from a crashed-and-restarted holder must not free a lock
    // someone else has since taken over.
    expect(body).toMatch(/delete from public\.sab_pipeline_locks\s+where name = p_name\s+and holder = p_holder/)
  })

  it('refuses a nonsense TTL rather than creating an immortal lock', () => {
    expect(body).toMatch(/p_ttl_seconds/)
    expect(body).toContain('ttl must be between 1 second and 6 hours')
  })

  it('is service-role only, RLS on the table, search_path pinned', () => {
    expect(body).toMatch(/alter table public\.sab_pipeline_locks enable row level security/)
    expect(body).toMatch(/revoke all on function public\.sab_pipeline_lock_acquire\(text, text, integer\) from public, anon, authenticated/)
    expect(body).toMatch(/revoke all on function public\.sab_pipeline_lock_release\(text, text\) from public, anon, authenticated/)
    expect(body).toMatch(/grant execute on function public\.sab_pipeline_lock_acquire\(text, text, integer\) to service_role/)
    expect(body).toMatch(/grant execute on function public\.sab_pipeline_lock_release\(text, text\) to service_role/)
    expect((body.match(/set search_path = public/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})
