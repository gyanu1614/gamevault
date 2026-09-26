/**
 * The test environment must not hold production credentials by default.
 *
 * Until 2026-09-12, src/test/setup-env.ts loaded .env.local into EVERY vitest
 * run, so tests held the production Supabase URL and a live RESEND_API_KEY. A
 * webhook integration test then inserted a real order against production and
 * drove the real dispatch chain, emailing live sellers and leaving 32 orphaned
 * notifications on real accounts over ~2 months.
 *
 * Now .env.test is the default and .env.local is opt-in via
 * ALLOW_REMOTE_GUARD_TESTS=1 — the same flag the DB guards already use.
 *
 * These assertions run in the DEFAULT environment, so they describe what a
 * plain `vitest run` sees. They self-skip under the opt-in, where holding real
 * credentials is the deliberate point.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

const optedIntoRemote = process.env.ALLOW_REMOTE_GUARD_TESTS === '1'
const suite = optedIntoRemote ? describe.skip : describe

suite('default test environment is isolated', () => {
  it('has no RESEND_API_KEY, so no send can reach the provider', () => {
    expect(process.env.RESEND_API_KEY).toBeUndefined()
  })

  it('points Supabase at a local stack, never a remote host', () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) return // no .env.test on this machine; integration tests self-skip
    const host = new URL(url).hostname
    expect(['127.0.0.1', 'localhost', '[::1]', '::1']).toContain(host)
    expect(url).not.toMatch(/supabase\.co/)
  })

  it('uses localhost app URLs, so nothing builds a production link', () => {
    for (const v of ['NEXT_PUBLIC_APP_URL', 'PUBLIC_API_URL']) {
      const val = process.env[v]
      if (val) expect(val).toMatch(/^https?:\/\/(localhost|127\.0\.0\.1)/)
    }
  })
})

describe('test env wiring', () => {
  it('setup-env defaults to .env.test and gates .env.local behind the flag', () => {
    const src = readFileSync('src/test/setup-env.ts', 'utf8')
    expect(src).toMatch(/ALLOW_REMOTE_GUARD_TESTS === '1'/)
    expect(src).toMatch(/'\.env\.local' : '\.env\.test'/)
  })

  it('ships a committed .env.test.example with no live key', () => {
    expect(existsSync('.env.test.example')).toBe(true)
    const example = readFileSync('.env.test.example', 'utf8')
    // The example must never carry a real Resend key or a remote Supabase host.
    expect(example).not.toMatch(/^RESEND_API_KEY=.+/m)
    expect(example).not.toMatch(/re_[A-Za-z0-9]{10,}/)
    expect(example).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/)
    expect(example).toMatch(/NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321/)
  })

  it('gitignores .env.test but keeps the example committed', () => {
    const ignore = readFileSync('.gitignore', 'utf8')
    expect(ignore).toMatch(/^\.env\.test$/m)
    expect(ignore).toMatch(/^!\.env\.test\.example$/m)
  })
})
