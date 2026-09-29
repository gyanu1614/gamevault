/**
 * Focus states are NEUTRAL, never the green accent (owner rule, 2026-09-26).
 *
 * A focused control reads as "lit": a thin near-white ring or the field's own
 * border brightening, from the focus tokens in src/styles/tokens.css
 * (--color-focus-ring, --color-focus-ring-soft, --color-focus-border,
 * --shadow-focus; Tailwind ring-focus-ring / ring-focus-soft /
 * border-focus-border / shadow-focus). The green box around a clicked input
 * kept coming back one component at a time — 125 lime focus classes across
 * 57 files when this guard was written — so the rule is enforced here rather
 * than remembered. No DB.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '../../..')
const SRC = join(ROOT, 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(name) && !name.endsWith('.test.ts')) out.push(p)
  }
  return out
}

// A focus-state variant (focus / focus-visible / focus-within, incl. group-
// and peer- forms, possibly chained) followed by a ring/border/outline/shadow
// utility whose value is the accent: lime-*, accent, or a raw accent colour.
const FOCUS_ACCENT_CLASS =
  /(?:group-|peer-)?focus(?:-visible|-within)?:(?:[\w[\]&-]+:)*(?:ring|border|outline|shadow)-[^\s"'`]*(?:lime|accent|56B87F|2A7A50|86,184,127|42,122,80)/gi

// CSS: a :focus rule whose declarations use the accent.
const FOCUS_ACCENT_CSS = /:focus[^{]*\{[^}]*(?:86,\s*184,\s*127|#56B87F|#2A7A50|accent-default|accent-text)[^}]*\}/gi

describe('focus states are neutral, never the accent', () => {
  it('the focus tokens are neutral', () => {
    for (const file of ['src/styles/tokens.css', 'src/styles/theme-v2.css']) {
      const css = readFileSync(join(ROOT, file), 'utf8')
      const ring = css.match(/--color-focus-ring:\s*([^;]+);/)?.[1] ?? ''
      expect(ring, `${file} --color-focus-ring`).not.toMatch(/86,\s*184,\s*127|56B87F|2A7A50|accent/i)
    }
  })

  it('no component styles a focus state with the accent', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8')
      const hits = file.endsWith('.css') ? text.match(FOCUS_ACCENT_CSS) : text.match(FOCUS_ACCENT_CLASS)
      for (const hit of hits ?? []) offenders.push(`${relative(ROOT, file)}: ${hit.slice(0, 80)}`)
    }
    expect(offenders, 'use ring-focus-ring / ring-focus-soft / border-focus-border / shadow-focus').toEqual([])
  })
})
