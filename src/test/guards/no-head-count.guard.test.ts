/**
 * No `head: true` counts anywhere in src/ (checkout fix round B, Part 0).
 *
 * A supabase-js `select(…, { count: 'exact', head: true })` is an HTTP HEAD
 * through Kong to PostgREST. On 2026-09-22 the 405-order fee parity loop
 * lost 1–1.5 % of its order INSERTs to Kong 502 "upstream prematurely
 * closed connection" — on the request AFTER the HEAD, not the HEAD itself:
 * a HEAD response (headers, no body) leaves the upstream keep-alive socket
 * in a state the next request on it cannot use. Replacing the one HEAD
 * count on the checkout path with a bounded GET made the loop 405/405
 * (docs/handoff/checkout-fix-a.md). Every other HEAD count is the first
 * suspect for any "502 invalid response from upstream" flake, so none may
 * exist: count with `{ count: 'exact' }` + `.limit(1)` (the Content-Range
 * total still carries the exact count) or with an RPC.
 *
 * The allow-list is EMPTY on purpose. An entry needs the path and a reason,
 * and is the same review a new `force-dynamic` route would get.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(process.cwd(), 'src')
const SELF = relative(process.cwd(), __filename)

/** `{ path: reason }` — empty. See the header before adding anything. */
const ALLOWLIST: Record<string, string> = {}

const HEAD_TRUE = /\bhead\s*:\s*true\b/

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(ts|tsx|mts|cts|js|mjs)$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

/** Strip block and line comments so prose about the rule is not an offender. */
function withoutComments(source: string): string {
  return source
    // Keep the newlines of a block comment so reported line numbers stay true.
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
}

export function headCountOffenders(root = ROOT): string[] {
  const offenders: string[] = []
  for (const file of walk(root)) {
    const rel = relative(process.cwd(), file)
    if (rel === SELF) continue
    const code = withoutComments(readFileSync(file, 'utf8'))
    const lines = code.split('\n')
    lines.forEach((line, i) => {
      if (HEAD_TRUE.test(line)) offenders.push(`${rel}:${i + 1}`)
    })
  }
  return offenders.filter((o) => !(o.split(':')[0] in ALLOWLIST))
}

describe('no `head: true` counts in src/ (Kong keep-alive poisoning)', () => {
  it('scans a non-trivial tree', () => {
    expect(walk(ROOT).length).toBeGreaterThan(100)
  })

  it('the allow-list is empty', () => {
    expect(Object.keys(ALLOWLIST)).toEqual([])
  })

  it('finds no `head: true` outside the allow-list', () => {
    const offenders = headCountOffenders()
    expect(
      offenders,
      offenders.length
        ? `\`head: true\` counts poison the PostgREST keep-alive socket (see file header). ` +
          `Count with { count: 'exact' } + .limit(1), or an RPC:\n  ${offenders.join('\n  ')}`
        : '',
    ).toEqual([])
  })
})
