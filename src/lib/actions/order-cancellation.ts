/**
 * Server Actions for Order Cancellation Requests
 *
 * Handles buyer-initiated cancellation requests that require admin approval
 * Only available for orders with delivery time >= 6 hours, after 1 hour elapsed
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
// Ledger-backed money paths (funds-flow cutover): the order transition moves
// held escrow to refunds atomically, then the wallet credit (refunds →
// user_wallet) makes the buyer whole as store credit. The legacy
// ./wallet refundToWallet wrote the RLS-locked wallet_balances float table
// and silently stopped working after the ledger cutover.
import { transition } from '@/lib/escrow/transition'
import { refundToWallet } from '@/lib/wallet/wallet'

export interface CancellationRequest {
  id: string
  order_id: string
  buyer_id: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  admin_id?: string
  admin_notes?: string
  created_at: string
  processed_at?: string
}

/**
 * Create a cancellation request for an order
 */
export async function createCancellationRequest(
  orderId: string,
  reason: string
): Promise<{ data?: CancellationRequest; error?: { message: string } }> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: { message: 'You must be logged in to request cancellation' } }
    }

    // Validate the order belongs to the user and is eligible for cancellation
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        buyer_id,
        status,
        created_at,
        listing:listings(
          id,
          delivery_time
        )
      `)
      .eq('id', orderId)
      .single() as any

    if (orderError || !order) {
      return { error: { message: 'Order not found' } }
    }

    // Verify buyer owns this order
    if (order.buyer_id !== user.id) {
      return { error: { message: 'You can only request cancellation for your own orders' } }
    }

    // Check order status is eligible
    if (!['paid', 'processing', 'delivering', 'delivered'].includes(order.status)) {
      return { error: { message: 'This order cannot be cancelled' } }
    }

    // Parse delivery time to hours
    const getDeliveryHours = (deliveryTime?: string | null): number => {
      if (!deliveryTime) return 0
      const t = deliveryTime.toLowerCase().trim()
      if (t.includes('20min') || t.includes('20 min')) return 0.33
      if (t.includes('1hr') || t.includes('1 hour') || t.includes('0-1 hour')) return 1
      if (t.includes('3hr') || t.includes('3 hour')) return 3
      if (t.includes('6hr') || t.includes('6 hour') || t.includes('1-6 hour')) return 6
      if (t.includes('12hr') || t.includes('12 hour') || t.includes('6-12 hour')) return 12
      if (t.includes('24hr') || t.includes('1 day') || t.includes('12-24 hour') || t.includes('1-24 hour')) return 24
      if (t.includes('3 day') || t.includes('1-3 day')) return 72
      return 0
    }

    // Check delivery time requirement (>= 6 hours)
    const deliveryHours = getDeliveryHours(order.listing?.delivery_time)
    if (deliveryHours < 6) {
      return {
        error: {
          message: 'Cancellation requests are only available for orders with delivery time of 6 hours or more',
        },
      }
    }

    // Check time elapsed (>= 1 hour)
    const hoursSinceOrder = Math.floor(
      (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60)
    )
    if (hoursSinceOrder < 1) {
      return {
        error: {
          message: 'You must wait at least 1 hour after placing the order before requesting cancellation',
        },
      }
    }

    // Check if a PENDING request already exists (allow new requests after undo/rejection)
    const { data: existingRequest, error: checkError } = await supabase
      .from('order_cancellation_requests')
      .select('id, status, reason, created_at')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingRequest) {
      return { error: { message: 'A cancellation request is already pending for this order' } }
    }

    // Check if order was already approved for cancellation
    const { data: approvedRequest } = await supabase
      .from('order_cancellation_requests')
      .select('id, status')
      .eq('order_id', orderId)
      .eq('status', 'approved')
      .maybeSingle()

    if (approvedRequest) {
      return { error: { message: 'This order has already been cancelled' } }
    }

    // Validate reason
    if (!reason || reason.trim().length < 10) {
      return { error: { message: 'Please provide a reason of at least 10 characters' } }
    }

    if (reason.trim().length > 2000) {
      return { error: { message: 'Reason must be less than 2000 characters' } }
    }

    // Create the cancellation request
    const { data: request, error: createError } = await (supabase
      .from('order_cancellation_requests')
      .insert as any)({
        order_id: orderId,
        buyer_id: user.id,
        reason: reason.trim(),
        status: 'pending',
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating cancellation request:', createError)
      return { error: { message: 'Failed to submit cancellation request. Please try again.' } }
    }

    // Revalidate relevant paths
    revalidatePath('/account/orders')
    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath('/admin/orders')

    return { data: request }
  } catch (error: any) {
    console.error('Unexpected error in createCancellationRequest:', error)
    return { error: { message: error.message || 'An unexpected error occurred' } }
  }
}

/**
 * Get cancellation request for an order (buyer view)
 */
export async function getCancellationRequest(
  orderId: string
): Promise<{ data?: CancellationRequest; error?: { message: string } }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: { message: 'Unauthorized' } }
    }

    const { data, error } = await supabase
      .from('order_cancellation_requests')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .maybeSingle()

    if (error) {
      return { error: { message: error.message } }
    }

    return { data: data || undefined }
  } catch (error: any) {
    console.error('Error fetching cancellation request:', error)
    return { error: { message: error.message || 'Failed to fetch cancellation request' } }
  }
}

/**
 * Admin: Get all pending cancellation requests
 */
export async function getPendingCancellationRequests(): Promise<{
  data?: CancellationRequest[]
  error?: { message: string }
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: { message: 'Unauthorized' } }
    }

    // Verify admin role (check admin_roles table, not profiles.role)
    const { data: adminRole } = await supabase
      .from('admin_roles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .maybeSingle() as any

    if (!adminRole || !(adminRole as any).is_active) {
      return { error: { message: 'Admin access required' } }
    }

    const { data, error } = await supabase
      .from('order_cancellation_requests')
      .select(`
        *,
        order:orders(
          id,
          order_number,
          total_amount,
          status,
          buyer:profiles!buyer_id(
            id,
            username,
            email
          ),
          listing:listings(
            id,
            title,
            seller:profiles!seller_id(
              id,
              username
            )
          )
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pending requests:', error)
      return { error: { message: error.message } }
    }

    return { data: data as any }
  } catch (error: any) {
    console.error('Error in getPendingCancellationRequests:', error)
    return { error: { message: error.message || 'Failed to fetch requests' } }
  }
}

/**
 * Buyer: Cancel/undo a pending cancellation request
 */
export async function cancelCancellationRequest(
  orderId: string
): Promise<{ data?: boolean; error?: { message: string } }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: { message: 'You must be logged in' } }
    }

    // Get ALL pending requests for this order to verify ownership
    const { data: requests, error: fetchError } = await supabase
      .from('order_cancellation_requests')
      .select('id, buyer_id, status, reason')
      .eq('order_id', orderId)
      .eq('status', 'pending')

    if (fetchError || !requests || requests.length === 0) {
      return { error: { message: 'Cancellation request not found' } }
    }

    // Verify buyer owns these requests
    const buyerRequests = requests.filter((r: any) => r.buyer_id === user.id)
    if (buyerRequests.length === 0) {
      return { error: { message: 'You can only cancel your own requests' } }
    }

    // Delete ALL pending requests for this order by this buyer
    const { error: deleteError } = await supabase
      .from('order_cancellation_requests')
      .delete()
      .eq('order_id', orderId)
      .eq('buyer_id', user.id)
      .eq('status', 'pending')

    if (deleteError) {
      console.error('Error deleting cancellation requests:', deleteError)
      return { error: { message: 'Failed to cancel request' } }
    }

    // Revalidate paths
    revalidatePath('/account/orders')
    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath('/admin/orders')

    return { data: true }
  } catch (error: any) {
    console.error('Error in cancelCancellationRequest:', error)
    return { error: { message: error.message || 'Failed to cancel request' } }
  }
}

/**
 * Admin: Approve or reject a cancellation request
 */
export async function processCancellationRequest(
  requestId: string,
  action: 'approve' | 'reject',
  adminNotes?: string
): Promise<{ data?: CancellationRequest; error?: { message: string } }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: { message: 'Unauthorized' } }
    }

    // Verify admin role (check admin_roles table)
    const { data: adminRole } = await supabase
      .from('admin_roles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .maybeSingle() as any

    if (!adminRole || !(adminRole as any).is_active) {
      return { error: { message: 'Admin access required' } }
    }

    // Get the request
    const { data: request, error: fetchError } = await supabase
      .from('order_cancellation_requests')
      .select('*, order:orders(*)')
      .eq('id', requestId)
      .single() as any

    if (fetchError || !request) {
      return { error: { message: 'Cancellation request not found' } }
    }

    if (request.status !== 'pending') {
      return { error: { message: 'This request has already been processed' } }
    }

    // Update the request status
    const { data: updatedRequest, error: updateError } = await (supabase
      .from('order_cancellation_requests')
      .update as any)({
        status: action === 'approve' ? 'approved' : 'rejected',
        admin_id: user.id,
        admin_notes: adminNotes || null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating request:', updateError)
      return { error: { message: 'Failed to process request' } }
    }

    // If approved, cancel the order through the atomic ledger transition,
    // THEN credit the buyer's wallet. Order matters for the ledger chain:
    // the transition moves escrow_held → refunds, and the wallet credit
    // moves refunds → user_wallet, keeping every account balanced.
    if (action === 'approve') {
      const order = request.order

      try {
        // A delivered order cancels as a refund in the state machine
        // (delivered → cancelled is not a legal move; delivered → refunded is).
        const event = order.status === 'delivered' ? 'REFUNDED' : 'CANCELLED'
        await transition(request.order_id, event)
      } catch (transitionError: any) {
        console.error('Error cancelling order:', transitionError)
        return {
          error: {
            message: `Failed to cancel the order: ${transitionError?.message ?? 'unknown error'}. Please try again or contact support.`,
          },
        }
      }

      // Store-credit refund — 100% of what the buyer paid, instantly
      // (Refund & Dispute Policy). Idempotent on 'wallet_refund:<orderId>'.
      try {
        await refundToWallet({
          userId: order.buyer_id,
          amountMinor: BigInt(Math.round(Number(order.total_amount ?? 0) * 100)),
          currency: (order.currency || 'EUR').toUpperCase(),
          orderId: request.order_id,
        })
      } catch (refundError: any) {
        console.error('Error refunding to wallet:', refundError)
        return {
          error: {
            message: `Order cancelled but the wallet refund failed: ${refundError?.message ?? 'unknown error'}. Re-approve to retry the credit (it is idempotent) or contact support.`,
          },
        }
      }

      // Tell the buyer their money is in their wallet (in-app, wrapped —
      // a comms failure must never fail the approval).
      await (async () => {
        const service = createServiceRoleClient()
        const orderRef =
          order.order_number || String(request.order_id).slice(0, 8).toUpperCase()
        const { error: notifError } = await (service.from('notifications').insert as any)({
          user_id: order.buyer_id,
          type: 'order_refunded',
          title: 'Money In Your Wallet',
          message: `Your cancellation for order #${orderRef} was approved — $${Number(order.total_amount ?? 0).toFixed(2)} was refunded to your DropMarket wallet as store credit. Spend it instantly or withdraw it.`,
          link: '/account/wallet',
          is_read: false,
        })
        if (notifError) throw notifError
      })().catch((err) =>
        console.error('[Cancellation] Buyer refund notification failed:', err)
      )
    }

    // Revalidate paths
    revalidatePath('/admin/orders')
    revalidatePath('/account/orders')
    revalidatePath(`/account/orders/${request.order_id}`)

    return { data: updatedRequest }
  } catch (error: any) {
    console.error('Error in processCancellationRequest:', error)
    return { error: { message: error.message || 'Failed to process request' } }
  }
}
