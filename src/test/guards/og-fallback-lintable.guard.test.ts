/**
 * `pnpm lint` was red on main with "Parsing error: Maximum call stack size
 * exceeded" for _ogFallback.ts: the embedded PNG was one 1,246-term
 * `'…' + '…' + …` expression, a left-nested BinaryExpression ~1,246 levels deep,
 * which overflows ESLint's recursive traversal. The file must stay a flat
 * array so the linter can read it. scripts/og/embed-category-fallback.mjs
 * regenerates it; this test fails if that script (or a hand edit) brings the
 * deep chain back.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

// eslint ships no type declarations and a types package is not worth a new
// dependency for one test, so describe the two calls used here.
type LintResult = { messages: { fatal?: boolean; message: string }[] }
type EslintClass = new (opts: { cwd: string }) => {
  lintText(code: string, opts: { filePath: string }): Promise<LintResult[]>
}

const ROOT = process.cwd()
const { ESLint } = createRequire(path.join(ROOT, 'noop.js'))('eslint') as { ESLint: EslintClass }

const FILE = path.join(ROOT, 'src/app/(marketplace)/[gameSlug]/[categorySlug]/_ogFallback.ts')

describe('_ogFallback.ts is lintable', () => {
  it('parses under the repo ESLint config (no fatal parse error)', async () => {
    const eslint = new ESLint({ cwd: ROOT })
    // lintText, not lintFiles: the path contains [gameSlug], which lintFiles reads as a glob.
    const [result] = await eslint.lintText(readFileSync(FILE, 'utf8'), { filePath: FILE })
    expect(result.messages.filter((m) => m.fatal)).toEqual([])
  })
})
