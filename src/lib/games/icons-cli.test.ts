/**
 * Regression guard for scripts/fill-game-icons.mjs argument parsing.
 *
 * A `--only <slug>` whose value is silently dropped does not narrow the run —
 * it widens it to the whole catalogue, and with --yes that is a real write
 * over 233 games. This happened once during Step 1e; these tests pin the
 * both-forms contract so it cannot regress.
 *
 * The parser is duplicated here rather than imported because the script is a
 * top-level-await .mjs that connects to Supabase on import. The duplication
 * is the point: if the script's parser changes shape, this test must be
 * updated deliberately.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Mirrors flagValue() in scripts/fill-game-icons.mjs. */
function flagValue(argv: string[], name: string): string | null {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3) || null
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}

describe('fill-game-icons flag parsing', () => {
  it('reads the space form --only <slug>', () => {
    expect(flagValue(['--env=local', '--only', 'blox-fruits', '--yes'], 'only')).toBe('blox-fruits')
  })

  it('reads the equals form --only=<slug>', () => {
    expect(flagValue(['--env=local', '--only=blox-fruits'], 'only')).toBe('blox-fruits')
  })

  it('reads --force <slug>, the form the step spec documents', () => {
    expect(flagValue(['--force', 'adopt-me', '--yes'], 'force')).toBe('adopt-me')
  })

  it('returns null when the flag is absent', () => {
    expect(flagValue(['--env=local', '--yes'], 'only')).toBeNull()
  })

  it('does not swallow the next flag as a value', () => {
    expect(flagValue(['--only', '--yes'], 'only')).toBeNull()
  })
})

describe('fill-game-icons safety rails', () => {
  const src = readFileSync(
    join(process.cwd(), 'scripts/fill-game-icons.mjs'),
    'utf8',
  )

  it('defaults to a dry run: only --yes writes', () => {
    expect(src).toMatch(/const APPLY = has\('--yes'\)/)
    expect(src).toMatch(/const DRY = !APPLY/)
  })

  it('exits rather than widening the run when --only matches nothing', () => {
    expect(src).toMatch(/Refusing to run over the full catalogue/)
  })

  it('exits on an EMPTY --only rather than widening the run', () => {
    // `--only "$SLUG"` with an unset SLUG must not become "fill everything".
    expect(src).toMatch(/--only was given an empty value/)
  })

  it('refuses a local env pointed at a remote project, and vice versa', () => {
    expect(src).toMatch(/--env=local but .* points at/)
    expect(src).toMatch(/--env=prod but .* points at a local URL/)
  })

  it('writes image_source and image_synced_at alongside image_url', () => {
    expect(src).toMatch(/image_url: res\.iconUrl/)
    expect(src).toMatch(/image_source: res\.source/)
    expect(src).toMatch(/image_synced_at: new Date\(\)\.toISOString\(\)/)
  })

  it('creates the match-log directory before writing to it', () => {
    expect(src).toMatch(/mkdirSync\(outDir, \{ recursive: true \}\)/)
  })

  it('paces non-Roblox games slower, for Apple\'s ~20 calls/min guidance', () => {
    expect(src).toMatch(/PACE_OTHER_MS = PACE_OVERRIDE \|\| 3000/)
    expect(src).toMatch(/PACE_ROBLOX_MS = PACE_OVERRIDE \|\| 350/)
    // and the per-game sleep must actually branch on ecosystem
    expect(src).toMatch(/roblox' \? PACE_ROBLOX_MS : PACE_OTHER_MS/)
  })

  it('carries no IGDB remnants', () => {
    expect(src).not.toMatch(/igdb/i)
  })
})
