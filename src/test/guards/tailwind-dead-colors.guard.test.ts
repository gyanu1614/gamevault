/**
 * Tailwind colour classes that compile to NOTHING.
 *
 * Tailwind drops a class it cannot resolve without a word: no build error, no
 * console warning, the element just renders unstyled. Two shapes did this
 * site-wide (found 2026-09-28 by compiling a probe with the repo config):
 *
 *   - `amber` has no token in tailwind.config.ts and Tailwind's default amber
 *     has only numbered shades, so `text-amber`, `bg-amber/[0.12]`,
 *     `border-amber/30` … generate no CSS. Use `text-warning`, `bg-warning`,
 *     `bg-warning-bg`, `border-[rgba(255,178,62,0.30)]`.
 *   - Every colour in tailwind.config.ts whose value is a bare CSS variable
 *     (`lime: var(--color-accent-default)`, `bg.raised: var(--color-bg-raised)`,
 *     `text.*`, `border.*`, `ct.*`, `card`, `primary` …) has no `<alpha-value>`,
 *     so ANY opacity modifier on it generates nothing: `bg-lime/10`,
 *     `bg-bg-raised/95`, `text-text-primary/80`, `from-bg-base/0`. Use the
 *     token's own tint (`bg-lime-tint-bg`), the solid token, or the token mixed
 *     to that alpha: `bg-[color-mix(in_srgb,var(--color-bg-raised)_95%,transparent)]`.
 *     Not a hex copy — the surface palette moves (2026-09-29) and a copied
 *     rgba silently keeps the old colour.
 *
 * This test derives those colour roots from the config, pulls every
 * `<utility>-<root>…` token out of src, compiles them all with the repo's
 * Tailwind config, and fails on any token whose exact class name is not a
 * selector in the output (exact, not substring: `.text-amber` is a substring
 * of `.text-amber-400`). Pure source analysis — no DB, no Next runtime.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { describe, it, expect } from 'vitest'
import tailwindConfig from '../../../tailwind.config'

const ROOT = path.resolve(__dirname, '../../..')
const SRC = path.join(ROOT, 'src')

/** Dead tokens on lines another branch owns (a folder, or one token in a file).
 *  Each entry must still fire — delete it once that branch lands (the stale
 *  check below fails until you do). */
const PENDING: { path: string; token?: string; owner: string }[] = []

/** Top-level colour keys whose value (or any shade) is a CSS variable —
 *  Tailwind can't put an opacity modifier on those. `amber` isn't in the config
 *  at all (only Tailwind's numbered shades exist), so bare `text-amber` is dead. */
export function cssVarColorRoots(colors: Record<string, unknown>): string[] {
  const isVar = (v: unknown): boolean =>
    typeof v === 'string' ? v.includes('var(') : typeof v === 'object' && v !== null && Object.values(v).some(isVar)
  return Object.keys(colors).filter((k) => isVar(colors[k]))
}
const COLORS = (tailwindConfig.theme?.extend?.colors ?? {}) as Record<string, unknown>
export const COLOR_ROOTS = ['amber', ...cssVarColorRoots(COLORS)]

const UTILITY =
  '(?:bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|from|to|via|fill|stroke|divide|outline|shadow|decoration|caret|accent|placeholder)'
const COLOR_ROOT = [...COLOR_ROOTS].sort((a, b) => b.length - a.length).join('|')
// variant chain (hover:, md:, group-hover:, [&>svg]:, data-[state=on]: …), optional `!`, utility, colour root, rest
const TOKEN_RE = new RegExp(
  `(?<![\\w\\-/.\\[\\]])((?:[\\w\\-\\[\\]&>*@.=()#%,]+:)*!?${UTILITY}-(?:${COLOR_ROOT})(?![\\w])[\\w\\-/.\\[\\]()%,#]*)`,
  'g',
)

type Hit = { file: string; line: number; token: string }

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (full === path.join(SRC, 'test')) continue
      sourceFiles(full, out)
    } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

/** Blank out comments (keeping line numbers) so prose about a dead class doesn't
 *  count. Only comment shapes that can't be string content: `{/* … *\/}`, a
 *  `/* … *\/` opening its line, and `//` after whitespace — a bare `/*` search
 *  would start "comments" inside `'image/*'` or robots globs and hide real code. */
function stripComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
    .replace(/^\s*\/\*[\s\S]*?\*\//gm, blank)
    .replace(/(^|\s)\/\/.*$/gm, '$1')
}

/** A token glued to sentence punctuation (`… bg-lime.`) loses the punctuation. */
function trimToken(token: string): string {
  let t = token
  for (;;) {
    if (/[.,]$/.test(t)) t = t.slice(0, -1)
    else if (t.endsWith(')') && (t.match(/\(/g) ?? []).length < (t.match(/\)/g) ?? []).length) t = t.slice(0, -1)
    else return t
  }
}

export function extractTokens(source: string): { line: number; token: string }[] {
  const hits: { line: number; token: string }[] = []
  stripComments(source)
    .split('\n')
    .forEach((text, i) => {
      for (const m of text.matchAll(TOKEN_RE)) hits.push({ line: i + 1, token: trimToken(m[1]) })
    })
  return hits
}

function unescapeCss(ident: string): string {
  return ident
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\(.)/g, '$1')
}

/** Every class name (unescaped) that appears in a selector of the compiled CSS. */
export async function compiledClasses(tokens: string[]): Promise<Set<string>> {
  const result = await postcss([
    tailwindcss({ ...tailwindConfig, content: [{ raw: tokens.join('\n'), extension: 'html' }] }),
  ]).process('@tailwind components;\n@tailwind utilities;', { from: undefined })
  const classes = new Set<string>()
  result.root.walkRules((rule) => {
    for (const m of rule.selector.matchAll(/\.((?:\\[0-9a-fA-F]{1,6}\s?|\\[^\s]|[\w-])+)/g)) {
      classes.add(unescapeCss(m[1]))
    }
  })
  return classes
}

const hits: Hit[] = sourceFiles(SRC).flatMap((file) =>
  extractTokens(readFileSync(file, 'utf8')).map((h) => ({ file: path.relative(ROOT, file), ...h })),
)
let compiledHits: Promise<Set<string>> | undefined
const hitClasses = () => (compiledHits ??= compiledClasses([...new Set(hits.map((h) => h.token))]))
const pendingFor = (h: Hit) => PENDING.find((p) => h.file.startsWith(p.path) && (!p.token || p.token === h.token))

describe('tailwind dead colour classes guard', () => {
  it('derives the CSS-variable colour roots from tailwind.config.ts', () => {
    expect(COLOR_ROOTS).toEqual(
      expect.arrayContaining(['amber', 'lime', 'bg', 'text', 'border', 'ct', 'surface', 'card', 'primary', 'focus']),
    )
    // hex palettes take opacity fine — not roots
    expect(COLOR_ROOTS).not.toContain('violet')
    expect(cssVarColorRoots({ a: '#fff', b: { c: 'var(--c)' }, d: { e: '#000' } })).toEqual(['b'])
  })

  it('the checker keeps working classes and flags dead ones (exact match, not substring)', async () => {
    const live = [
      'bg-lime', 'text-lime-text', 'bg-lime-tint-bg', 'hover:bg-lime-hover', 'text-amber-400', 'text-warning',
      'bg-bg-raised', 'text-text-secondary', 'border-border-subtle', 'bg-ct-surface', 'bg-card', 'from-bg-base',
      'bg-[color-mix(in_srgb,var(--color-bg-raised)_95%,transparent)]',
    ]
    const dead = [
      'text-amber', 'bg-amber/[0.12]', 'bg-lime/10', 'hover:bg-lime/20', 'text-lime-text/40',
      'bg-bg-raised/95', 'text-text-primary/80', 'border-border-default/50', 'bg-ct-accent/10', 'from-bg-base/0',
      'bg-card/60', 'bg-surface-1/[0.5]',
    ]
    const classes = await compiledClasses([...live, ...dead])
    expect(live.filter((t) => !classes.has(t))).toEqual([])
    expect(dead.filter((t) => classes.has(t))).toEqual([])
  })

  it('extracts variant-prefixed tokens and ignores comments', () => {
    const src = [
      `<div className="p-2 hover:bg-lime/20 md:text-amber">`,
      `// text-amber is dead, use text-warning`,
      `/* bg-lime/10 */ cls('border-lime-tint-border') {/* text-lime/40 */}`,
      `<input accept="image/*" className="bg-lime/5" /> // was bg-amber`,
      `<nav className="bg-bg-raised/95 sm:text-gv-text-primary/60 text-base" style={{ color: 'var(--color-bg-raised)' }}>`,
    ].join('\n')
    expect(extractTokens(src)).toEqual([
      { line: 1, token: 'hover:bg-lime/20' },
      { line: 1, token: 'md:text-amber' },
      { line: 3, token: 'border-lime-tint-border' },
      { line: 4, token: 'bg-lime/5' },
      { line: 5, token: 'bg-bg-raised/95' },
      { line: 5, token: 'sm:text-gv-text-primary/60' },
    ])
  })

  it('scans the source tree (guards a vacuous pass)', () => {
    expect(hits.length).toBeGreaterThan(1000)
  })

  it('no colour class on a CSS-variable token (or amber) compiles to nothing', async () => {
    const classes = await hitClasses()
    const dead = hits
      .filter((h) => !classes.has(h.token) && !pendingFor(h))
      .map((h) => `${h.file}:${h.line}  ${h.token}`)
    expect(dead, `Tailwind generates no CSS for:\n${dead.join('\n')}`).toEqual([])
  })

  it('every PENDING entry still fires (delete the entries a landed branch fixed)', async () => {
    const classes = await hitClasses()
    const stale = PENDING.filter((p) => !hits.some((h) => !classes.has(h.token) && pendingFor(h) === p))
    expect(stale.map((p) => `${p.path} ${p.token ?? ''}`.trim())).toEqual([])
  })
})
