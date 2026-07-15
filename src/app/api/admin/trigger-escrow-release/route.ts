/**
 * Manual Escrow Release Trigger (Admin Only)
 *
 * For testing and manual escrow release
 * Only accessible by admins
 *
 * Runs the exact same pipeline as the auto-release cron (releaseDueOrder:
 * gate re-check → CAS release → transferEscrowToSeller → completion comms) —
 * it previously called the legacy release_escrow RPC, which only flipped
 * order status: the seller was never credited and no comms went out.
 *
 * Comms are intentionally NOT optional here: this route acts on the same
 * real orders the cron would pick up (get_orders_ready_for_auto_release)
 * and really moves money, so buyer/seller must be notified exactly as if
 * the cron had run. Admin-testing against fake orders gets comms to those
 * fake orders' users, which is the correct dress rehearsal of production.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { releaseDueOrder } from '@/lib/escrow/auto-release'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as any

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Get orders ready for auto-release
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

    console.log(`📦 Admin triggered auto-release for ${orders.length} orders`)

    // Process each order through the shared pipeline (never throws — every
    // failure mode is folded into the result so the batch keeps going).
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
    console.error('Unexpected error in manual escrow release:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
