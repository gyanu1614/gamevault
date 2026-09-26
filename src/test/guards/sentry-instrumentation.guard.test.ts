/**
 * Guard: the Sentry instrumentation hook must actually load.
 *
 * Why this exists: the first Sentry deploy (merge 0c85c45) reported nothing.
 * instrumentation.ts sat at the PROJECT ROOT, but this project has a src/
 * directory — and when src/ exists, Next 14 looks for src/instrumentation.ts
 * and nothing else. A root file is ignored with no warning and no build error:
 * `next build` succeeds, no instrumentation.js is emitted, Sentry.init() never
 * runs, and every captureException() is a silent no-op against an
 * uninitialized client. The verification route still returned its 500, which
 * made the whole thing look like it was working.
 *
 * Nothing in tsc, the build, or the existing suite catches that, so it is
 * asserted here directly.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

describe('sentry instrumentation wiring', () => {
  it('instrumentation.ts lives in src/, where Next looks when src/ exists', () => {
    expect(
      existsSync(path.join(ROOT, 'src', 'app')),
      'precondition: this project is expected to use a src/ directory',
    ).toBe(true)

    expect(
      existsSync(path.join(ROOT, 'src', 'instrumentation.ts')),
      'src/instrumentation.ts is missing — Sentry.init() will never run on the server',
    ).toBe(true)

    expect(
      existsSync(path.join(ROOT, 'instrumentation.ts')),
      'instrumentation.ts must NOT sit at the project root: with src/ present ' +
        'Next ignores it silently, and a stale root copy is indistinguishable ' +
        'from a working setup',
    ).toBe(false)
  })

  it('the client instrumentation file sits beside it in src/', () => {
    expect(existsSync(path.join(ROOT, 'src', 'instrumentation-client.ts'))).toBe(
      true,
    )
    expect(existsSync(path.join(ROOT, 'instrumentation-client.ts'))).toBe(false)
  })

  it('register() loads both runtime configs by relative path', () => {
    const src = readFileSync(
      path.join(ROOT, 'src', 'instrumentation.ts'),
      'utf8',
    )

    // From src/, the configs are one level up. A bare './sentry.server.config'
    // would resolve inside src/ and fail at runtime.
    expect(src).toContain("import('../sentry.server.config')")
    expect(src).toContain("import('../sentry.edge.config')")

    for (const rel of ['sentry.server.config.ts', 'sentry.edge.config.ts']) {
      expect(existsSync(path.join(ROOT, rel)), `${rel} is missing`).toBe(true)
    }
  })

  it('next.config.js turns on the instrumentation hook Next 14 requires', () => {
    const cfg = readFileSync(path.join(ROOT, 'next.config.js'), 'utf8')
    expect(
      /instrumentationHook:\s*true/.test(cfg),
      'experimental.instrumentationHook must be true on Next 14 or ' +
        'src/instrumentation.ts is never loaded',
    ).toBe(true)
  })

  it('every reporting path flushes before the runtime can freeze', () => {
    const paths = [
      'src/instrumentation.ts',
      'src/app/api/internal/sentry-test/route.ts',
      'src/app/error.tsx',
      'src/app/global-error.tsx',
    ]

    for (const rel of paths) {
      const src = readFileSync(path.join(ROOT, rel), 'utf8')
      expect(
        /Sentry\.flush\(/.test(src),
        `${rel} reports to Sentry but never flushes — on serverless the ` +
          'isolate can freeze before the event is transmitted',
      ).toBe(true)
    }
  })
})
