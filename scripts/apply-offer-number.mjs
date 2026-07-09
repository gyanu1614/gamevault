/**
 * Apply the offer_number migration (supabase/migrations/add-offer-number.sql)
 * via the service-role exec_sql RPC, then verify the backfill.
 *
 * Run: node scripts/apply-offer-number.mjs
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/add-offer-number.sql'),
  'utf-8',
)

// Statement-by-statement (exec_sql implementations run one command per call).
const statements = sql
  .split(';')
  .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
  .filter((s) => s.length > 0)

async function exec(stmt) {
  // Older scripts in this repo disagree on the RPC arg name — try both.
  let { error } = await supabase.rpc('exec_sql', { query: stmt })
  if (error && /function|parameter|argument/i.test(error.message ?? '')) {
    ;({ error } = await supabase.rpc('exec_sql', { sql_query: stmt }))
  }
  return error
}

// `--verify` skips execution (use after pasting the SQL in the Supabase
// SQL editor, which is required when the exec_sql RPC doesn't exist).
if (!process.argv.includes('--verify')) {
  let failed = false
  for (const [i, stmt] of statements.entries()) {
    const head = stmt.split(/\s+/).slice(0, 3).join(' ')
    const error = await exec(stmt)
    if (error) {
      failed = true
      console.error(`[${i + 1}/${statements.length}] FAILED: ${head}\n  → ${error.message}`)
      break
    }
    console.log(`[${i + 1}/${statements.length}] ok: ${head}`)
  }

  if (failed) {
    console.error(
      '\nCould not execute via exec_sql RPC. Paste the SQL from\n' +
        'supabase/migrations/add-offer-number.sql into the Supabase SQL editor,\n' +
        'then re-run with: node scripts/apply-offer-number.mjs --verify',
    )
    process.exit(1)
  }
}

// Verify
const { count: nullCount } = await supabase
  .from('listings')
  .select('id', { count: 'exact', head: true })
  .is('offer_number', null)
const { data: sample } = await supabase
  .from('listings')
  .select('offer_number, title')
  .order('created_at', { ascending: false })
  .limit(3)
console.log('\nVerify — rows missing offer_number:', nullCount)
console.log('Latest rows:', sample)
