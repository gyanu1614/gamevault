/**
 * Auto-Release Escrow Cron Job
 *
 * Automatically releases escrow for orders that have passed the 48-hour window
 * This should be called by a cron service (Vercel Cron, GitHub Actions, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// This should be set in environment variables for security
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Get orders ready for auto-release
    // Using the database function we created in the migration
    const { data: orders, error: fetchError } = await supabase.rpc(
      'get_orders_ready_for_auto_release'
    )

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

    // Process each order
    const results = []
    for (const order of orders) {
      try {
        // Call the release_escrow function
        const { error: releaseError } = await supabase.rpc('release_escrow', {
          order_id: order.id,
          method: 'auto',
        })

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

          // TODO: Send notification emails
          // await sendEscrowReleasedEmail(order.buyer_id, order.id)
          // await sendPaymentReceivedEmail(order.seller_id, order.id)

          // TODO: Trigger Stripe payout to seller
          // await createStripePayout(order.seller_id, order.seller_payout)
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
