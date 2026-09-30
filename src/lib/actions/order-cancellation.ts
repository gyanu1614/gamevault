/**
 * Server Actions for Order Cancellation Requests
 *
 * Handles buyer-initiated cancellation requests that require admin approval
 * Only available for orders with delivery time >= 6 hours, an hour after payment
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { cancelRequestEligibility } from '@/lib/orders/cancel-request-eligibility'
// Money seams (CLAUDE.md): a cancellation's status move and the buyer's
// wallet credit are ONE RPC each (order_cancel_return_wallet /
// order_refund_to_wallet via lib/wallet/order-money), never composed here.
import { cancelOrderReturnWallet, refundOrderToWallet } from '@/lib/wallet/order-money'

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
        paid_at,
        delivered_at,
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

    // Same rule the order page uses to show the button: paid/delivering and
    // not delivered, a delivery time of 6 h+, an hour after payment.
    const eligibility = cancelRequestEligibility({
      status: order.status,
      delivered_at: order.delivered_at,
      paid_at: order.paid_at,
      created_at: order.created_at,
      deliveryTime: order.listing?.delivery_time,
    })
    if (!eligibility.eligible) {
      const message =
        eligibility.reason === 'short_delivery'
          ? 'Cancellation requests are only available for orders with delivery time of 6 hours or more'
          : eligibility.reason === 'too_soon'
            ? 'You can request a cancellation one hour after paying'
            : 'This order cannot be cancelled'
      return { error: { message } }
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
  adminNotes?: string,
  /**
   * Refund policy (2026-09-30): who is at fault. 'buyer' (default) credits
   * the item price and keeps the service fee; 'seller' (the seller went
   * quiet / could not deliver) credits everything and counts against the
   * seller's 5-in-7-days non-delivery fee.
   */
  fault: 'buyer' | 'seller' = 'buyer'
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
      // Shared order columns only: '*' on orders is refused to a session
      // client (orders column grant).
      .select('*, order:orders(id, buyer_id, seller_id, order_number, status, total_amount, currency)')
      .eq('id', requestId)
      .single() as any

    if (fetchError || !request) {
      return { error: { message: 'Cancellation request not found' } }
    }

    if (request.status !== 'pending') {
      return { error: { message: 'This request has already been processed' } }
    }

    // Approve: move the money FIRST, as ONE atomic RPC (CLAUDE.md money
    // seams), and only then mark the request approved. The old order
    // (mark approved -> transition -> separate wallet credit) could leave an
    // approved request with no refund and no way to retry, because a
    // non-pending request is refused above.
    //   paid                 -> order_cancel_return_wallet (CANCELLED + credit)
    //   delivering/delivered -> order_refund_to_wallet     (REFUNDED + credit)
    // A disputed order is settled through the dispute tools, not here.
    // What the RPC credits (the item price on a buyer-fault approval, the
    // total on a seller-fault one) — read back for the comms below.
    let creditedAmount = Number(request.order?.total_amount ?? 0)
    if (action === 'approve') {
      const order = request.order
      const dedupe = `cancel_request:${requestId}`
      try {
        const refundFault = fault === 'seller' ? 'seller' : 'buyer'
        const result =
          order.status === 'paid'
            ? await cancelOrderReturnWallet(request.order_id, dedupe, { allowPaid: true, closeAttemptAs: 'void', fault: refundFault })
            : order.status === 'delivering' || order.status === 'delivered'
              ? await refundOrderToWallet(request.order_id, dedupe, undefined, refundFault)
              : null
        if (!result) {
          return {
            error: {
              message: `This order is ${order.status}; it can't be cancelled here${order.status === 'disputed' ? ' — resolve the dispute instead' : ''}.`,
            },
          }
        }
        if (result.refused) {
          return { error: { message: 'The order could not be cancelled in its current state. Nothing was changed.' } }
        }
        if (result.creditedMinor != null) creditedAmount = Number(result.creditedMinor) / 100
      } catch (moneyError: any) {
        console.error('Error cancelling / refunding order:', moneyError)
        return {
          error: {
            message: `Failed to cancel the order: ${moneyError?.message ?? 'unknown error'}. Nothing was changed — please try again.`,
          },
        }
      }
    }

    // Record the decision (after the money, for an approval).
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
      return { error: { message: action === 'approve' ? 'The refund went through but saving the decision failed — refresh and check the request.' : 'Failed to process request' } }
    }

    if (action === 'approve') {
      const order = request.order

      // Tell the buyer their money is in their wallet (in-app + email,
      // wrapped — a comms failure must never fail the approval).
      await (async () => {
        const service = createServiceRoleClient()
        const orderRef =
          order.order_number || String(request.order_id).slice(0, 8).toUpperCase()
        const { error: notifError } = await (service.from('notifications').insert as any)({
          user_id: order.buyer_id,
          type: 'order_refunded',
          title: 'Refund In Your Store Balance',
          message: `Your cancellation for order #${orderRef} was approved — $${creditedAmount.toFixed(2)} was refunded to your Store Balance as store credit. Spend it at checkout with no service fee.`,
          link: '/account/wallet',
          is_read: false,
        })
        if (notifError) throw notifError
      })().catch((err) =>
        console.error('[Cancellation] Buyer refund notification failed:', err)
      )

      // Buyer refund email — mirrors cancelOrder's comms (wallet-aware copy;
      // the credit above already posted, so pending: false).
      await (async () => {
        const service = createServiceRoleClient()
        const orderRef =
          order.order_number || String(request.order_id).slice(0, 8).toUpperCase()
        const [{ data: buyer }, { data: cancelledListing }] = await Promise.all([
          service
            .from('profiles')
            .select('email, username, full_name')
            .eq('id', order.buyer_id)
            .single() as any,
          service
            .from('listings')
            .select('title')
            .eq('id', order.listing_id)
            .single() as any,
        ])
        if (buyer?.email) {
          const { sendOrderRefundedEmail } = await import('@/lib/email')
          await sendOrderRefundedEmail({
            to: buyer.email,
            name: buyer.full_name || buyer.username || 'Gamer',
            orderNumber: orderRef,
            listingTitle: cancelledListing?.title || 'your item',
            amount: creditedAmount,
            destination: 'your Store Balance',
            pending: false,
          })
        }
      })().catch((err) =>
        console.error('[Cancellation] Buyer refund email failed:', err)
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
