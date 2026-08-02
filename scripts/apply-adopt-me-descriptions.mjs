/**
 * Applies the hand-written descriptions (scripts/adopt-me-descriptions.mjs) to
 * adopt_me_pets.description. Writing a description auto-flips the generated
 * has_page column to true, which is what publishes the /adopt-me/values/{slug}
 * page. Only pets with a description here get a page.
 *
 *   node scripts/apply-adopt-me-descriptions.mjs          # dry run
 *   node scripts/apply-adopt-me-descriptions.mjs --write  # persist
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { DESCRIPTIONS } from './adopt-me-descriptions.mjs'
import { DESCRIPTIONS_WAVE2 } from './adopt-me-descriptions-wave2.mjs'
import { DESCRIPTIONS_WAVE3 } from './adopt-me-descriptions-wave3.mjs'

function loadEnv() {
  // No-op when .env.local is absent (CI uses GitHub-secret env vars).
  let raw
  try {
    raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch (err) {
    if (err && err.code === 'ENOENT') return
    throw err
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
loadEnv()

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const write = process.argv.includes('--write')
const entries = Object.entries({
  ...DESCRIPTIONS,
  ...DESCRIPTIONS_WAVE2,
  ...DESCRIPTIONS_WAVE3,
})
console.log(`${entries.length} descriptions ${write ? '(writing)' : '(dry run)'}\n`)

let ok = 0
for (const [slug, description] of entries) {
  const len = description.trim().length
  const gate = len >= 200 ? 'has_page ✓' : `TOO SHORT (${len}<200) ✗`
  if (!write) {
    console.log(`  [dry] ${slug.padEnd(16)} ${len} chars — ${gate}`)
    continue
  }
  const { data, error } = await sb
    .from('adopt_me_pets')
    .update({ description })
    .eq('slug', slug)
    .select('slug,has_page')
    .maybeSingle()
  if (error) console.error(`  ❌ ${slug}: ${error.message}`)
  else if (!data) console.warn(`  ⚠️  ${slug}: no such pet (skipped)`)
  else {
    console.log(`  ✅ ${slug.padEnd(16)} ${len} chars — has_page=${data.has_page}`)
    ok++
  }
}

if (write) console.log(`\nUpdated ${ok}/${entries.length} pets.`)
else console.log('\nRe-run with --write to persist.')
