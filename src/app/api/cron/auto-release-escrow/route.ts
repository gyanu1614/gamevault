/**
 * Auto-Release Escrow Cron Job
 *
 * Automatically releases escrow for orders that have passed the 48-hour window
 * This should be called by a cron service (Vercel Cron, GitHub Actions, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { releaseDueOrder } from '@/lib/escrow/auto-release'

// Must be set in environment variables. No fallback — fail closed if unset
// so a missing CRON_SECRET can never be triggered with a known default token.
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (fail closed when the secret is not configured)
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Get orders ready for auto-release
    // Using the database function we created in the migration
    const { data: orders, error: fetchError } = await supabase.rpc(
      'get_orders_ready_for_auto_release'
    ) as any

    if (fetchError) {
      console.error('Error fetching orders ready for auto-release:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch orders', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orders ready for auto-release',
        processed: 0,
      })
    }

    console.log(`📦 Found ${orders.length} orders ready for auto-release`)

    // Process each order — gate re-check, CAS release, seller credit, and
    // completion comms all live in releaseDueOrder, shared with the admin
    // manual trigger so the two paths cannot drift.
    const results = []
    for (const order of orders) {
      results.push(await releaseDueOrder(order.id))
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Processed ${orders.length} orders`,
      processed: orders.length,
      successful: successCount,
      failed: failureCount,
      results,
    })
  } catch (error: any) {
    console.error('Unexpected error in auto-release cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
