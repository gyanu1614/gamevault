'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireAdmin, requirePermission } from '@/lib/actions/admin-permissions'
import { logAdminActivity } from '@/lib/admin/activity-log'
import { ADMIN_ACTIONS } from '@/lib/admin/permissions-constants'
import { sendDisputeResolvedEmail, sendOrderRefundedEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import { refundToWallet } from '@/lib/wallet/wallet'
import { transition } from '@/lib/escrow/transition'

// ============================================
// TYPES
// ============================================

export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'awaiting_seller_response'
  | 'awaiting_buyer_response'
  | 'escalated'
  | 'resolved_buyer_favor'
  | 'resolved_seller_favor'
  | 'resolved_partial'
  | 'closed'

export type DisputeReason =
  | 'item_not_received'
  | 'not_as_described'
  | 'wrong_item'
  | 'partial_delivery'
  | 'quality_issue'
  | 'account_issue'
  | 'unauthorized_transaction'
  | 'seller_unresponsive'
  | 'other'

export type DisputePriority = 'low' | 'normal' | 'high' | 'urgent'

// ============================================
// GET DISPUTES
// ============================================

export async function getDisputes(filters?: {
  status?: DisputeStatus[]
  priority?: DisputePriority[]
  assignedTo?: string | 'unassigned'
  search?: string
  page?: number
  limit?: number
}) {
  await requirePermission('disputes.view')
  const supabase = await createClient()

  const page = filters?.page || 1
  const limit = filters?.limit || 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  // Get disputes with user info
  let query = supabase
    .from('disputes')
    .select(`
      *,
      buyer:buyer_id (username, full_name, avatar_url, email),
      seller:seller_id (username, full_name, avatar_url, email),
      assigned_admin:assigned_to (username, full_name)
    `, { count: 'exact' })

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status)
  }

  if (filters?.priority && filters.priority.length > 0) {
    query = query.in('priority', filters.priority)
  }

  if (filters?.assignedTo === 'unassigned') {
    query = query.is('assigned_to', null)
  } else if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo)
  }

  if (filters?.search) {
    const search = `%${filters.search}%`
    query = query.or(`title.ilike.${search}`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to) as any

  if (error) {
    return { success: false, error: error.message }
  }

  // Get order IDs to fetch order/listing/game info
  const orderIds = (data || []).map((d: any) => d.transaction_id).filter(Boolean)

  let ordersMap: Record<string, any> = {}
  if (orderIds.length > 0) {
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        listing:listing_id (
          title,
          game:game_id (
            name,
            image_url
          )
        )
      `)
      .in('id', orderIds)

    ordersMap = (orders || []).reduce((acc: any, order: any) => {
      acc[order.id] = order
      return acc
    }, {})
  }

  // Merge dispute + order data
  const disputes = (data || []).map((d: any) => {
    const order = ordersMap[d.transaction_id]
    return {
      ...d,
      buyer_username: d.buyer?.username,
      buyer_name: d.buyer?.full_name,
      buyer_email: d.buyer?.email,
      buyer_avatar: d.buyer?.avatar_url,
      seller_username: d.seller?.username,
      seller_name: d.seller?.full_name,
      seller_email: d.seller?.email,
      seller_avatar: d.seller?.avatar_url,
      assigned_admin_username: d.assigned_admin?.username,
      assigned_admin_name: d.assigned_admin?.full_name,
      order_number: order?.order_number,
      listing_title: order?.listing?.title,
      game_name: order?.listing?.game?.name,
      game_icon: order?.listing?.game?.image_url,
    }
  })

  return {
    success: true,
    disputes,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    }
  }
}

// ============================================
// GET SINGLE DISPUTE
// ============================================

export async function getDisputeById(disputeId: string) {
  await requirePermission('disputes.view')
  const supabase = await createClient()

  const [disputeResult, messagesResult] = await Promise.all([
    supabase
      .from('disputes_with_users')
      .select('*')
      .eq('id', disputeId)
      .single() as any,
    supabase
      .from('dispute_messages')
      .select(`
        *,
        sender:sender_id (
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true }) as any,
  ])

  if (disputeResult.error) {
    return { success: false, error: disputeResult.error.message }
  }

  await logAdminActivity({
    action: ADMIN_ACTIONS.DISPUTE_VIEWED,
    actionCategory: 'dispute',
    resourceType: 'dispute',
    resourceId: disputeId,
    resourceName: (disputeResult.data as any).title,
  })

  return {
    success: true,
    dispute: disputeResult.data,
    messages: messagesResult.data || [],
  }
}

// ============================================
// ASSIGN DISPUTE
// ============================================

export async function assignDispute(disputeId: string, adminId: string) {
  const admin = await requirePermission('disputes.assign')
  const supabase = await createClient()

  const { data: dispute, error: fetchError } = await supabase
    .from('disputes')
    .select('status, assigned_to, title')
    .eq('id', disputeId)
    .single() as any

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  const { error } = await (supabase
    .from('disputes')
    .update as any)({
      assigned_to: adminId,
      assigned_at: new Date().toISOString(),
      status: (dispute as any).status === 'open' ? 'under_review' : (dispute as any).status,
      first_response_at: (dispute as any).status === 'open' ? new Date().toISOString() : undefined,
    })
    .eq('id', disputeId)

  if (error) {
    return { success: false, error: error.message }
  }

  await (supabase.from('dispute_messages').insert as any)({
    dispute_id: disputeId,
    sender_id: admin.userId,
    message: `Dispute assigned to admin for review.`,
    is_system_message: true,
  })

  await logAdminActivity({
    action: ADMIN_ACTIONS.DISPUTE_ASSIGNED,
    actionCategory: 'dispute',
    resourceType: 'dispute',
    resourceId: disputeId,
    resourceName: dispute.title,
    previousState: { assigned_to: dispute.assigned_to },
    newState: { assigned_to: adminId },
  })

  revalidatePath('/admin/disputes')
  revalidatePath(`/admin/disputes/${disputeId}`)

  return { success: true }
}

// ============================================
// SEND MESSAGE
// ============================================

export async function sendDisputeMessage(
  disputeId: string,
  message: string,
  isInternal: boolean = false
) {
  const admin = await requirePermission('disputes.view')
  const supabase = await createClient()

  const { error } = await (supabase.from('dispute_messages').insert as any)({
    dispute_id: disputeId,
    sender_id: admin.userId,
    message,
    is_internal: isInternal,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  await logAdminActivity({
    action: ADMIN_ACTIONS.DISPUTE_MESSAGE_SENT,
    actionCategory: 'dispute',
    resourceType: 'dispute',
    resourceId: disputeId,
    metadata: { is_internal: isInternal },
  })

  revalidatePath(`/admin/disputes/${disputeId}`)

  return { success: true }
}

// ============================================
// RESOLVE DISPUTE
// ============================================

export async function resolveDispute(
  disputeId: string,
  resolution: {
    status: 'resolved_buyer_favor' | 'resolved_seller_favor' | 'resolved_partial'
    resolutionType: 'refund_full' | 'refund_partial' | 'no_refund' | 'replacement' | 'other'
    resolvedAmount?: number
    notes: string
  }
) {
  const admin = await requirePermission('disputes.resolve')
  const supabase = await createClient()

  const { data: dispute, error: fetchError } = await supabase
    .from('disputes_with_users')
    .select('*')
    .eq('id', disputeId)
    .single() as any

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  // Already resolved? Refuse — a stale tab / double-submit must not re-run
  // the money path with a different outcome. (A retry after a failed wallet
  // credit still works: the dispute row is only marked resolved AFTER the
  // credit posts, so a credit failure leaves the status unresolved.)
  const currentDisputeStatus = String((dispute as any).status ?? '')
  if (currentDisputeStatus.startsWith('resolved') || currentDisputeStatus === 'closed') {
    return { success: false, error: 'This dispute has already been resolved.' }
  }

  // Get the order with payment + party details
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, buyer_id, seller_id, order_number, currency, total_amount, escrow_status, status, listing:listing_id (title)')
    .eq('id', (dispute as any).transaction_id)
    .single() as any

  if (orderError || !order) {
    return { success: false, error: 'Order not found' }
  }

  const isPartial = resolution.resolutionType === 'refund_partial'
  const isRefund = resolution.resolutionType === 'refund_full' || isPartial

  // The buyer's store-credit amount. A FULL refund returns everything the
  // buyer paid (the ledger moves the full held gross to refunds); a PARTIAL
  // refund returns exactly the admin-entered amount.
  const refundAmount = isPartial
    ? Number(resolution.resolvedAmount || 0)
    : Number(order.total_amount || 0)

  if (isPartial && (!(refundAmount > 0) || refundAmount > Number(order.total_amount || 0))) {
    return {
      success: false,
      error: `Partial refund must be between $0.01 and $${Number(order.total_amount || 0).toFixed(2)}.`,
    }
  }

  // Flip the order + escrow through the atomic ledger transition FIRST so the
  // status change and its money movement post together (same ordering as
  // cancelOrder / processCancellationRequest / webhook dispatch — if the
  // transition fails, nothing has moved and the dispute stays open):
  //   refund_full    → DISPUTE_RESOLVED_BUYER (escrow_held → refunds; the
  //                    wallet credit below completes the chain
  //                    refunds → user_wallet)
  //   refund_partial → DISPUTE_PARTIAL (split journal, 20260720 migration:
  //                    escrow_held → refunds[partial] + platform take +
  //                    reduced seller_available)
  //   everything else→ DISPUTE_RESOLVED_SELLER (escrow_held →
  //                    platform take + seller_available)
  const disputeEvent =
    resolution.resolutionType === 'refund_full'
      ? ('DISPUTE_RESOLVED_BUYER' as const)
      : isPartial
      ? ('DISPUTE_PARTIAL' as const)
      : ('DISPUTE_RESOLVED_SELLER' as const)

  let transitionChanged = true
  try {
    const transitionResult = await transition(
      (dispute as any).transaction_id,
      disputeEvent,
      disputeId,
      disputeEvent === 'DISPUTE_RESOLVED_BUYER' ? undefined : 'dispute_resolved',
      disputeEvent === 'DISPUTE_PARTIAL'
        ? BigInt(Math.round(refundAmount * 100))
        : undefined
    )
    transitionChanged = transitionResult.changed
  } catch (orderUpdateError: any) {
    // Transition-first means a failure here is CLEAN: no money has moved and
    // the dispute is still open — the admin can simply retry.
    console.error('[Dispute] Order transition failed (nothing moved):', orderUpdateError)
    return {
      success: false,
      error: `Failed to resolve: ${orderUpdateError?.message ?? 'unknown error'}. No money has moved — please try again.`,
    }
  }

  // V23 — Refund to the buyer's WALLET (ledger-backed), instantly. Crypto
  // payments are irreversible, so refunds are an inbound wallet credit the
  // buyer can re-spend or withdraw. Idempotent: full refunds key on
  // 'wallet_refund:<orderId>'; partial refunds key on
  // 'wallet_refund:<orderId>:partial:<disputeId>' so they can't collide with
  // (or be swallowed by) a prior full-order refund key.
  if (isRefund && refundAmount > 0) {
    const currency = (order.currency || 'EUR').toUpperCase()

    // PARTIAL double-credit guard. The partial wallet key is dispute-scoped
    // (so a prior full-order key can't swallow it) — which means it is NOT
    // protected by the order-level idempotency the full path enjoys. If the
    // transition was a no-op (order already 'completed'), the split journal
    // funding this credit only exists when THIS resolution posted it earlier
    // (retry after a failed credit). If it's missing, the order was finalized
    // by a different outcome (e.g. a concurrent seller-favor resolution
    // already released the full payout) — crediting now would double-pay.
    if (isPartial && !transitionChanged) {
      const service = createServiceRoleClient()
      const { data: partialJournal } = await service
        .from('ledger_transactions')
        .select('id')
        .eq('idempotency_key', `order:${order.id}:DISPUTE_PARTIAL:${disputeId}`)
        .maybeSingle() as any
      if (!partialJournal) {
        return {
          success: false,
          error:
            'This order was already finalized by a different outcome, so the partial refund was NOT credited (it would double-pay). Review the order ledger before compensating manually.',
        }
      }
    }

    console.log(`[Dispute] Refunding ${resolution.resolutionType} of ${refundAmount} ${currency} to wallet for buyer ${order.buyer_id}`)

    try {
      await refundToWallet({
        userId: order.buyer_id,
        amountMinor: BigInt(Math.round(refundAmount * 100)),
        currency,
        orderId: order.id,
        keySuffix: isPartial ? `partial:${disputeId}` : undefined,
      })
    } catch (e: any) {
      // The order transition already posted (idempotently) — re-resolving the
      // dispute will no-op the transition and retry this credit.
      console.error('[Dispute] CRITICAL: wallet refund credit failed:', e?.message)
      return {
        success: false,
        error: `Order updated but the wallet credit failed: ${e?.message ?? 'unknown error'}. Resolve again to retry the credit (it is idempotent) or contact support.`,
      }
    }
    console.log('[Dispute] Wallet refund posted')
  }

  // Update dispute status
  const { error: disputeError } = await (supabase
    .from('disputes')
    .update as any)({
      status: resolution.status,
      resolution_type: resolution.resolutionType,
      resolved_amount: resolution.resolvedAmount,
      resolution_notes: resolution.notes,
      resolved_by: admin.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', disputeId)

  if (disputeError) {
    return { success: false, error: disputeError.message }
  }

  // Create entry in dispute_resolutions table for buyer/seller pages
  const favoredParty = resolution.status === 'resolved_buyer_favor' ? 'buyer'
    : resolution.status === 'resolved_seller_favor' ? 'seller'
    : 'neutral'

  const resolutionTypeMapping: Record<string, string> = {
    'refund_full': 'refund_buyer',
    'refund_partial': 'partial_refund',
    'no_refund': 'release_seller',
    'replacement': 'replacement',
    'other': 'other'
  }

  const { error: resolutionInsertError } = await (supabase
    .from('dispute_resolutions')
    .insert as any)({
      dispute_id: disputeId,
      resolved_by: admin.userId,
      resolution_type: resolutionTypeMapping[resolution.resolutionType] || 'other',
      favored_party: favoredParty,
      refund_amount: resolution.resolutionType.includes('refund') ? resolution.resolvedAmount : null,
      refund_percentage: resolution.resolutionType === 'refund_partial' && resolution.resolvedAmount
        ? (resolution.resolvedAmount / (order as any).total_amount) * 100
        : null,
      seller_payout_amount: resolution.resolutionType === 'no_refund' ? (order as any).total_amount :
        (resolution.resolutionType === 'refund_partial' && resolution.resolvedAmount
          ? (order as any).total_amount - resolution.resolvedAmount
          : null),
      resolution_notes: resolution.notes,
      resolved_at: new Date().toISOString(),
    })

  if (resolutionInsertError) {
    console.error('[Dispute] Failed to create dispute_resolutions entry:', resolutionInsertError)
    // Non-fatal - dispute is already marked as resolved
  }

  // Send resolution message to order conversation
  try {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('order_id', dispute.transaction_id)
      .single() as any

    if (conversation) {
      // Map status to simple resolution type
      const resolutionMap: Record<string, 'buyer_favor' | 'seller_favor' | 'partial'> = {
        'resolved_buyer_favor': 'buyer_favor',
        'resolved_seller_favor': 'seller_favor',
        'resolved_partial': 'partial'
      }

      // Create JSON system message for notification card
      const systemMessage = {
        type: 'dispute_resolved',
        resolution: resolutionMap[resolution.status] || 'seller_favor',
        notes: resolution.notes,
        refundAmount: resolution.resolvedAmount
      }

      await (supabase.from('messages').insert as any)({
        conversation_id: conversation.id,
        sender_id: '00000000-0000-0000-0000-000000000000', // System user ID
        content: JSON.stringify(systemMessage),
        is_read: false,
      })

      console.log('[Dispute] Resolution message sent to conversation')
    }
  } catch (convError) {
    console.error('[Dispute] Failed to send resolution message to conversation:', convError)
    // Non-fatal - dispute is already resolved
  }

  // Create navbar notifications for both buyer and seller about dispute resolution
  const orderRef = order.order_number || dispute.transaction_id.slice(0, 8).toUpperCase()
  try {
    const { createNotification } = await import('@/lib/utils/notifications')

    // Determine the outcome message based on resolution. When money moved,
    // the buyer copy says so — the store credit is already spendable.
    let outcomeTitle = 'Dispute Resolved'
    let buyerTitle = ''
    let buyerMessage = ''
    let buyerLink = `/account/orders/${dispute.transaction_id}`
    let sellerMessage = ''

    if (resolution.status === 'resolved_buyer_favor') {
      outcomeTitle = 'Dispute Resolved - Buyer Favor'
      buyerMessage = `Your dispute for order #${orderRef} was resolved in your favor. Check the order page for details.`
      sellerMessage = `The dispute for order #${orderRef} was resolved in buyer's favor. Check the order page for details.`
    } else if (resolution.status === 'resolved_seller_favor') {
      outcomeTitle = 'Dispute Resolved - Seller Favor'
      buyerMessage = `Your dispute for order #${orderRef} was resolved in seller's favor. Check the order page for details.`
      sellerMessage = `The dispute for order #${orderRef} was resolved in your favor. Check the order page for details.`
    } else {
      outcomeTitle = 'Dispute Resolved - Partial'
      buyerMessage = `Your dispute for order #${orderRef} has been resolved with a partial outcome. Check the order page for details.`
      sellerMessage = `The dispute for order #${orderRef} has been resolved with a partial outcome. Check the order page for details.`
    }

    if (isRefund && refundAmount > 0) {
      buyerTitle = 'Money In Your Wallet'
      buyerMessage =
        resolution.status === 'resolved_buyer_favor'
          ? `Your dispute for order #${orderRef} was resolved in your favor — $${refundAmount.toFixed(2)} was added to your DropMarket wallet as store credit. Spend it instantly or withdraw it.`
          : `Your dispute for order #${orderRef} was resolved with a partial refund — $${refundAmount.toFixed(2)} was added to your DropMarket wallet as store credit. Spend it instantly or withdraw it.`
      buyerLink = '/account/wallet'
    }

    // Create notification for buyer
    await createNotification({
      userId: order.buyer_id,
      type: 'dispute_resolved',
      title: buyerTitle || outcomeTitle,
      message: buyerMessage,
      link: buyerLink,
    })

    // Create notification for seller
    await createNotification({
      userId: order.seller_id,
      type: 'dispute_resolved',
      title: outcomeTitle,
      message: sellerMessage,
      link: `/seller/orders/${dispute.transaction_id}`,
    })

    console.log('[Dispute] Navbar resolution notifications created for buyer and seller')
  } catch (error) {
    console.error('[Dispute] Failed to create navbar resolution notifications:', error)
    // Non-fatal - dispute is already resolved
  }

  await logAdminActivity({
    action: ADMIN_ACTIONS.DISPUTE_RESOLVED,
    actionCategory: 'dispute',
    resourceType: 'dispute',
    resourceId: disputeId,
    resourceName: dispute.title,
    previousState: { status: dispute.status },
    newState: {
      status: resolution.status,
      resolution_type: resolution.resolutionType,
      resolved_amount: resolution.resolvedAmount,
    },
    notes: resolution.notes,
  })

  // Send emails. When the buyer got money back, reuse the wallet-aware
  // refund email (the credit already landed as store credit — the copy says
  // so); otherwise the buyer gets the plain dispute-resolved email. The
  // seller always gets the dispute-resolved email.
  await Promise.all([
    isRefund && refundAmount > 0
      ? sendOrderRefundedEmail({
          to: dispute.buyer_email,
          name: dispute.buyer_name || dispute.buyer_username,
          orderNumber: orderRef,
          listingTitle: (order as any).listing?.title || 'your item',
          amount: refundAmount,
          destination: 'your DropMarket wallet',
          pending: false,
        })
      : sendDisputeResolvedEmail({
          to: dispute.buyer_email,
          name: dispute.buyer_name || dispute.buyer_username,
          disputeId,
          orderId: (dispute as any).transaction_id,
          resolution: resolution.status,
          amount: resolution.resolvedAmount,
        }),
    sendDisputeResolvedEmail({
      to: dispute.seller_email,
      name: dispute.seller_name || dispute.seller_username,
      disputeId,
      orderId: (dispute as any).transaction_id,
      resolution: resolution.status,
      amount: resolution.resolvedAmount,
    }),
  ]).catch((err) => {
    // Comms failure must never fail an already-posted resolution.
    console.error('[Dispute] Resolution emails failed:', err)
  })

  revalidatePath('/admin/disputes')
  revalidatePath(`/admin/disputes/${disputeId}`)

  // Revalidate buyer and seller order pages so UI updates after resolution
  if (dispute.transaction_id) {
    revalidatePath(`/account/orders/${dispute.transaction_id}`)
    revalidatePath(`/seller/orders/${dispute.transaction_id}`)
    revalidatePath(`/account/orders`) // List page
    revalidatePath(`/seller/orders`) // List page
  }

  return { success: true }
}

// ============================================
// ESCALATE DISPUTE
// ============================================

export async function escalateDispute(disputeId: string, reason: string) {
  const admin = await requirePermission('disputes.escalate')
  const supabase = await createClient()

  const { data: dispute } = await supabase
    .from('disputes')
    .select('title')
    .eq('id', disputeId)
    .single() as any

  const { error } = await (supabase
    .from('disputes')
    .update as any)({
      status: 'escalated',
      priority: 'urgent',
      escalated_at: new Date().toISOString(),
      escalated_by: admin.userId,
      escalation_reason: reason,
    })
    .eq('id', disputeId)

  if (error) {
    return { success: false, error: error.message }
  }

  await (supabase.from('dispute_messages').insert as any)({
    dispute_id: disputeId,
    sender_id: admin.userId,
    message: `⚠️ Dispute escalated to senior review.\n\nReason: ${reason}`,
    is_system_message: true,
    is_internal: true,
  })

  await logAdminActivity({
    action: ADMIN_ACTIONS.DISPUTE_ESCALATED,
    actionCategory: 'dispute',
    resourceType: 'dispute',
    resourceId: disputeId,
    resourceName: dispute?.title,
    notes: reason,
  })

  revalidatePath('/admin/disputes')
  revalidatePath(`/admin/disputes/${disputeId}`)

  // Get transaction_id to revalidate order pages
  const { data: disputeData } = await supabase
    .from('disputes')
    .select('transaction_id')
    .eq('id', disputeId)
    .single() as any

  if (disputeData?.transaction_id) {
    revalidatePath(`/account/orders/${disputeData.transaction_id}`)
    revalidatePath(`/seller/orders/${disputeData.transaction_id}`)
  }

  return { success: true }
}

// ============================================
// GET DISPUTE STATS
// ============================================

export async function getDisputeStats() {
  await requirePermission('disputes.view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('disputes')
    .select('status, priority, created_at') as any

  if (error) {
    return { success: false, error: error.message }
  }

  const now = new Date()
  const stats = {
    total: data.length,
    open: data.filter((d: any) => d.status === 'open').length,
    underReview: data.filter((d: any) => d.status === 'under_review').length,
    escalated: data.filter((d: any) => d.status === 'escalated').length,
    awaitingResponse: data.filter((d: any) =>
      d.status === 'awaiting_seller_response' || d.status === 'awaiting_buyer_response'
    ).length,
    resolvedThisWeek: data.filter((d: any) => {
      const resolved = d.status.startsWith('resolved_')
      const createdAt = new Date(d.created_at)
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return resolved && createdAt > weekAgo
    }).length,
    urgent: data.filter((d: any) => d.priority === 'urgent' && !d.status.startsWith('resolved_')).length,
  }

  return { success: true, stats }
}
