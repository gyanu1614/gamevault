/**
 * Manual Escrow Release Trigger (Admin Only)
 *
 * For testing and manual escrow release
 * Only accessible by admins
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Process each order
    const results = []
    for (const order of orders) {
      try {
        const { error: releaseError } = await ((supabase as any).rpc('release_escrow', {
          order_id: order.id,
          method: 'auto',
        }))

        if (releaseError) {
          console.error(`❌ Failed to release escrow for order ${order.id}:`, releaseError)
          results.push({
            orderId: order.id,
            success: false,
            error: releaseError.message,
          })
        } else {
          console.log(`✅ Successfully released escrow for order ${order.id}`)
          results.push({
            orderId: order.id,
            success: true,
          })
        }
      } catch (error: any) {
        console.error(`Error processing order ${order.id}:`, error)
        results.push({
          orderId: order.id,
          success: false,
          error: error.message,
        })
      }
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
