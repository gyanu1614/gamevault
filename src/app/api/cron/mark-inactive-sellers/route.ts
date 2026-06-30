/**
 * Mark Inactive Sellers Offline Cron Job
 *
 * Marks sellers as offline if they haven't been active for 5 minutes
 * This should be called by a cron service every 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Call the database function to mark inactive sellers offline
    const { error } = await supabase.rpc('mark_inactive_sellers_offline')

    if (error) {
      console.error('Error marking inactive sellers offline:', error)
      return NextResponse.json(
        { error: 'Failed to mark sellers offline', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Successfully marked inactive sellers as offline')

    return NextResponse.json({
      success: true,
      message: 'Inactive sellers marked offline',
    })
  } catch (error: any) {
    console.error('Unexpected error in mark-inactive-sellers cron:', error)
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
