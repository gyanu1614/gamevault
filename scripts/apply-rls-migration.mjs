/**
 * Apply RLS Migration Directly
 * Uses Supabase Management API to execute SQL
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read .env.local
const envPath = join(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}

envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim()
  }
})

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Read migration file
const migrationPath = join(__dirname, '../supabase/migrations/20260210_orders_rls_policies.sql')
const sql = readFileSync(migrationPath, 'utf-8')

console.log('\n🚀 Applying RLS Migration...\n')
console.log('Migration: 20260210_orders_rls_policies.sql')
console.log('Target: orders table')
console.log('Actions: Enable RLS + Add 8 policies + Add indexes\n')

// Execute SQL using Supabase
const { data, error } = await supabase.rpc('exec_sql', { query: sql })

if (error) {
  console.error('❌ Migration failed:', error.message)
  console.error('\n📋 Manual steps required:')
  console.error('1. Go to: https://cserfvellsliylifjkos.supabase.co')
  console.error('2. Navigate to SQL Editor')
  console.error('3. Create new query')
  console.error('4. Copy entire contents of: supabase/migrations/20260210_orders_rls_policies.sql')
  console.error('5. Paste and click Run\n')
  process.exit(1)
}

console.log('✅ Migration applied successfully!\n')
console.log('🔍 Verifying...')

// Verify policies exist
const { data: policies } = await supabase
  .from('pg_policies')
  .select('policyname')
  .eq('tablename', 'orders')

console.log(`✅ Found ${policies?.length || 0} RLS policies\n`)

if (policies && policies.length > 0) {
  console.log('Policies created:')
  policies.forEach(p => console.log(`  - ${p.policyname}`))
}

console.log('\n✅ RLS Migration Complete!\n')
console.log('📖 Next: Run manual tests from TESTING-INSTRUCTIONS.md\n')
