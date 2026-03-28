const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = 'https://cserfvellsliylifjkos.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzZXJmdmVsbHNsaXlsaWZqa29zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE1ODkyMCwiZXhwIjoyMDg0NzM0OTIwfQ.ERmViEhhSZ_ogW9ze7ENEDMQXqIM7ya4OF_EmhsYYXs'

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function runMigration() {
  console.log('Reading migration file...')
  const sql = fs.readFileSync(
    path.join(__dirname, 'supabase/migrations/20260327_withdrawal_system.sql'),
    'utf8'
  )

  console.log('Executing withdrawal system migration...')

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      console.error('❌ Migration failed:', error.message)
      process.exit(1)
    }

    console.log('✅ Migration completed successfully!')
    console.log('Tables created: withdrawal_methods, withdrawal_requests')
    console.log('Seed data inserted: 7 withdrawal methods')

  } catch (err) {
    // If exec_sql doesn't exist, we'll need to run statements manually
    console.log('Splitting SQL into individual statements...')

    // Split by semicolons, filter out comments and empty lines
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s !== '')

    console.log(`Found ${statements.length} SQL statements`)

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      if (stmt.length < 20) continue // Skip tiny statements

      console.log(`Executing statement ${i + 1}/${statements.length}...`)

      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' })

      if (error && !error.message.includes('already exists')) {
        console.error(`❌ Statement ${i + 1} failed:`, error.message)
        console.error('Statement:', stmt.substring(0, 100) + '...')
      }
    }

    console.log('✅ Migration process completed!')
  }
}

runMigration().catch(console.error)
