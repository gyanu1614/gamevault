'use client'

import { useAuth } from '@/hooks/use-auth'
import { useOrderConversation } from '@/hooks/use-order-conversation'
import ChatInterface from '@/components/chat/ChatInterface'
import { getAvatarUrl } from '@/lib/utils/avatar'
import {
  CheckCircle2, Loader2, Eye, Star, MessageSquare,
  ShieldCheck, Zap, AlertCircle, ShieldAlert, X, Clock, ImagePlus, HelpCircle,
} from 'lucide-react'
import Image from 'next/image'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { confirmOrderReceipt, openDispute } from '@/lib/actions/orders'
import { createCancellationRequest, getCancellationRequest, cancelCancellationRequest } from '@/lib/actions/order-cancellation'
import { messagesApi } from '@/lib/api/seller-compatible'
import { toast } from 'sonner'
import OrderProgressBar from '@/components/orders/OrderProgressBar'
import DeliveryEvidenceViewer from '@/components/orders/DeliveryEvidenceViewer'
import DeliveryTimer from '@/components/orders/DeliveryTimer'
import OrderDetailsCard from '@/components/orders/OrderDetailsCard'
import ItemDetailsModal from '@/components/orders/ItemDetailsModal'
import LeaveReviewButton from '@/components/reviews/LeaveReviewButton'
import InstantDeliveryCodeDisplay from '@/components/orders/InstantDeliveryCodeDisplay'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface BuyerOrderDetailClientProps {
  order: any
  disputeResolution?: {
    status: string
    favored_party: 'buyer' | 'seller' | 'neutral'
    resolution_type: string
    refund_amount?: number
    refund_percentage?: number
    seller_payout_amount?: number
    resolution_notes?: string
    resolved_at: string
    buyer_username?: string
    seller_username?: string
  } | null
  timeRemaining: number
  hoursRemaining: number
  minutesRemaining: number
  protectionDays: number
}

// ── Primitives ─────────────────────────────────────────────────────────────────

function SidebarCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 transition-colors hover:border-white/[0.09]', className)}>
      {children}
    </div>
  )
}

function CardLabel({ icon: Icon, label, color = 'text-gray-500' }: { icon: React.ElementType; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={cn('h-3.5 w-3.5', color)} />
      <span className={cn('text-[10px] font-bold uppercase tracking-[0.12em]', color)}>{label}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

const DISPUTE_CATEGORIES = [
  { value: 'Item not as described',      label: 'Item not as described' },
  { value: 'Did not receive order',      label: 'Did not receive order' },
  { value: 'Wrong item received',        label: 'Wrong item received' },
  { value: 'Account credentials invalid', label: 'Account credentials invalid' },
  { value: 'Other',                      label: 'Other' },
]

export default function BuyerOrderDetailClient({
  order: initialOrder,
  disputeResolution: initialDisputeResolution,
  protectionDays,
}: BuyerOrderDetailClientProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [order, setOrder] = useState(initialOrder)
  const [disputeResolution, setDisputeResolution] = useState(initialDisputeResolution)

  // Confirm Receipt flip animation states
  const [showConfirmForm, setShowConfirmForm] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)

  // Open Dispute flip animation states
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [showDisputedState, setShowDisputedState] = useState(false)
  const [isOpeningDispute, setIsOpeningDispute] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  // Item Details Modal
  const [showItemDetailsModal, setShowItemDetailsModal] = useState(false)

  // Cancel Request states
  const [showCancelRequestForm, setShowCancelRequestForm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false)
  const [cancellationRequest, setCancellationRequest] = useState<any>(null)
  const [showCancelPendingState, setShowCancelPendingState] = useState(false)
  const [isUndoingCancel, setIsUndoingCancel] = useState(false)

  // Transition state for smooth animations
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Dispute wait timer tick (forces re-render every minute)
  const [, setTimerTick] = useState(0)

  const { conversation, conversationId, isLoading: conversationLoading } = useOrderConversation({
    orderId: order.id,
    autoCreate: true,
  })

  // Helper: Parse delivery time to hours
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

  // Calculate hours since order was created
  const hoursSinceOrder = order.created_at
    ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60))
    : 0

  // Determine if cancel request is available
  const deliveryHours = getDeliveryHours(order.listing?.delivery_time)
  // Hide button after admin makes a decision (approved/rejected) or if order is cancelled
  const canRequestCancel = deliveryHours >= 6
    && hoursSinceOrder >= 1
    && order.status !== 'delivered'
    && order.status !== 'completed'
    && order.status !== 'cancelled'
    && !cancellationRequest
    || (cancellationRequest && cancellationRequest.status === 'pending')

  // Dispute wait timer logic (for orders >= 1hr delivery, must wait 20 min before disputing)
  // INSTANT DELIVERY: No wait time - can dispute immediately
  const DISPUTE_WAIT_MINUTES = 20
  const isInstantDelivery = order.listing?.delivery_method === 'instant' || order.instant_delivery_code
  const needsDisputeWait = deliveryHours >= 1 && !isInstantDelivery
  const minutesSinceOrder = order.created_at
    ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60))
    : 0
  const canOpenDispute = !needsDisputeWait || minutesSinceOrder >= DISPUTE_WAIT_MINUTES
  const disputeWaitRemaining = needsDisputeWait
    ? Math.max(0, DISPUTE_WAIT_MINUTES - minutesSinceOrder)
    : 0

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [])

  // Update timer every minute if dispute wait is active
  useEffect(() => {
    if (needsDisputeWait && disputeWaitRemaining > 0) {
      const interval = setInterval(() => {
        setTimerTick(t => t + 1)
      }, 60000) // Update every minute
      return () => clearInterval(interval)
    }
  }, [needsDisputeWait, disputeWaitRemaining])

  // Fetch cancellation request on load
  useEffect(() => {
    async function fetchCancellationRequest() {
      const { data } = await getCancellationRequest(order.id)
      if (data) {
        setCancellationRequest(data)
        // Show pending state if request exists and is pending
        if (data.status === 'pending') {
          setShowCancelPendingState(true)
        }
      }
    }
    fetchCancellationRequest()
  }, [order.id])

  // Real-time order subscription
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`order-${order.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, (payload) => {
        setOrder((prev: any) => ({ ...prev, ...payload.new, listing: prev.listing, seller: prev.seller, buyer: prev.buyer }))
        // router.refresh() removed - local state update is sufficient, prevents infinite refresh loop
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [order.id, router])

  // Real-time conversation subscription
  useEffect(() => {
    if (!conversationId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`conversation-${conversationId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` }, () => {
        // Conversation updated - no need to refresh entire page, messages are handled separately
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [conversationId, router])

  // Real-time cancellation request subscription
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`cancellation-request-${order.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_cancellation_requests',
        filter: `order_id=eq.${order.id}`
      }, async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const newRequest = payload.new as any
          setCancellationRequest(newRequest)

          // If approved, hide the pending state (order will be cancelled via order subscription)
          if (newRequest.status === 'approved' || newRequest.status === 'rejected') {
            setShowCancelPendingState(false)
            if (newRequest.status === 'approved') {
              toast.success('Your cancellation request was approved. Order has been cancelled.')
            } else {
              toast.error('Your cancellation request was rejected. Please contact support for assistance.')
            }
          } else if (newRequest.status === 'pending') {
            setShowCancelPendingState(true)
          }
        } else if (payload.eventType === 'DELETE') {
          // Request was deleted (buyer undid it)
          setCancellationRequest(null)
          setShowCancelPendingState(false)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [order.id])

  // Dispute resolution is now passed as prop from server, no need to refetch
  // Real-time updates handled by order subscription above

  const conv = conversation as any
  // Always resolve avatar through getAvatarUrl — conv.seller may have avatar_url: null
  const sellerSource = conv?.seller || order.seller
  const otherUser = {
    id: sellerSource.id,
    username: sellerSource.username,
    avatar_url: getAvatarUrl(sellerSource.avatar_url, sellerSource.username),
  }

  const orderForChat: any = {
    id: order.id,
    order_number: order.order_number,
    listing: order.listing ? { title: order.listing.title, images: order.listing.images, game_id: order.listing.game_id } : null,
    total_amount: order.total_amount,
    status: order.status,
    created_at: order.created_at,
    chat_active_until: order.chat_active_until,
  }

  const orderNum = order.order_number || order.id.slice(0, 8).toUpperCase()

  // ── Confirm Receipt Handlers ──────────────────────────────────────────────────
  const handleConfirmReceipt = async () => {
    setIsConfirming(true)

    try {
      // Confirm order receipt
      const result = await confirmOrderReceipt(order.id)

      if (result.success) {
        // Send smart action message if conversationId is available
        if (conversationId) {
          try {
            await messagesApi.sendSmartActionMessage(conversationId, 'received', undefined)
          } catch (messageError) {
            console.error('Error sending notification message:', messageError)
            // Don't fail the whole operation if message fails
          }
        }

        toast.success('Order confirmed! Payment has been released to the seller.')

        // Flip to review form
        setShowConfirmForm(false)
        setTimeout(() => {
          setShowReviewForm(true)
        }, 300)

        router.refresh()
      } else {
        toast.error(result.error || 'Failed to confirm order')
      }
    } catch (error) {
      console.error('Error confirming order:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsConfirming(false)
    }
  }

  // ── Open Dispute Handlers ──────────────────────────────────────────────────
  const handleOpenDispute = async () => {
    if (!selectedCategory) {
      toast.error('Please select an issue type')
      return
    }
    if (selectedCategory === 'Other' && !disputeReason.trim()) {
      toast.error('Please describe what went wrong')
      return
    }

    setIsOpeningDispute(true)
    try {
      const result = await openDispute(order.id, selectedCategory, disputeReason)

      if (result.success) {
        // Always notify seller via chat
        if (conversationId) {
          try {
            await messagesApi.sendSmartActionMessage(
              conversationId,
              'disputed',
              `I've opened a dispute for this order.`
            )
          } catch (err) {
            console.error('Error sending dispute message:', err)
          }
        }

        toast.success('Dispute opened. Our support team will review within 24 hours.')

        // Flip to disputed state
        setShowDisputeForm(false)
        setTimeout(() => {
          setShowDisputedState(true)
        }, 300)

        router.refresh()
      } else {
        toast.error(result.error || 'Failed to open dispute')
      }
    } catch (error) {
      console.error('Error opening dispute:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsOpeningDispute(false)
    }
  }

  const canSubmitDispute = selectedCategory && (selectedCategory !== 'Other' || disputeReason.trim().length > 0)

  return (
    <div className="space-y-4 pb-32">
      {/* Progress bar / Leave Review section + Delivery Timer side by side */}
      {order.listing?.delivery_method === 'instant' ? (
        /* For instant delivery, show timer inline below progress bar */
        <div className="space-y-4">
          <div className="flex">
            {order.status === 'completed' ? (
              /* Order Completed + Leave Review Card */
              <div className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                {/* Order Completed Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-11 w-11 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Order Completed</h3>
                    <p className="text-xs text-gray-400">
                      {order.completed_at ? new Date(order.completed_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      }) : 'Recently'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Payment has been released to the seller.
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-white/[0.06] my-3.5" />

                {/* Leave Review Section */}
                <div>
                  <h4 className="text-xs font-semibold text-white mb-3">How was your experience?</h4>
                  <LeaveReviewButton
                    orderId={order.id}
                    sellerName={order.seller?.shop_name || order.seller?.username || 'Seller'}
                    onReviewSubmitted={() => {}}
                    className="w-full"
                  />
                </div>
              </div>
            ) : (
              /* Progress bar for non-completed orders */
              <div className="flex-1"><OrderProgressBar
                status={order.status}
                order={{
                  ...order,
                  auto_release_at: order.auto_release_at,
                  escrow_status: order.escrow_status,
                }}
                disputeResolution={disputeResolution ? {
                  status: disputeResolution.status,
                  favored_party: disputeResolution.favored_party,
                  resolution_type: disputeResolution.resolution_type,
                  refund_amount: disputeResolution.refund_amount,
                  resolved_at: disputeResolution.resolved_at,
                  resolution_notes: disputeResolution.resolution_notes,
                  buyer_username: disputeResolution.buyer_username,
                  seller_username: disputeResolution.seller_username,
                } : null}
              /></div>
            )}
          </div>
          <DeliveryTimer
            deliveringAt={order.delivering_at}
            deliveredAt={order.delivered_at}
            deliveryTime={order.listing?.delivery_time}
            deliveryMethod={order.listing?.delivery_method}
            role="buyer"
            orderStatus={order.status}
          />
        </div>
      ) : (
        /* For other delivery methods, use grid layout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          <div className="lg:col-span-2 flex">
            {order.status === 'completed' ? (
              /* Order Completed + Leave Review Card */
              <div className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                {/* Order Completed Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-11 w-11 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Order Completed</h3>
                    <p className="text-xs text-gray-400">
                      {order.completed_at ? new Date(order.completed_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      }) : 'Recently'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Payment has been released to the seller.
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-white/[0.06] my-3.5" />

                {/* Leave Review Section */}
                <div>
                  <h4 className="text-xs font-semibold text-white mb-3">How was your experience?</h4>
                  <LeaveReviewButton
                    orderId={order.id}
                    sellerName={order.seller?.shop_name || order.seller?.username || 'Seller'}
                    onReviewSubmitted={() => {}}
                    className="w-full"
                  />
                </div>
              </div>
            ) : (
              /* Progress bar for non-completed orders */
              <div className="flex-1"><OrderProgressBar
                status={order.status}
                order={{
                  ...order,
                  auto_release_at: order.auto_release_at,
                  escrow_status: order.escrow_status,
                }}
                disputeResolution={disputeResolution ? {
                  status: disputeResolution.status,
                  favored_party: disputeResolution.favored_party,
                  resolution_type: disputeResolution.resolution_type,
                  refund_amount: disputeResolution.refund_amount,
                  resolved_at: disputeResolution.resolved_at,
                  resolution_notes: disputeResolution.resolution_notes,
                  buyer_username: disputeResolution.buyer_username,
                  seller_username: disputeResolution.seller_username,
                } : null}
              /></div>
            )}
          </div>
          <div className="flex">
            <div className="flex-1">
              <DeliveryTimer
                deliveringAt={order.delivering_at}
                deliveredAt={order.delivered_at}
                deliveryTime={order.listing?.delivery_time}
                deliveryMethod={order.listing?.delivery_method}
                role="buyer"
                orderStatus={order.status}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">

        {/* ── CHAT (2/3) ────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col flex-1">

            {/* Chat header */}
            <div className="border-b border-white/[0.05] px-5 py-4 flex items-center gap-3 flex-shrink-0">
              {/* Seller avatar */}
              <div className="relative flex-shrink-0">
                <AvatarImage
                  src={otherUser.avatar_url}
                  alt={otherUser.username}
                  username={otherUser.username}
                  width={36}
                  height={36}
                  className="rounded-full ring-1 ring-white/10"
                />
                <div className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-[#111]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate leading-tight">
                  {order.seller.shop_name || otherUser.username}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">Seller</div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5">
                <MessageSquare className="h-3 w-3 text-gray-600" />
                <span className="text-[11px] font-mono font-medium text-gray-500">#{orderNum}</span>
              </div>
            </div>

            {/* Chat body */}
            <div className="h-[620px]">
              {conversationLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500/60" />
                </div>
              ) : conversationId && user ? (
                <ChatInterface
                  key={conversationId}
                  conversationId={conversationId}
                  currentUserId={user.id}
                  otherUser={otherUser}
                  order={orderForChat}
                  disputeResolution={disputeResolution ? {
                    favored_party: disputeResolution.favored_party
                  } : null}
                  className="h-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500/60" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SIDEBAR (1/3) ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">

          {/* ① Action Required — shown for all active order statuses (except disputed) */}
          {!['completed', 'cancelled', 'refunded'].includes(order.status) && order.status !== 'disputed' && (
            <SidebarCard className={cn(
              'relative overflow-hidden',
              order.status === 'delivered' ? 'border-green-500/15 bg-green-500/[0.03]' : 'border-violet-500/15 bg-violet-500/[0.03]'
            )}>

              {/* Blur overlay during transition */}
              {isTransitioning && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-lg z-10 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                </div>
              )}

              {/* ── Original State (Action Required) ────────────────────────── */}
              <div className={cn(
                "transition-all duration-300 ease-out",
                (showConfirmForm || showDisputeForm || showReviewForm || showDisputedState || showCancelRequestForm || showCancelPendingState)
                  ? "opacity-0 -translate-x-6 pointer-events-none absolute inset-0"
                  : "opacity-100 translate-x-0",
                isTransitioning && "blur-lg"
              )}>
                <CardLabel
                  icon={order.status === 'delivered' ? CheckCircle2 : Clock}
                  label="Action Required"
                  color={order.status === 'delivered' ? 'text-green-400' : 'text-violet-400'}
                />

                {/* Status-specific messaging */}
                {order.status === 'processing' && (
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    Your order is being processed. You'll be notified when the seller delivers the item.
                  </p>
                )}

                {order.status === 'paid' && (
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    Waiting for the seller to deliver your item. Delivery timer has started.
                  </p>
                )}

                {order.status === 'delivering' && (
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    Your item is being delivered. You'll be able to confirm receipt soon.
                  </p>
                )}

                {order.status === 'delivered' && (
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    {order.delivered_at
                      ? 'Seller has marked this as delivered. Has your item arrived? Confirm to release payment.'
                      : 'Has your item arrived? Only confirm if you have received it.'}
                  </p>
                )}

                {/* Action Buttons - Show for all active statuses */}
                {['paid', 'processing', 'delivering', 'delivered'].includes(order.status) && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setIsTransitioning(true)
                        setTimeout(() => {
                          setShowConfirmForm(true)
                          setIsTransitioning(false)
                        }, 150)
                      }}
                      disabled={isTransitioning}
                      className="w-full py-2 border border-green-500/25 bg-green-500/[0.07] hover:bg-green-500/[0.13] hover:border-green-500/40 text-green-400 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark as Received
                    </button>

                    {/* Cancel Request (only for 6h+ delivery time, after 1hr) OR Dispute */}
                    {canRequestCancel ? (
                      <button
                        onClick={() => {
                          setIsTransitioning(true)
                          setTimeout(() => {
                            setShowCancelRequestForm(true)
                            setIsTransitioning(false)
                          }, 150)
                        }}
                        disabled={isTransitioning}
                        className="w-full py-2 border border-amber-500/20 bg-amber-500/[0.05] hover:bg-amber-500/[0.10] hover:border-amber-500/35 text-amber-400/80 hover:text-amber-400 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Request Cancellation
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (!canOpenDispute) return
                          setIsTransitioning(true)
                          setTimeout(() => {
                            setShowDisputeForm(true)
                            setIsTransitioning(false)
                          }, 150)
                        }}
                        disabled={isTransitioning || !canOpenDispute}
                        className={cn(
                          "w-full py-2 border rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                          canOpenDispute
                            ? "border-red-500/20 bg-red-500/[0.05] hover:bg-red-500/[0.10] hover:border-red-500/35 text-red-400/80 hover:text-red-400"
                            : "border-gray-500/20 bg-gray-500/[0.05] text-gray-500 cursor-not-allowed opacity-60"
                        )}
                      >
                        {!canOpenDispute ? (
                          <>
                            <Clock className="w-4 h-4" />
                            Wait {disputeWaitRemaining}min
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4" />
                            Open Dispute
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Flipped State: Confirm Receipt Form ────────────────────────── */}
              <div className={cn(
                "transition-all duration-300 ease-out",
                showConfirmForm
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-6 pointer-events-none absolute inset-0",
                isTransitioning && "blur-lg"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-green-400">Confirm Receipt</span>
                </div>

                {!order.delivered_at && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] text-amber-400 font-semibold mb-1">Seller hasn't marked as delivered yet</p>
                        <p className="text-[9px] text-amber-400/70 leading-relaxed">
                          Only confirm if you have actually received your item. Payment will be released immediately.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  {order.delivered_at
                    ? 'Confirm that you received your item as described.'
                    : 'Only confirm if you have actually received your item.'}
                </p>

                <ul className="text-xs text-gray-500 mb-3 space-y-1.5 list-disc list-inside">
                  <li>You have received the order</li>
                  <li>Everything is as described</li>
                  <li>Payment will be released to seller</li>
                </ul>

                <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-[10px] text-yellow-400 mb-4">
                  ⚠️ This action cannot be undone.
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsTransitioning(true)
                      setTimeout(() => {
                        setShowConfirmForm(false)
                        setIsTransitioning(false)
                      }, 150)
                    }}
                    disabled={isConfirming || isTransitioning}
                    className="flex-1 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] text-xs text-gray-400 font-medium transition-colors disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmReceipt}
                    disabled={isConfirming}
                    className="flex-1 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-xs text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      'Confirm & Release'
                    )}
                  </button>
                </div>
              </div>

              {/* ── Flipped State: Review Form ────────────────────────── */}
              <div className={cn(
                "transition-all duration-300 ease-out",
                showReviewForm
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-6 pointer-events-none absolute inset-0"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">Leave a Review</span>
                </div>

                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                  Help other buyers by sharing your experience with this seller.
                </p>

                <button
                  onClick={() => {
                    setShowReviewForm(false)
                    // Open the full review modal
                    const reviewButton = document.querySelector('[data-review-button]') as HTMLButtonElement
                    reviewButton?.click()
                  }}
                  className="w-full py-2.5 rounded-xl border border-yellow-500/25 bg-yellow-500/[0.07] hover:bg-yellow-500/[0.13] text-sm text-yellow-400 font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Star className="w-4 h-4" />
                  Write Review
                </button>

                <button
                  onClick={() => setShowReviewForm(false)}
                  className="w-full mt-2 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] text-xs text-gray-500 font-medium transition-colors"
                >
                  Maybe Later
                </button>
              </div>

              {/* ── Flipped State: Request Cancellation Form ────────────────────────── */}
              <div className={cn(
                "transition-all duration-300 ease-out",
                showCancelRequestForm
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-6 pointer-events-none absolute inset-0",
                isTransitioning && "blur-lg"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <X className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Request Cancellation</span>
                </div>

                <p className="text-[10px] text-gray-500 mb-3">Admin will review within 24h</p>

                {/* Reason input */}
                <div className="mb-3">
                  <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-[0.08em] mb-1.5 block">
                    Reason for cancellation
                  </span>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Please explain why you want to cancel this order..."
                    className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/30 resize-none transition-colors"
                    rows={3}
                    maxLength={2000}
                    disabled={isSubmittingCancel}
                  />
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[9px] text-gray-600">Minimum 10 characters</span>
                    <span className={cn(
                      "text-[9px]",
                      cancelReason.length < 10 ? "text-gray-600" : "text-amber-400/60"
                    )}>
                      {cancelReason.length}/2000
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsTransitioning(true)
                      setTimeout(() => {
                        setShowCancelRequestForm(false)
                        setCancelReason('')
                        setIsTransitioning(false)
                      }, 150)
                    }}
                    disabled={isSubmittingCancel || isTransitioning}
                    className="flex-1 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] text-xs text-gray-400 font-medium transition-colors disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      if (cancelReason.trim().length < 10) {
                        toast.error('Please provide a reason of at least 10 characters')
                        return
                      }

                      setIsSubmittingCancel(true)
                      try {
                        const { data, error } = await createCancellationRequest(order.id, cancelReason.trim())

                        if (error) {
                          toast.error(error.message)
                        } else {
                          toast.success('Cancellation request submitted! Admin will review it shortly.')
                          setCancellationRequest(data)
                          setCancelReason('')
                          // Transition to pending state
                          setIsTransitioning(true)
                          setTimeout(() => {
                            setShowCancelRequestForm(false)
                            setShowCancelPendingState(true)
                            setIsTransitioning(false)
                          }, 150)
                        }
                      } catch (err: any) {
                        toast.error(err.message || 'Failed to submit cancellation request')
                      } finally {
                        setIsSubmittingCancel(false)
                      }
                    }}
                    disabled={isSubmittingCancel || cancelReason.trim().length < 10}
                    className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingCancel ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Request'
                    )}
                  </button>
                </div>
              </div>

              {/* ── Flipped State: Open Dispute Form ────────────────────────── */}
              <div className={cn(
                "transition-all duration-300 ease-out",
                showDisputeForm
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-6 pointer-events-none absolute inset-0",
                isTransitioning && "blur-lg"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="h-4 w-4 text-red-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-red-400">Open Dispute</span>
                </div>

                <p className="text-[10px] text-gray-500 mb-3">Support responds within 24h</p>

                {/* Category pills */}
                <div className="mb-3">
                  <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-[0.08em] mb-1.5 block">
                    What went wrong?
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DISPUTE_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(cat.value)}
                        disabled={isOpeningDispute}
                        className={cn(
                          "px-2 py-1 rounded-lg border text-[10px] font-medium transition-all",
                          selectedCategory === cat.value
                            ? 'border-red-500/40 bg-red-500/[0.12] text-red-400'
                            : 'border-white/[0.07] bg-white/[0.03] text-gray-500 hover:border-white/[0.12] hover:text-gray-400'
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description - only show when "Other" is selected */}
                {selectedCategory === 'Other' && (
                  <div className="mb-3">
                    <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-[0.08em] mb-1.5 block">
                      Details
                    </span>
                    <textarea
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Briefly describe what happened..."
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/30 resize-none transition-colors"
                      rows={3}
                      disabled={isOpeningDispute}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsTransitioning(true)
                      setTimeout(() => {
                        setShowDisputeForm(false)
                        setDisputeReason('')
                        setSelectedCategory('')
                        setIsTransitioning(false)
                      }, 150)
                    }}
                    disabled={isOpeningDispute || isTransitioning}
                    className="flex-1 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] text-xs text-gray-400 font-medium transition-colors disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleOpenDispute}
                    disabled={isOpeningDispute || !canSubmitDispute}
                    className="flex-1 py-2 rounded-xl border border-red-500/25 bg-red-500/[0.08] hover:bg-red-500/[0.15] text-xs text-red-400 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isOpeningDispute ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Opening…
                      </>
                    ) : (
                      'Open Dispute'
                    )}
                  </button>
                </div>
              </div>

              {/* ── Flipped State: Disputed Confirmation ────────────────────────── */}
              <div className={cn(
                "transition-all duration-300 ease-in-out",
                showDisputedState ? "opacity-100 scale-100" : "opacity-0 scale-95 absolute inset-0 pointer-events-none"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="h-4 w-4 text-orange-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Dispute Opened</span>
                </div>

                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  Your dispute has been submitted. Our support team will review it within 24 hours.
                </p>

                <div className="p-2.5 bg-orange-500/10 border border-orange-500/30 rounded-lg text-[10px] text-orange-400 mb-4">
                  📋 You'll receive updates via email and can track progress in your order history.
                </div>

                <button
                  onClick={() => setShowDisputedState(false)}
                  className="w-full py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] text-xs text-gray-400 font-medium transition-colors"
                >
                  Got it
                </button>
              </div>

              {/* ── Flipped State: Cancellation Pending ────────────────────────── */}
              <div className={cn(
                "transition-all duration-300 ease-out",
                showCancelPendingState
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-6 pointer-events-none absolute inset-0",
                isTransitioning && "blur-lg"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <HelpCircle className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Cancellation Pending</span>
                </div>

                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  Support is reviewing your cancellation request. Check back in a few hours for updates.
                </p>

                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] text-amber-400 mb-3">
                  ⏱️ Admin will review within 24h
                </div>

                {cancellationRequest?.reason && (
                  <div className="mb-3">
                    <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-[0.08em] mb-1.5 block">
                      Your Reason
                    </span>
                    <p className="text-xs text-gray-500 bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5 leading-relaxed">
                      {cancellationRequest.reason}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => window.open('/support', '_blank')}
                    className="w-full py-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.07] hover:bg-violet-500/[0.13] text-xs text-violet-400 font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Contact Live Support
                  </button>

                  <button
                    onClick={async () => {
                      setIsUndoingCancel(true)
                      try {
                        const { error } = await cancelCancellationRequest(order.id)
                        if (error) {
                          toast.error(error.message)
                        } else {
                          toast.success('Cancellation request withdrawn')
                          setCancellationRequest(null)
                          // Transition back to normal state
                          setIsTransitioning(true)
                          setTimeout(() => {
                            setShowCancelPendingState(false)
                            setIsTransitioning(false)
                          }, 150)
                        }
                      } catch (err: any) {
                        toast.error(err.message || 'Failed to undo request')
                      } finally {
                        setIsUndoingCancel(false)
                      }
                    }}
                    disabled={isUndoingCancel || isTransitioning}
                    className="w-full py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] text-xs text-gray-400 hover:text-gray-300 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isUndoingCancel ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Undoing...
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5" />
                        Undo Request
                      </>
                    )}
                  </button>
                </div>
              </div>
            </SidebarCard>
          )}

          {/* ⑤ Delivery Proof */}
          {order.delivery_evidence_urls && order.delivery_evidence_urls.length > 0 && (
            <SidebarCard>
              <CardLabel icon={Eye} label="Delivery Proof" color="text-violet-400" />
              <DeliveryEvidenceViewer evidenceUrls={order.delivery_evidence_urls} />
            </SidebarCard>
          )}

          {/* ⑤.5 Instant Delivery Code */}
          {(() => {
            console.log('[DEBUG] Order instant delivery data:', {
              hasCode: !!order.instant_delivery_code,
              code: order.instant_delivery_code ? '***HIDDEN***' : null,
              deliveryMethod: order.listing?.delivery_method,
              inventoryId: order.instant_delivery_inventory_id,
              deliveredAt: order.instant_delivery_delivered_at
            })
            return order.instant_delivery_code ? (
              <SidebarCard>
                <InstantDeliveryCodeDisplay
                  code={order.instant_delivery_code}
                  deliveryType={order.instant_delivery_inventory?.delivery_type}
                  orderNumber={order.order_number}
                />
              </SidebarCard>
            ) : null
          })()}

          {/* ⑥ Order Details */}
          <OrderDetailsCard
            order={order}
            role="buyer"
            onClick={() => setShowItemDetailsModal(true)}
          />

          {/* ⑦ Order Completed */}
          {order.status === 'completed' && (
            <>
              <SidebarCard className="border-green-500/20 bg-green-500/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center border border-green-500/25 bg-green-500/10 flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-green-400">Order Complete</div>
                    <div className="text-xs text-gray-600 mt-0.5">Payment released to seller</div>
                  </div>
                </div>
              </SidebarCard>
            </>
          )}

          {/* ⑧ VaultShield Protection - Clean & Confident */}
          {order.vaultshield_tier && (
            <SidebarCard className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
              {/* Header with tier badge */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                    <ShieldCheck className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-white">VaultShield™</div>
                    <div className="text-xs text-violet-400 font-medium">
                      {order.vaultshield_tier === 'standard' && '48-Hour Protection'}
                      {order.vaultshield_tier === 'enhanced' && '7-Day Protection'}
                      {order.vaultshield_tier === 'premium' && '30-Day Protection'}
                    </div>
                  </div>
                </div>
                <div className={cn(
                  'text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border',
                  order.vaultshield_tier === 'standard' && 'bg-blue-500/10 text-blue-400 border-blue-500/30',
                  order.vaultshield_tier === 'enhanced' && 'bg-violet-500/10 text-violet-400 border-violet-500/30',
                  order.vaultshield_tier === 'premium' && 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                )}>
                  {order.vaultshield_tier}
                </div>
              </div>

              {/* Active status with days remaining */}
              {protectionDays > 0 && order.status !== 'completed' && order.status !== 'refunded' && order.status !== 'cancelled' && (
                <div className="mb-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20 p-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex h-2.5 w-2.5 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-green-400">Active Protection</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {protectionDays} day{protectionDays !== 1 ? 's' : ''} remaining
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Clean 3-point guarantee */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-violet-400" />
                  </div>
                  <span className="text-sm text-gray-300 font-medium">Full refund guarantee</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-violet-400" />
                  </div>
                  <span className="text-sm text-gray-300 font-medium">Escrow-protected funds</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-violet-400" />
                  </div>
                  <span className="text-sm text-gray-300 font-medium">24/7 dispute support</span>
                </div>
              </div>

              {/* Protection expiry date */}
              {order.warranty_expires_at && (
                <div className="mb-4 pt-4 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Protection expires</span>
                    <span className="text-gray-300 font-medium">
                      {new Date(order.warranty_expires_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-4 border-t border-white/[0.06]">
                {order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'refunded' && (
                  <button
                    onClick={() => setShowDisputeForm(true)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-400 transition-colors hover:border-violet-500/50 hover:bg-violet-500/20"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>File a Claim</span>
                  </button>
                )}
                <a
                  href="/vaultshield"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs font-medium text-gray-400 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-gray-300"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Learn More</span>
                </a>
              </div>
            </SidebarCard>
          )}

          {/* ⑨ Payment Summary - Clean & Simple */}
          <SidebarCard>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Secure Payment</span>
            </div>

            {/* Amount breakdown */}
            <div className="space-y-2 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Order Price</span>
                <span className="text-xs text-gray-200 font-mono">${(order.subtotal || order.unit_price || 0).toFixed(2)}</span>
              </div>
              {order.platform_fee > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Platform Fee</span>
                  <span className="text-xs text-gray-500 font-mono">${order.platform_fee.toFixed(2)}</span>
                </div>
              )}
              {order.vaultshield_tier && order.vaultshield_tier !== 'standard' && order.vaultshield_tier_fee > 0 && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3 text-violet-400" />
                    <span className="text-xs text-violet-400 font-medium">
                      VaultShield {order.vaultshield_tier.charAt(0).toUpperCase() + order.vaultshield_tier.slice(1)}
                    </span>
                  </div>
                  <span className="text-xs text-violet-400 font-mono">+${order.vaultshield_tier_fee.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-white/[0.05] flex justify-between items-center">
                <span className="text-sm font-semibold text-white">Total Paid</span>
                <span className="text-xl font-bold text-white font-mono">${order.total_amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Escrow protection badge */}
            <div className={cn(
              "rounded-xl px-4 py-3",
              order.status === 'cancelled'
                ? "bg-gradient-to-r from-blue-500/10 to-cyan-500/5 border border-blue-500/20"
                : order.status === 'completed'
                ? "bg-gradient-to-r from-emerald-500/10 to-green-500/5 border border-emerald-500/20"
                : "bg-gradient-to-r from-violet-500/10 to-purple-500/5 border border-violet-500/20"
            )}>
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  order.status === 'cancelled'
                    ? "bg-blue-500/20"
                    : order.status === 'completed'
                    ? "bg-emerald-500/20"
                    : "bg-violet-500/20"
                )}>
                  <ShieldCheck className={cn(
                    "h-4.5 w-4.5",
                    order.status === 'cancelled'
                      ? "text-blue-400"
                      : order.status === 'completed'
                      ? "text-emerald-400"
                      : "text-violet-400"
                  )} />
                </div>
                <div className="flex-1">
                  <div className={cn(
                    "text-xs font-bold mb-0.5",
                    order.status === 'cancelled'
                      ? "text-blue-400"
                      : order.status === 'completed'
                      ? "text-emerald-400"
                      : "text-violet-400"
                  )}>
                    {order.status === 'cancelled'
                      ? 'Refunded to Wallet'
                      : order.status === 'completed'
                      ? 'Funds Released to Seller'
                      : 'Funds in Escrow'}
                  </div>
                  <div className="text-[10px] text-gray-500 leading-relaxed">
                    {order.status === 'cancelled'
                      ? 'Full refund credited to your wallet'
                      : order.status === 'completed'
                      ? 'Payment successfully transferred'
                      : 'Held securely until delivery confirmed'}
                  </div>
                </div>
              </div>
            </div>

            {/* Simple trust points - only essential info */}
            <div className="mt-4 pt-4 border-t border-white/[0.05] space-y-2.5">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                <span className="text-[11px] text-gray-500">Seller paid only after you confirm</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                <span className="text-[11px] text-gray-500">Dispute protection active</span>
              </div>
            </div>
          </SidebarCard>

          {/* Support Button - Below Secure Payment */}
          {order.status === 'completed' && (
            <SidebarCard className="p-3">
              <button
                onClick={() => {
                  // TODO: Implement live chat support when ready
                  toast.info('Support feature coming soon! For now, please contact us via email.')
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-blue-500/25 bg-blue-500/[0.07] hover:bg-blue-500/[0.13] hover:border-blue-500/40 text-blue-400 text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <HelpCircle className="w-4 h-4" />
                Need Help? Contact Support
              </button>
              <p className="text-[10px] text-gray-600 text-center mt-2">
                Issues after receiving your item?
              </p>
            </SidebarCard>
          )}

        </div>
      </div>

      {/* Item Details Modal */}
      <ItemDetailsModal
        isOpen={showItemDetailsModal}
        onClose={() => setShowItemDetailsModal(false)}
        order={order}
      />
    </div>
  )
}
