/**
 * One white, one set of greys, in one place (owner, 2026-11-06: ours looked dull beside
 * Eldorado, measured at #FFFFFF / #A8AAB3 / #898A93). The old scale was off-white and
 * blue-tinted, with copies written by hand across checkout, sell and buy-rails, so a
 * token change alone would have left those pages behind. Light surfaces with their own
 * ink (the payment page, the auth dialog) are the only exceptions.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')
const LIGHT_SURFACES = ['src/app/checkout/pay/', 'src/components/auth/', 'become-seller/_redesign', 'src/lib/email/']

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\./.test(name)) out.push(p)
  }
  return out
}

const files = walk(SRC)
  .map((p) => ({ path: relative(ROOT, p), code: readFileSync(p, 'utf8') }))
  .filter((f) => !LIGHT_SURFACES.some((s) => f.path.includes(s)))

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const token = (css: string, name: string) => new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1] ?? ''

describe('the text colours', () => {
  it('no see-through white for text: a faint decoration is fine, a grey comes from the tokens', () => {
    const SKIP_DEV = 'src/app/dev/'
    const bad = files
      .filter((f) => !f.path.includes(SKIP_DEV))
      .flatMap((f) => [...f.code.matchAll(/text-white\/(\d+)(?![\d.])/g)].filter((m) => Number(m[1]) >= 20).map((m) => `${f.path}: ${m[0]}`))
    expect(bad).toEqual([])
  })

  const tokens = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8')
  const themeV2 = readFileSync(join(SRC, 'styles/theme-v2.css'), 'utf8')

  it('primary is pure white, and the two token files agree', () => {
    expect(token(tokens, '--color-text-primary')).toBe('#FFFFFF')
    for (const name of ['--color-text-primary', '--color-text-secondary', '--color-text-tertiary', '--color-text-disabled', '--color-text-inverse']) {
      expect(token(themeV2, name), name).toBe(token(tokens, name))
    }
  })

  it('tertiary, the lowest text anyone must read, passes 4.5:1 on our lightest surface', () => {
    expect(contrast(token(tokens, '--color-text-tertiary'), token(tokens, '--color-bg-overlay'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token(tokens, '--color-text-secondary'), token(tokens, '--color-bg-overlay'))).toBeGreaterThanOrEqual(7)
  })

  it('the greys are neutral, not tinted blue or green', () => {
    for (const name of ['--color-text-secondary', '--color-text-tertiary']) {
      const hex = token(tokens, name)
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      expect(Math.max(r, g, b) - Math.min(r, g, b), name).toBeLessThanOrEqual(12)
    }
  })

  it('nothing writes the old scale by hand', () => {
    const old = /#E9EDF2|#9AA6B3|#6C7684|233,\s?237,\s?242|154,\s?166,\s?179/i
    const hits = files.filter((f) => old.test(f.code) && !f.path.endsWith('checkout/pay/[orderId]/qr.ts')).map((f) => f.path)
    expect(hits).toEqual([])
  })

  it('a pale or grey text colour comes from a token, not a hex in a class', () => {
    const hits: string[] = []
    for (const f of files) {
      for (const m of f.code.matchAll(/text-\[#([0-9a-fA-F]{6})\]/g)) {
        const hex = m[1]
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
        const grey = Math.max(r, g, b) - Math.min(r, g, b) <= 28
        // Dark inks on coloured buttons and badges are fine; this catches light greys.
        if (grey && luminance(`#${hex}`) > 0.12) hits.push(`${f.path}: ${m[0]}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('what you can click in a menu reads white', () => {
    const chrome = readFileSync(join(SRC, 'components/navbar/NavChrome.tsx'), 'utf8')
    expect(chrome).toMatch(/navMenuRowCls =\s*'[^']*text-text-primary/)
    expect(chrome).toMatch(/navMenuIconCls = '[^']*text-text-primary/)
  })
})
