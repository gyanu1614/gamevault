/**
 * Edge-runtime safety guard for src/middleware.ts.
 *
 * Why this exists: on 2026-09-13 every route on production returned
 * MIDDLEWARE_INVOCATION_FAILED. STATE-009 had wrapped
 * `src/lib/supabase/server.ts`'s createClient() in React `cache()`, and
 * middleware imported that module. Two things make that fatal on the edge:
 *
 *   1. react@18 does not export `cache` from ANY build. Server components only
 *      get it because Next aliases `react` to its own bundled copy
 *      (next/dist/compiled/react), which does export it. Middleware's edge
 *      bundle gets no such alias, so `cache` resolves to undefined and
 *      `cache(fn)` throws at MODULE SCOPE — before the handler ever runs.
 *   2. `cookies()` from next/headers is not available in middleware at all.
 *
 * The build printed "'cache' is not exported from 'react'" and it was waved
 * through as a false positive. It was not. This test makes that class of
 * regression fail in CI instead of in production.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')

/** Modules that are unavailable (or unsafe) inside the edge middleware bundle. */
const FORBIDDEN_IMPORTS = [
  { spec: 'next/headers', why: 'cookies()/headers() do not exist in middleware; use request.cookies' },
  { spec: 'next/cache', why: 'unstable_cache/revalidate* are server-component only' },
  { spec: 'fs', why: 'node-only API, not in the edge runtime' },
  { spec: 'node:fs', why: 'node-only API, not in the edge runtime' },
  { spec: 'path', why: 'node-only API, not in the edge runtime' },
  { spec: 'node:path', why: 'node-only API, not in the edge runtime' },
  { spec: 'crypto', why: 'node-only API; use globalThis.crypto (WebCrypto)' },
  { spec: 'node:crypto', why: 'node-only API; use globalThis.crypto (WebCrypto)' },
]

/** Named imports that do not exist in the edge bundle's copy of a package. */
const FORBIDDEN_NAMED = [{ spec: 'react', name: 'cache' }]

function resolveLocal(spec: string, fromFile: string): string | null {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null
  const base = spec.startsWith('@/')
    ? path.join(SRC, spec.slice(2))
    : path.resolve(path.dirname(fromFile), spec)
  for (const c of [
    base, `${base}.ts`, `${base}.tsx`,
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
  ]) {
    if (existsSync(c) && !c.endsWith(path.sep)) {
      try { if (readFileSync(c).length >= 0 && /\.tsx?$/.test(c)) return c } catch { /* dir */ }
    }
  }
  return null
}

/** Every import specifier in a source file, with its named bindings. */
function importsOf(file: string): { spec: string; names: string[] }[] {
  const src = readFileSync(file, 'utf8')
  const out: { spec: string; names: string[] }[] = []
  const re = /import\s+(?:type\s+)?([^'"]*?)\s*from\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const clause = m[1] ?? ''
    const names = [...clause.matchAll(/\{([^}]*)\}/g)]
      .flatMap((b) => b[1].split(','))
      .map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim())
      .filter(Boolean)
    out.push({ spec: m[2], names })
  }
  return out
}

/** Transitively walk middleware's local import graph. */
function middlewareGraph(): { file: string; imports: ReturnType<typeof importsOf> }[] {
  const entry = path.join(SRC, 'middleware.ts')
  const seen = new Set<string>()
  const queue = [entry]
  const graph: { file: string; imports: ReturnType<typeof importsOf> }[] = []
  while (queue.length) {
    const file = queue.shift()!
    if (seen.has(file)) continue
    seen.add(file)
    const imports = importsOf(file)
    graph.push({ file, imports })
    for (const { spec } of imports) {
      const local = resolveLocal(spec, file)
      if (local && !seen.has(local)) queue.push(local)
    }
  }
  return graph
}

describe('middleware edge-runtime safety', () => {
  it('react does not export cache() in the edge bundle (the actual prod failure)', () => {
    // The edge bundle resolves bare `react`, NOT next/dist/compiled/react.
    const require_ = createRequire(path.join(ROOT, 'noop.js'))
    const react = require_('react')
    expect(
      typeof (react as Record<string, unknown>).cache,
      'react@18 exports cache — if this ever flips, revisit this guard',
    ).toBe('undefined')
  })

  it('middleware graph imports no node-only or server-component-only module', () => {
    const violations: string[] = []
    for (const { file, imports } of middlewareGraph()) {
      const rel = path.relative(ROOT, file)
      for (const { spec } of imports) {
        const bad = FORBIDDEN_IMPORTS.find((f) => f.spec === spec)
        if (bad) violations.push(`${rel}: imports "${spec}" — ${bad.why}`)
      }
    }
    expect(violations, `edge-unsafe imports reachable from src/middleware.ts:\n${violations.join('\n')}`)
      .toEqual([])
  })

  it('middleware graph never imports cache from react', () => {
    const violations: string[] = []
    for (const { file, imports } of middlewareGraph()) {
      const rel = path.relative(ROOT, file)
      for (const { spec, names } of imports) {
        for (const f of FORBIDDEN_NAMED) {
          if (spec === f.spec && names.includes(f.name)) {
            violations.push(
              `${rel}: imports { ${f.name} } from "${f.spec}" — undefined on the edge; ` +
                `calling it at module scope throws MIDDLEWARE_INVOCATION_FAILED`,
            )
          }
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('middleware does not reach the cache()-wrapped supabase server client', () => {
    const reached = middlewareGraph().map(({ file }) => path.relative(ROOT, file))
    expect(
      reached,
      'src/lib/supabase/server.ts is cache()-wrapped for server components and must ' +
        'never enter the middleware bundle; middleware has its own edge-safe client.',
    ).not.toContain('src/lib/supabase/server.ts')
  })
})
