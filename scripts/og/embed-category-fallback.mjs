#!/usr/bin/env node
/**
 * Regenerate src/app/(marketplace)/[gameSlug]/[categorySlug]/_ogFallback.ts
 * from public/og/category-fallback.png (Step 7b). Run after replacing the
 * PNG; the guard test checks the two stay in sync.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const PNG = 'public/og/category-fallback.png'
const OUT = 'src/app/(marketplace)/[gameSlug]/[categorySlug]/_ogFallback.ts'

const bytes = readFileSync(PNG)
const lines = bytes.toString('base64').match(/.{1,120}/g).map((l) => `  '${l}'`).join(' +\n')
writeFileSync(
  OUT,
  `/**
 * The static branded card served for long-tail category pairs (Step 7b) —
 * public/og/category-fallback.png, embedded so the OG route can return it
 * from any runtime without bundler asset tracing (\`new URL(…, import.meta.url)\`
 * resolves to a public /_next/static path in the Node runtime and cannot be
 * fetched at build). Regenerate with scripts/og/embed-category-fallback.mjs.
 * ${bytes.length} bytes, 1200×630 PNG.
 */
export const OG_CATEGORY_FALLBACK_BASE64 =
${lines}

export function ogCategoryFallbackBytes(): ArrayBuffer {
  const buf = Buffer.from(OG_CATEGORY_FALLBACK_BASE64, 'base64')
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}
`,
)
console.log(`wrote ${OUT} from ${PNG} (${bytes.length} bytes)`)
