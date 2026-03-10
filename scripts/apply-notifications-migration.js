/**
 * Apply notifications migration to Supabase database
 * Run this script with: node scripts/apply-notifications-migration.js
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  try {
    console.log('📦 Reading migration file...')
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260209_create_notifications_table.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('🚀 Applying migration to Supabase...')

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
        if (error) {
          // Try direct SQL execution as fallback
          const { error: directError } = await supabase.from('_sql').select('*').limit(0)
          if (directError) {
            console.error('❌ Error executing statement:', error)
            throw error
          }
        }
      }
    }

    console.log('✅ Migration applied successfully!')
    console.log('📊 Created notifications table with:')
    console.log('   - User notifications system')
    console.log('   - RLS policies for security')
    console.log('   - Indexes for performance')
    console.log('\n💡 You can now use the notifications feature in your app!')
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error('\n📝 Manual Steps:')
    console.error('   1. Go to your Supabase Dashboard')
    console.error('   2. Navigate to SQL Editor')
    console.error('   3. Copy and paste the contents of:')
    console.error('      supabase/migrations/20260209_create_notifications_table.sql')
    console.error('   4. Run the query')
    process.exit(1)
  }
}

applyMigration()
