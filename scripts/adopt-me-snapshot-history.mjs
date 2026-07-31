/**
 * Daily price-history snapshot for Adopt Me.
 * ============================================================================
 * Captures one immutable row per (pet, variant) into adopt_me_price_history
 * from the CURRENT adopt_me_pet_values. Powers the sparklines and the 7-day
 * change indicator. Idempotent per calendar day (UTC) — safe to run repeatedly;
 * a second run on the same day upserts, it doesn't duplicate.
 *
 * History CANNOT be backfilled, so this must run every day — each missed day is
 * permanently lost. Runs in CI (see .github/workflows/adopt-me-daily.yml) after
 * the price refresh, or locally: `npm run adoptme:snapshot`.
 *
 * Only snapshots variants that have a cash value (observed or estimated). The
 * change indicator on the UI only shows once ≥2 distinct days exist.
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  } catch {
    // In CI there's no .env.local — env comes from the workflow's secrets.
  }
}
loadEnv()

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

async function main() {
  // Today (UTC) — one snapshot per calendar day.
  const today = new Date().toISOString().slice(0, 10)

  // Pull every priced variant row.
  const { data: values, error } = await sb
    .from('adopt_me_pet_values')
    .select('pet_id,variant,cash_value_usd,is_estimated')
    .not('cash_value_usd', 'is', null)

  if (error) throw new Error(`load values: ${error.message}`)
  if (!values?.length) {
    console.log('No priced variants to snapshot.')
    return
  }

  const rows = values.map((v) => ({
    pet_id: v.pet_id,
    variant: v.variant,
    cash_value_usd: v.cash_value_usd,
    is_estimated: v.is_estimated,
    history_date: today,
  }))

  // Upsert on the (pet_id, variant, history_date) unique key so re-runs on the
  // same day overwrite rather than duplicate.
  const { error: upErr } = await sb
    .from('adopt_me_price_history')
    .upsert(rows, { onConflict: 'pet_id,variant,history_date' })

  if (upErr) throw new Error(`snapshot upsert: ${upErr.message}`)
  console.log(`✅ Snapshotted ${rows.length} (pet, variant) rows for ${today}.`)
}

main().catch((err) => {
  console.error('❌ Snapshot failed:', err.message)
  process.exit(1)
})
