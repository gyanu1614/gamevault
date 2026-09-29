/**
 * The protection product is "SafeDrop Protection". Never "Buyer Protection".
 *
 * Owner, 2026-09-28: "we remove the buyer protection because it's against our
 * law ... we just write SafeDrop Protection". The approved tagline stays
 * "Item Guaranteed or Full Refund"; the no-custody rule is pinned separately
 * (buyer-copy-payout-timing.guard.test.ts).
 *
 * Scope is every string a user can see: string literals, template literal
 * text and JSX text in src/**\/*.{ts,tsx}. Comments and identifiers are free to
 * say "buyer protection" (the TypeScript scanner never hands them to us).
 * Tests are skipped so a guard can quote the phrase. No DB.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const BANNED = /buyer[\s -]*protection/i

/**
 * Exact literals, by file, owned by another open branch. Delete an entry when
 * that branch lands (it stops matching anything once the string is gone).
 */
const PENDING: Record<string, { texts: string[]; reason: string }> = {
  'src/app/account/orders/[orderId]/_OrderDetailsCard.tsx': {
    texts: [
      'Your purchase is covered by SafeDrop Buyer Protection. Not delivered or not as described? You get your money back.',
      'SafeDrop™ Buyer Protection',
    ],
    reason: 'renamed on fix/order-page-polish',
  },
  'src/lib/orders/timeline.ts': {
    texts: ['Paid and covered by SafeDrop Buyer Protection'],
    reason: 'renamed on fix/order-page-polish',
  },
  'src/app/checkout/pay/[orderId]/_PayClient.tsx': {
    texts: ['SafeDrop Buyer Protection'],
    reason: 'renamed on fix/order-page-polish',
  },
  'src/lib/email/index.ts': {
    texts: [
      "You're covered by SafeDrop Buyer Protection — Item Guaranteed or Full Refund. If it never arrives, you get a full refund.",
    ],
    reason: 'renamed on fix/order-page-polish',
  },
}

function walk(p: string): string[] {
  const abs = path.join(ROOT, p)
  if (!fs.existsSync(abs)) return []
  if (fs.statSync(abs).isFile()) return [p]
  return fs.readdirSync(abs).flatMap((child) => walk(path.join(p, child)))
}

const FILES = walk('src').filter(
  (f) =>
    /\.tsx?$/.test(f) &&
    !/\.d\.ts$/.test(f) &&
    !/\.test\.tsx?$/.test(f) &&
    !f.startsWith(path.join('src', 'test') + path.sep),
)

/** Every user-visible text fragment in a source file, whitespace-collapsed. */
function visibleStrings(fileName: string, source: string): string[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, kind)
  const out: string[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      const text = node.text.replace(/\s+/g, ' ').trim()
      if (text) out.push(text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

describe('visibleStrings', () => {
  it('reads strings, templates and JSX text, never comments', () => {
    const src = [
      '// Buyer Protection in a line comment',
      '/* Buyer Protection in a block comment */',
      "const a = 'A Buyer Protection string'",
      'const b = `Template ${a} Buyer Protection`',
      'const c = <p title="Attr buyer protection">SafeDrop Buyer\n  Protection</p>',
    ].join('\n')
    const hits = visibleStrings('x.tsx', src).filter((s) => BANNED.test(s))
    expect(hits).toEqual([
      'A Buyer Protection string',
      'Buyer Protection',
      'Attr buyer protection',
      'SafeDrop Buyer Protection',
    ])
  })
})

describe('SafeDrop Protection: no "Buyer Protection" in user-facing copy', () => {
  it('scans the source tree (guards a vacuous pass)', () => {
    expect(FILES.length).toBeGreaterThan(500)
    const layout = fs.readFileSync(path.join(ROOT, 'src/app/layout.tsx'), 'utf8')
    expect(visibleStrings('src/app/layout.tsx', layout).some((s) => s.includes('SafeDrop Protection'))).toBe(true)
  })

  it('no string, template or JSX text says "buyer protection"', () => {
    const offenders: string[] = []
    for (const f of FILES) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8')
      if (!BANNED.test(src)) continue
      const allowed = new Set(PENDING[f]?.texts ?? [])
      for (const s of visibleStrings(f, src)) {
        if (BANNED.test(s) && !allowed.has(s)) offenders.push(`${f}: ${s.slice(0, 120)}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
