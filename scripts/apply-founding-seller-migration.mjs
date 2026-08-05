/**
 * One-off: apply supabase/migrations/20260802000000_profiles_founding_seller.sql
 * to the linked database via the service-role client + exec_sql RPC, then verify
 * the profiles.founding_seller column exists. Idempotent (IF NOT EXISTS).
 *
 * Usage: node scripts/apply-founding-seller-migration.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local (names → values), minimal parser (no dotenv dep needed).
const env = {}
for (const line of readFileSync(join(__dirname, '../.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const migrationPath = join(__dirname, '../supabase/migrations/20260802000000_profiles_founding_seller.sql')
const sql = readFileSync(migrationPath, 'utf-8')

console.log('Applying 20260802000000_profiles_founding_seller.sql …')

// exec_sql's param name differs across the repo's helpers; try both.
async function execSql(query) {
  let { error } = await supabase.rpc('exec_sql', { sql_query: query })
  if (error && /sql_query|function .*exec_sql/i.test(error.message || '')) {
    ;({ error } = await supabase.rpc('exec_sql', { query }))
  }
  return error
}

const err = await execSql(sql)
if (err) {
  console.error('❌ Migration failed:', err.message)
  console.error('   If exec_sql is unavailable, run the .sql manually in the Supabase SQL editor.')
  process.exit(1)
}
console.log('✅ Migration executed.')

// Verify: select the new column on one row (works even with 0 rows).
const { error: verifyErr } = await supabase.from('profiles').select('id, founding_seller').limit(1)
if (verifyErr) {
  console.error('❌ Verify failed — column not visible:', verifyErr.message)
  process.exit(1)
}
console.log('✅ Verified: profiles.founding_seller exists and is selectable.')
