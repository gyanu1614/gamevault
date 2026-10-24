/**
 * The redesigned info pages (2026-10-15: /safedrop, /sell/fees, /blog,
 * /browse; 2026-10-23: /about, /contact, /delivery) and their shared kit carry no em or en dash in anything a visitor
 * reads (owner: human-written copy; the dash is the commonest AI tell).
 * Comments are free. No DB.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = [
  'src/components/info',
  'src/app/(marketing)/safedrop',
  'src/app/(marketing)/sell/fees',
  'src/app/(marketing)/about',
  'src/app/(marketing)/contact',
  'src/app/(marketing)/delivery',
  'src/app/blog',
  'src/app/browse',
]
const FILES = ['src/components/blog/GuideCard.tsx', 'src/components/blog/FeaturedGuide.tsx']

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return n.startsWith('[') ? [] : sources(p)
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : []
  })
}

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/ .*$/gm, '')

describe('info pages: no em or en dash in visible copy', () => {
  for (const file of [...ROOTS.flatMap((r) => sources(join(process.cwd(), r)).map((p) => p.slice(process.cwd().length + 1))), ...FILES]) {
    it(file, () => {
      expect(code(file)).not.toMatch(/[—–]/)
    })
  }
})
