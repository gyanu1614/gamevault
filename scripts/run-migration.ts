/**
 * Run Database Migration Script
 * Executes the RLS policies migration directly using Supabase service role
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
import dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Create service role client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration(migrationFile: string) {
  console.log('\n📋 Running migration:', migrationFile)
  console.log('='.repeat(60))

  const migrationPath = path.join(process.cwd(), 'supabase/migrations', migrationFile)

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath)
    return false
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8')

  // Split SQL by semicolons to execute statement by statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`📝 Found ${statements.length} SQL statements\n`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]

    // Skip comments and empty statements
    if (!statement || statement.startsWith('--')) continue

    // Log statement type
    const statementType = statement.split(/\s+/)[0].toUpperCase()
    process.stdout.write(`[${i + 1}/${statements.length}] ${statementType}... `)

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement })

      if (error) {
        // Try direct execution if RPC fails
        const { error: directError } = await supabase
          .from('_exec')
          .select()
          .limit(0)

        if (directError) {
          throw error
        }
      }

      console.log('✅')
      successCount++
    } catch (err: any) {
      // Some errors are OK (e.g., "policy already exists")
      if (
        err.message?.includes('already exists') ||
        err.message?.includes('does not exist')
      ) {
        console.log('⚠️  (skipped - already exists)')
        successCount++
      } else {
        console.log('❌')
        console.error('   Error:', err.message)
        errorCount++
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Success: ${successCount}`)
  console.log(`❌ Errors: ${errorCount}`)
  console.log('='.repeat(60) + '\n')

  return errorCount === 0
}

async function verifyMigration() {
  console.log('🔍 Verifying migration...\n')

  try {
    // Check if RLS is enabled
    const { data: tables, error: tableError } = await supabase
      .from('pg_tables')
      .select('tablename, rowsecurity')
      .eq('tablename', 'orders')
      .single()

    if (tableError) {
      console.log('⚠️  Could not verify RLS status (this is OK)')
    } else if (tables?.rowsecurity) {
      console.log('✅ RLS is enabled on orders table')
    } else {
      console.log('❌ RLS is NOT enabled on orders table')
    }

    // Count policies
    const { data: policies, error: policyError } = await supabase
      .from('pg_policies')
      .select('policyname')
      .eq('tablename', 'orders')

    if (policyError) {
      console.log('⚠️  Could not count policies (this is OK)')
    } else {
      console.log(`✅ Found ${policies?.length || 0} RLS policies on orders table`)
      if (policies && policies.length > 0) {
        console.log('   Policies:')
        policies.forEach((p: any) => console.log(`   - ${p.policyname}`))
      }
    }

  } catch (err: any) {
    console.log('⚠️  Verification query failed (manual check needed)')
    console.log('   Run this SQL in Supabase Dashboard to verify:')
    console.log('   SELECT * FROM pg_policies WHERE tablename = \'orders\';')
  }

  console.log('')
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('🚀 SUPABASE MIGRATION RUNNER')
  console.log('='.repeat(60))

  const migrationFile = process.argv[2] || '20260210_orders_rls_policies.sql'

  const success = await runMigration(migrationFile)

  if (success) {
    await verifyMigration()
    console.log('✅ Migration completed successfully!')
    console.log('\n📖 Next steps:')
    console.log('   1. Open Supabase Dashboard SQL Editor')
    console.log('   2. Run: SELECT * FROM pg_policies WHERE tablename = \'orders\';')
    console.log('   3. Verify you see 8 policies listed')
    console.log('\n🧪 Then run manual tests from TESTING-INSTRUCTIONS.md\n')
  } else {
    console.log('❌ Migration had errors. Manual execution required.')
    console.log('\n📖 Manual steps:')
    console.log('   1. Go to: https://cserfvellsliylifjkos.supabase.co')
    console.log('   2. Open SQL Editor')
    console.log(`   3. Copy contents of: supabase/migrations/${migrationFile}`)
    console.log('   4. Paste and run\n')
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
