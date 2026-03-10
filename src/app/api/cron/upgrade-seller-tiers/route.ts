/**
 * Upgrade Seller Tiers Cron Job
 *
 * Runs daily. Calls upgrade_all_seller_tiers() which checks every active seller
 * against the seller_tier_config thresholds and upgrades them (never downgrades).
 *
 * Invoke via:
 *   GET /api/cron/upgrade-seller-tiers
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Vercel Cron config (vercel.json):
 *   { "path": "/api/cron/upgrade-seller-tiers", "schedule": "0 3 * * *" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CRON_SECRET = process.env.CRON_SECRET

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceClient()

    // ── Run the upgrade function ─────────────────────────────────────────────
    const { data, error } = await supabase.rpc('upgrade_all_seller_tiers')

    if (error) {
      console.error('[upgrade-seller-tiers] RPC error:', error)
      return NextResponse.json(
        { error: 'Failed to run tier upgrade', details: error.message },
        { status: 500 }
      )
    }

    const upgradedCount = data as number
    console.log(`[upgrade-seller-tiers] Upgraded ${upgradedCount} sellers`)

    return NextResponse.json({
      success: true,
      upgraded: upgradedCount,
      message:
        upgradedCount === 0
          ? 'No sellers eligible for upgrade'
          : `Upgraded ${upgradedCount} seller${upgradedCount === 1 ? '' : 's'} to a higher tier`,
      ran_at: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[upgrade-seller-tiers] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    )
  }
}

// Allow POST as well (for manual triggers from admin dashboard)
export async function POST(request: NextRequest) {
  return GET(request)
}
