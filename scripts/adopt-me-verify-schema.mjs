// Verifies the adopt_me_* schema exists and has the expected shape.
// Read-only. Run AFTER applying supabase/migrations/20260731000000_adopt_me_values.sql
// in the Supabase SQL editor.
//
//   node scripts/adopt-me-verify-schema.mjs

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
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

let ok = true

async function tableExists(name) {
  const { error } = await sb.from(name).select('*', { head: true, count: 'exact' })
  const exists = !error
  console.log(`  ${exists ? '✅' : '❌'} table ${name}${error ? '  (' + error.message + ')' : ''}`)
  if (!exists) ok = false
  return exists
}

async function fnWorks() {
  // adopt_me_confidence_for(28) should return 'highly_accurate'
  const { data, error } = await sb.rpc('adopt_me_confidence_for', { listings: 28 })
  const good = !error && data === 'highly_accurate'
  console.log(`  ${good ? '✅' : '❌'} fn adopt_me_confidence_for(28) => ${error ? error.message : data}`)
  if (!good) ok = false
}

console.log('Adopt Me schema verification\n')
await tableExists('adopt_me_pets')
await tableExists('adopt_me_pet_values')
await tableExists('adopt_me_price_history')
await fnWorks()

console.log('\n' + (ok ? '✅ Schema looks good — ready to seed.' : '❌ Schema incomplete — re-check the migration ran without errors.'))
process.exit(ok ? 0 : 1)
