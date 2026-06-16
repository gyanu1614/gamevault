'use client'

import { useAuth } from '@/hooks/use-auth'
import { useOrderConversation } from '@/hooks/use-order-conversation'
import ChatInterface from '@/components/chat/ChatInterface'
import { getAvatarUrl } from '@/lib/utils/avatar'
import {
  CheckCircle2, Loader2, Package,
  TrendingUp, MessageSquare, DollarSign, Clock, Zap, ShieldCheck,
  Star, ThumbsUp, ThumbsDown, Eye,
} from 'lucide-react'
import Image from 'next/image'
import { AvatarImage } from '@/components/ui/AvatarImage'
import MarkAsDeliveredButton from '@/components/orders/MarkAsDeliveredButton'
import CancelOrderButton from '@/components/orders/CancelOrderButton'
import OrderProgressBar from '@/components/orders/OrderProgressBar'
import DeliveryTimer from '@/components/orders/DeliveryTimer'
import OrderDetailsCard from '@/components/orders/OrderDetailsCard'
import InstantDeliveryCodeDisplay from '@/components/orders/InstantDeliveryCodeDisplay'
import DisputeResolutionCard from '@/components/admin/disputes/DisputeResolutionCard'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { markOrderAsDelivered } from '@/lib/actions/orders'
import { toast } from 'sonner'
import { X, ImagePlus } from 'lucide-react'
import { getOrderReview } from '@/lib/api/reviews'
import { messagesApi } from '@/lib/api/seller-compatible'
import type { ReviewWithRelations } from '@/types/database'

interface SellerOrderDetailClientProps {
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
  sellerPayout: number
  timeRemaining: number
  hoursRemaining: number
  minutesRemaining: number
}

// ── Primitives ─────────────────────────────────────────────────────────────────

function SidebarCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border-subtle bg-white/[0.025] p-5 transition-colors hover:border-white/[0.09]', className)}>
      {children}
    </div>
  )
}

function CardLabel({ icon: Icon, label, color = 'text-text-tertiary' }: { icon: React.ElementType; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={cn('h-3.5 w-3.5', color)} />
      <span className={cn('text-[10px] font-bold uppercase tracking-[0.12em]', color)}>{label}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SellerOrderDetailClient({
  order: initialOrder,
  disputeResolution: initialDisputeResolution,
  sellerPayout,
}: SellerOrderDetailClientProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [order, setOrder] = useState(initialOrder)
  const [disputeResolution, setDisputeResolution] = useState(initialDisputeResolution)
  const [showDeliveryForm, setShowDeliveryForm] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [buyerReview, setBuyerReview] = useState<ReviewWithRelations | null>(null)

  // Transition state for smooth animations
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showCompletedView, setShowCompletedView] = useState(false)
  const { conversation, conversationId, isLoading: conversationLoading } = useOrderConversation({
    orderId: order.id,
    autoCreate: true,
  })

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [])

  // Fetch buyer review if order is completed
  useEffect(() => {
    const fetchReview = async () => {
      if (order.status === 'completed') {
        try {
          const { data: review } = await getOrderReview(order.id)
          if (review) {
            setBuyerReview(review as any)
          }
          // Automatically show completed view after a short delay
          setTimeout(() => setShowCompletedView(true), 500)
        } catch (error) {
          console.error('Error fetching buyer review:', error)
        }
      }
    }
    fetchReview()
  }, [order.id, order.status])

  // Real-time order subscription
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`order-${order.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, (payload) => {
        setOrder((prev: any) => ({ ...prev, ...payload.new, listing: prev.listing, buyer: prev.buyer, seller: prev.seller }))
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

  // Real-time review subscription
  useEffect(() => {
    if (order.status !== 'completed') return

    const supabase = createClient()
    const ch = supabase
      .channel(`order-reviews-${order.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'reviews',
        filter: `order_id=eq.${order.id}`
      }, async () => {
        // Fetch full review with relations when new review is added
        const { data: review } = await getOrderReview(order.id)
        if (review) {
          setBuyerReview(review as any)
          // Auto-show the completed view with smooth transition
          if (!showCompletedView) {
            setIsTransitioning(true)
            setTimeout(() => {
              setShowCompletedView(true)
              setIsTransitioning(false)
            }, 150)
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'reviews',
        filter: `order_id=eq.${order.id}`
      }, async () => {
        // Refetch if review is updated
        const { data: review } = await getOrderReview(order.id)
        if (review) {
          setBuyerReview(review as any)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [order.id, order.status, showCompletedView])

  // Dispute resolution is now passed as prop from server, no need to refetch
  // Real-time updates handled by order subscription above

  const conv = conversation as any
  const otherUser = conv?.buyer || {
    id: order.buyer.id,
    username: order.buyer.username,
    avatar_url: getAvatarUrl(order.buyer.avatar_url, order.buyer.username),
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

  const feeAmount = (order.total_amount || 0) - (sellerPayout || 0)
  const isEscrowReleased = order.escrow_status === 'released'
  const isInstantDelivery = order.listing?.delivery_method === 'instant' || order.instant_delivery_code
  const needsDeliveryAction = (order.status === 'paid' || order.status === 'delivering') && !isInstantDelivery
  const orderNum = order.order_number || order.id.slice(0, 8).toUpperCase()

  // File handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    const invalid = files.filter(f => !validTypes.includes(f.type))
    if (invalid.length) {
      toast.error('Only images (PNG, JPG, WebP, GIF) are allowed')
      return
    }

    const oversized = files.filter(f => f.size > 10 * 1024 * 1024)
    if (oversized.length) {
      toast.error('Images must be under 10MB each')
      return
    }

    const newFiles = [...selectedFiles, ...files].slice(0, 4)
    setSelectedFiles(newFiles)

    const newPreviews: string[] = []
    let loaded = 0
    newFiles.forEach((file, i) => {
      if (i < previews.length) {
        newPreviews[i] = previews[i]
        loaded++
        if (loaded === newFiles.length) setPreviews(newPreviews)
      } else {
        const reader = new FileReader()
        reader.onload = (ev) => {
          newPreviews[i] = ev.target?.result as string
          loaded++
          if (loaded === newFiles.length) setPreviews([...newPreviews])
        }
        reader.readAsDataURL(file)
      }
    })
    if (newFiles.length === 0) setPreviews([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleMarkAsDelivered = async () => {
    if (order.delivery_evidence_required && (order.delivery_evidence_urls?.length || 0) === 0 && selectedFiles.length === 0) {
      toast.error('Please upload at least one delivery proof image')
      return
    }

    setIsLoading(true)

    try {
      const result = await markOrderAsDelivered(order.id)
      if (!result.success) {
        toast.error(result.error || 'Failed to mark order as delivered')
        return
      }

      // Upload images and send as chat message
      if (selectedFiles.length > 0 && conversationId) {
        setUploading(true)
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('Not authenticated')

          const uploadedUrls: string[] = []
          for (const file of selectedFiles) {
            const ext = file.name.split('.').pop()
            const path = `${order.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
            const { error: uploadError } = await supabase.storage
              .from('delivery-evidence')
              .upload(path, file, { upsert: false })

            if (uploadError) {
              console.error('Upload error:', uploadError)
              continue
            }

            const { data: signedData } = await supabase.storage
              .from('delivery-evidence')
              .createSignedUrl(path, 315360000)

            if (signedData?.signedUrl) {
              uploadedUrls.push(signedData.signedUrl)
            }
          }

          if (uploadedUrls.length > 0) {
            await (supabase.from('messages').insert as any)({
              conversation_id: conversationId,
              sender_id: user.id,
              content: `I've marked your order as delivered! Here's the delivery proof. Please confirm receipt within 48 hours.`,
              attachments: uploadedUrls,
              is_read: false,
            })

            await (supabase
              .from('conversations')
              .update as any)({ last_message_at: new Date().toISOString() })
              .eq('id', conversationId)
          }
        } catch (uploadErr) {
          console.error('Error uploading evidence:', uploadErr)
          toast.warning('Order delivered but proof upload failed')
        } finally {
          setUploading(false)
        }
      } else if (conversationId) {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await (supabase.from('messages').insert as any)({
              conversation_id: conversationId,
              sender_id: user.id,
              content: `I've marked your order as delivered! The 48-hour auto-release timer has started. Please confirm receipt when you receive the item.`,
              attachments: [],
              is_read: false,
            })
            await (supabase
              .from('conversations')
              .update as any)({ last_message_at: new Date().toISOString() })
              .eq('id', conversationId)
          }
        } catch (msgErr) {
          console.error('Error sending delivery message:', msgErr)
        }
      }

      toast.success('Order marked as delivered! Auto-release timer started.')
      setShowDeliveryForm(false)
      setSelectedFiles([])
      setPreviews([])
      router.refresh()
    } catch (error) {
      console.error('Error marking order as delivered:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4 pb-32">
      {/* Progress bar + Delivery Timer side by side */}
      {order.listing?.delivery_method === 'instant' ? (
        /* For instant delivery, show timer inline below progress bar */
        <div className="space-y-4">
          <div className="flex">
            <div className="flex-1">
              {/* Show completed view for completed orders, otherwise show progress bar */}
              {order.status === 'completed' ? (
                <div className="rounded-xl border border-border-subtle bg-bg-overlay p-4">
                  {/* Order Completed Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-11 w-11 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Order Completed</h3>
                      <p className="text-xs text-text-secondary">
                        {order.completed_at ? new Date(order.completed_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        }) : 'Recently'}
                      </p>
                      <p className="text-xs text-text-tertiary mt-1.5">
                        Payment has been released to you. Great work!
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border-subtle my-3.5" />

                  {/* Buyer Feedback Section */}
                  <div>
                    <h4 className="text-xs font-semibold text-white mb-3">Buyer feedback</h4>
                    {buyerReview ? (
                      <div className="rounded-lg bg-bg-raised border border-border-subtle p-3 flex items-start gap-3">
                        {buyerReview.rating >= 4 ? (
                          <ThumbsUp className="w-4 h-4 text-success fill-current flex-shrink-0 mt-0.5" />
                        ) : (
                          <ThumbsDown className="w-4 h-4 text-error fill-current flex-shrink-0 mt-0.5" />
                        )}
                        <p className="text-sm text-text-secondary leading-relaxed flex-1">
                          {buyerReview.comment || buyerReview.title || "No comment provided"}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-xs text-text-tertiary">
                            No feedback yet. Send a friendly reminder to get valuable feedback.
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!conversationId) return
                            try {
                              await messagesApi.sendMessage(
                                conversationId,
                                "Hey! Hope you enjoyed your purchase. Would love to hear your feedback! 😊"
                              )
                              toast.success('Review request sent!')
                            } catch (error) {
                              console.error('Error sending review request:', error)
                              toast.error('Failed to send message')
                            }
                          }}
                          disabled={!conversationId}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-white/10 bg-bg-overlay hover:bg-bg-raised-hover text-[11px] text-text-secondary font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Request
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <OrderProgressBar
                  status={order.status}
                  order={order}
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
                />
              )}
            </div>
          </div>
          <DeliveryTimer
            deliveringAt={order.delivering_at}
            deliveredAt={order.delivered_at}
            deliveryTime={order.listing?.delivery_time}
            deliveryMethod={order.listing?.delivery_method}
            role="seller"
            orderStatus={order.status}
          />
        </div>
      ) : (
        /* For other delivery methods, use grid layout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          <div className="lg:col-span-2 flex">
            <div className="flex-1">
              {/* Show completed view for completed orders, otherwise show progress bar */}
              {order.status === 'completed' ? (
                <div className="rounded-xl border border-border-subtle bg-bg-overlay p-4">
                  {/* Order Completed Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-11 w-11 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Order Completed</h3>
                      <p className="text-xs text-text-secondary">
                        {order.completed_at ? new Date(order.completed_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        }) : 'Recently'}
                      </p>
                      <p className="text-xs text-text-tertiary mt-1.5">
                        Payment has been released to you. Great work!
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border-subtle my-3.5" />

                  {/* Buyer Feedback Section */}
                  <div>
                    <h4 className="text-xs font-semibold text-white mb-3">Buyer feedback</h4>
                    {buyerReview ? (
                      <div className="rounded-lg bg-bg-raised border border-border-subtle p-3 flex items-start gap-3">
                        {buyerReview.rating >= 4 ? (
                          <ThumbsUp className="w-4 h-4 text-success fill-current flex-shrink-0 mt-0.5" />
                        ) : (
                          <ThumbsDown className="w-4 h-4 text-error fill-current flex-shrink-0 mt-0.5" />
                        )}
                        <p className="text-sm text-text-secondary leading-relaxed flex-1">
                          {buyerReview.comment || buyerReview.title || "No comment provided"}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-xs text-text-tertiary">
                            No feedback yet. Send a friendly reminder to get valuable feedback.
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!conversationId) return
                            try {
                              await messagesApi.sendMessage(
                                conversationId,
                                "Hey! Hope you enjoyed your purchase. Would love to hear your feedback! 😊"
                              )
                              toast.success('Review request sent!')
                            } catch (error) {
                              console.error('Error sending review request:', error)
                              toast.error('Failed to send message')
                            }
                          }}
                          disabled={!conversationId}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-white/10 bg-bg-overlay hover:bg-bg-raised-hover text-[11px] text-text-secondary font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Request
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <OrderProgressBar
                  status={order.status}
                  order={order}
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
                />
              )}
            </div>
          </div>
          {/* Delivery timer - always visible */}
          <div className="flex">
            <div className="flex-1">
              <DeliveryTimer
                deliveringAt={order.delivering_at}
                deliveredAt={order.delivered_at}
                deliveryTime={order.listing?.delivery_time}
                deliveryMethod={order.listing?.delivery_method}
                role="seller"
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
          <div className="rounded-2xl border border-border-subtle bg-bg-overlay overflow-hidden flex-1">

            {/* Chat header */}
            <div className="border-b border-border-subtle px-5 py-4 flex items-center gap-3">
              {/* Buyer avatar */}
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
                  @{otherUser.username}
                </div>
                <div className="text-[11px] text-text-tertiary mt-0.5">Buyer</div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 rounded-full border border-border-subtle bg-bg-overlay px-3 py-1.5">
                <MessageSquare className="h-3 w-3 text-text-disabled" />
                <span className="text-[11px] font-mono font-medium text-text-tertiary">#{orderNum}</span>
              </div>
            </div>

            {/* Chat body */}
            <div className="h-[620px]">
              {conversationLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-lime-text/60" />
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
                  evidenceProps={order.delivery_evidence_required ? {
                    orderId: order.id,
                    existingEvidence: order.delivery_evidence_urls || [],
                    disabled: !needsDeliveryAction,
                  } : undefined}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-lime-text/60" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SIDEBAR (1/3) ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 h-full">

          {/* Dispute Resolution Card - Shown for resolved disputes */}
          {disputeResolution && (
            <div className="mb-1">
              <DisputeResolutionCard
                status={disputeResolution.status}
                resolutionType={disputeResolution.resolution_type}
                resolvedAmount={disputeResolution.seller_payout_amount || disputeResolution.refund_amount}
                resolutionNotes={disputeResolution.resolution_notes}
                resolvedAt={disputeResolution.resolved_at}
                currency="USD"
                buyerUsername={disputeResolution.buyer_username}
                sellerUsername={disputeResolution.seller_username}
              />
            </div>
          )}

          {/* Instant Delivery Code Display (for seller) */}
          {isInstantDelivery && order.instant_delivery_code && (
            <SidebarCard className="border-lime-tint-border bg-lime/[0.04]">
              <CardLabel
                icon={Zap}
                label="Delivered Code"
                color="text-lime-text"
              />
              <p className="text-xs text-text-tertiary mb-4 leading-relaxed">
                This code was automatically delivered to the buyer. Keep this for your records.
              </p>
              <InstantDeliveryCodeDisplay
                code={order.instant_delivery_code}
                deliveryType={order.instant_delivery_inventory?.delivery_type}
                orderNumber={order.order_number}
              />
            </SidebarCard>
          )}

          {/* ① Mark as Delivered — top priority action */}
          {needsDeliveryAction && (
            <SidebarCard className="border-lime-tint-border bg-lime/[0.04] relative overflow-hidden">

              {/* Blur overlay during transition */}
              {isTransitioning && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-lg z-10 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-lime-text animate-spin" />
                </div>
              )}

              <div className={cn(
                "transition-all duration-300 ease-out",
                showDeliveryForm
                  ? "opacity-0 -translate-x-6 pointer-events-none absolute inset-0"
                  : "opacity-100 translate-x-0",
                isTransitioning && "blur-lg"
              )}>
                <CardLabel
                  icon={order.status === 'paid' ? Package : TrendingUp}
                  label={order.status === 'paid' ? 'Action Required' : 'Delivering'}
                  color="text-lime-text"
                />
                <p className="text-xs text-text-tertiary mb-4 leading-relaxed">
                  {order.status === 'paid'
                    ? 'Timer is running. Send the item and mark as delivered.'
                    : "Once you've sent the item, mark it as delivered."
                  }
                </p>
                <button
                  onClick={() => {
                    setIsTransitioning(true)
                    setTimeout(() => {
                      setShowDeliveryForm(true)
                      setIsTransitioning(false)
                    }, 150)
                  }}
                  disabled={isTransitioning}
                  className="w-full py-2.5 border border-white/[0.15] bg-white/[0.07] hover:bg-white/[0.11] hover:border-white/[0.22] text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <Package className="w-4 h-4 text-lime-text" />
                  Mark as Delivered
                </button>
                <div className="mt-3">
                  <CancelOrderButton orderId={order.id} orderNumber={orderNum} role="seller" />
                </div>
              </div>

              {/* Delivery Form - Flipped State */}
              <div className={cn(
                "transition-all duration-300 ease-out",
                showDeliveryForm
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-6 pointer-events-none absolute inset-0",
                isTransitioning && "blur-sm"
              )}>
                <h3 className="text-lg font-bold text-white mb-1">Mark Order as Delivered</h3>
                <p className="text-xs text-text-tertiary mb-5 leading-relaxed">
                  This starts the 48-hour auto-release timer. The buyer has 48h to confirm receipt or open a dispute.
                </p>

                {/* Evidence required warning */}
                {order.delivery_evidence_required && (order.delivery_evidence_urls?.length || 0) === 0 && selectedFiles.length === 0 && (
                  <div className="mb-4 p-3 rounded-xl bg-error-bg border border-red-500/25 text-xs text-error">
                    ⚠ You must upload at least one delivery proof image before marking as delivered.
                  </div>
                )}

                {/* Proof upload section */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.08em]">
                      Delivery Proof
                    </span>
                    <span className="text-[10px] text-text-disabled">
                      {selectedFiles.length}/4 images · optional
                    </span>
                  </div>

                  {/* Preview grid */}
                  {previews.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {previews.map((src, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border-subtle bg-bg-overlay group">
                          <Image src={src} alt={`proof ${i + 1}`} fill className="object-cover" />
                          <button
                            onClick={() => removeFile(i)}
                            className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload button */}
                  {selectedFiles.length < 4 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 rounded-xl border border-dashed border-white/[0.12] bg-bg-overlay hover:bg-bg-overlay hover:border-lime-tint-border transition-all flex flex-col items-center gap-1.5 text-text-disabled hover:text-text-secondary"
                    >
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-xs">Click to add proof images</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsTransitioning(true)
                      setTimeout(() => {
                        setShowDeliveryForm(false)
                        setSelectedFiles([])
                        setPreviews([])
                        setIsTransitioning(false)
                      }, 150)
                    }}
                    disabled={isLoading || isTransitioning}
                    className="flex-1 py-2.5 rounded-xl bg-bg-raised hover:bg-white/[0.07] text-sm text-text-secondary font-medium transition-colors disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMarkAsDelivered}
                    disabled={isLoading || uploading || (order.delivery_evidence_required && (order.delivery_evidence_urls?.length || 0) === 0 && selectedFiles.length === 0)}
                    className="flex-1 py-2.5 rounded-xl border border-white/[0.15] bg-white/[0.07] hover:bg-white/[0.11] text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isLoading || uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {uploading ? 'Uploading...' : 'Confirming...'}
                      </>
                    ) : (
                      'Confirm Delivery'
                    )}
                  </button>
                </div>
              </div>
            </SidebarCard>
          )}

          {/* ④ Order Details */}
          <OrderDetailsCard order={order} role="seller" />

          {/* ⑥ Payment — at the bottom, grows to fill remaining space */}
          <SidebarCard className={`flex-1 flex flex-col ${isEscrowReleased ? 'border-green-500/20 bg-green-500/[0.04]' : ''}`}>
            <CardLabel
              icon={isEscrowReleased ? CheckCircle2 : DollarSign}
              label={isEscrowReleased ? 'Payment Released' : 'Your Payout'}
              color="text-success"
            />

            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-tertiary">Order Price</span>
                <span className="text-xs text-gray-200 font-mono">${(order.total_amount || 0).toFixed(2)}</span>
              </div>
              {feeAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-tertiary">Commission</span>
                  <span className="text-xs text-error/70 font-mono">-${feeAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2.5 border-t border-border-subtle flex justify-between items-center">
                <span className="text-xs font-semibold text-white">You receive</span>
                <span className="text-lg font-bold text-success font-mono">${sellerPayout.toFixed(2)}</span>
              </div>
            </div>

            {/* Seller guidance — fills remaining space */}
            <div className="mt-4 pt-4 border-t border-border-subtle space-y-3 flex-1">
              <div className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-success-bg border border-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ShieldCheck className="h-2.5 w-2.5 text-success" />
                </div>
                <p className="text-[11px] text-text-disabled leading-relaxed">Funds will be added to your GameVault balance once the buyer confirms receipt.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-success-bg border border-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="h-2.5 w-2.5 text-success" />
                </div>
                <p className="text-[11px] text-text-disabled leading-relaxed">If the buyer does not confirm within 48 hours of delivery, payment is released to you automatically.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-success-bg border border-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="h-2.5 w-2.5 text-success" />
                </div>
                <p className="text-[11px] text-text-disabled leading-relaxed">Deliver promptly and mark as delivered as soon as the item is sent to start the release timer.</p>
              </div>
            </div>
          </SidebarCard>

        </div>
      </div>
    </div>
  )
}
