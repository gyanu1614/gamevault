'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useOrderConversation } from '@/hooks/use-order-conversation'
import ChatInterface from '@/components/chat/ChatInterface'
import { getAvatarUrl } from '@/lib/utils/avatar'
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Shield,
  Package,
  DollarSign,
  FileText,
  Loader2,
  Star
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import ConfirmReceiptButton from '@/components/orders/ConfirmReceiptButton'
import OpenDisputeButton from '@/components/orders/OpenDisputeButton'
import OrderTimeline from '@/components/orders/OrderTimeline'
import DeliveryEvidenceViewer from '@/components/orders/DeliveryEvidenceViewer'
import OrderProgressBar from '@/components/orders/OrderProgressBar'
import LeaveReviewButton from '@/components/reviews/LeaveReviewButton'

interface BuyerOrderDetailClientProps {
  order: any
  timeRemaining: number
  hoursRemaining: number
  minutesRemaining: number
  protectionDays: number
}

export default function BuyerOrderDetailClient({
  order,
  timeRemaining,
  hoursRemaining,
  minutesRemaining,
  protectionDays
}: BuyerOrderDetailClientProps) {
  const { user } = useAuth()
  const { conversation, conversationId, isLoading: conversationLoading } = useOrderConversation({
    orderId: order.id,
    autoCreate: true
  })

  // Determine other user (seller in this case)
  const otherUser = (conversation as any)?.seller || {
    id: order.seller.id,
    username: order.seller.username,
    avatar_url: getAvatarUrl(order.seller.avatar_url, order.seller.username)
  }

  const orderForChat: any = {
    id: order.id,
    order_number: order.order_number,
    listing: order.listing ? {
      title: order.listing.title,
      images: order.listing.images,
      game_id: order.listing.game_id
    } : null,
    total_amount: order.total_amount,
    status: order.status,
    created_at: order.created_at
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* CHAT SECTION - 60% (3/5 columns) */}
      <div className="lg:col-span-3 space-y-6">
        {/* Chat Container */}
        <div className="bg-bg-overlay border border-border-subtle rounded-xl overflow-hidden">
          {/* Chat Header */}
          <div className="bg-bg-overlay border-b border-border-subtle p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Image
                    src={otherUser.avatar_url || getAvatarUrl(null, otherUser.username)}
                    alt={otherUser.username}
                    width={40}
                    height={40}
                    className="rounded-full ring-2 ring-white/10"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-gray-900" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {otherUser.username}
                  </h3>
                  <p className="text-xs text-text-secondary capitalize">
                    {order.seller.seller_tier} Seller
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Package className="h-3.5 w-3.5" />
                <span>Order #{order.order_number || order.id.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="h-[600px]">
            {conversationLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
                  <p className="text-sm text-text-secondary">Loading conversation...</p>
                </div>
              </div>
            ) : conversationId && user ? (
              <ChatInterface
                conversationId={conversationId}
                currentUserId={user.id}
                otherUser={otherUser}
                order={orderForChat}
                className="h-full"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <AlertCircle className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
                  <p className="text-sm text-text-secondary">Unable to load chat</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order Timeline */}
        <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Order Timeline</h2>
          <OrderTimeline order={order} />
        </div>
      </div>

      {/* DETAILS SIDEBAR - 40% (2/5 columns) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Order Progress Bar */}
        <OrderProgressBar status={order.status} />

        {/* Auto-release Timer */}
        {order.status === 'delivered' && order.auto_release_at && timeRemaining > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-blue-400">
                  Auto-release in {hoursRemaining}h {minutesRemaining}m
                </div>
                <div className="text-xs text-text-secondary">
                  Review and confirm receipt, or open dispute if there's an issue
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SafeDrop Protection */}
        {protectionDays > 0 && order.status !== 'completed' && (
          <div className="bg-lime/10 border border-lime-tint-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-lime-text flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-lime-text">
                  SafeDrop Protection Active
                </div>
                <div className="text-xs text-text-secondary">
                  Protected for {protectionDays} more days • Full refund guarantee
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Completed */}
        {order.status === 'completed' && (
          <div className="bg-success-bg border border-success/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-success">
                  Order Completed
                </div>
                <div className="text-xs text-text-secondary">
                  Thank you! Payment has been released to the seller.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Disputed */}
        {order.status === 'disputed' && (
          <div className="bg-error-bg border border-error/40 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-error">
                  Dispute Active
                </div>
                <div className="text-xs text-text-secondary">
                  Support team is reviewing. Update within 24-48 hours.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* What You Ordered */}
        <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">What You Ordered</h2>
          <div className="flex gap-3">
            {order.listing?.images && order.listing.images[0] ? (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                <Image
                  src={order.listing.images[0]}
                  alt={order.listing?.title || 'Order item'}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-lime/20 flex items-center justify-center text-2xl flex-shrink-0">
                🎮
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2">
                {order.listing?.title || 'Unknown Listing'}
              </h3>
              <div className="text-xs text-text-secondary">
                Qty: {order.quantity} × ${order.unit_price.toFixed(2)}
              </div>
              {order.listing && (
                <div className="text-xs text-text-secondary mt-1">
                  {order.listing.delivery_method} • {order.listing.delivery_time}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delivery Proof */}
        {(order.delivery_evidence_urls && order.delivery_evidence_urls.length > 0) && (
          <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Delivery Proof</h2>
            <DeliveryEvidenceViewer evidenceUrls={order.delivery_evidence_urls} />
          </div>
        )}

        {/* Delivery Notes */}
        {order.delivery_notes && (
          <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Delivery Notes</h2>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{order.delivery_notes}</p>
          </div>
        )}

        {/* Confirm Receipt */}
        {order.status === 'delivered' && order.escrow_status === 'held' && (
          <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Confirm Receipt</h2>
            <p className="text-sm text-text-secondary mb-4">
              Have you received your order and verified everything is correct?
            </p>
            <div className="flex flex-col gap-2">
              <ConfirmReceiptButton
                orderId={order.id}
                conversationId={conversationId}
                orderNumber={order.order_number || order.id.slice(0, 8).toUpperCase()}
                sellerName={order.seller.shop_name || order.seller.username}
              />
              <OpenDisputeButton orderId={order.id} conversationId={conversationId} />
            </div>
          </div>
        )}

        {/* Leave a Review */}
        {order.status === 'completed' && (
          <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-warning-bg rounded-lg">
                <Star className="w-5 h-5 text-warning" />
              </div>
              <h2 className="text-lg font-semibold text-white">How was your experience?</h2>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              Share your feedback to help other buyers and support quality sellers.
            </p>
            <LeaveReviewButton
              orderId={order.id}
              orderNumber={order.order_number || order.id.slice(0, 8).toUpperCase()}
              sellerName={order.seller.shop_name || order.seller.username}
            />
          </div>
        )}

        {/* Payment Summary */}
        <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Payment Summary</h2>

          <div className="space-y-2.5 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Subtotal</span>
              <span className="text-white">${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Platform Fee</span>
              <span className="text-white">${order.platform_fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Payment Processing</span>
              <span className="text-white">${order.payment_processing_fee.toFixed(2)}</span>
            </div>
            <div className="pt-3 border-t border-border-subtle flex justify-between">
              <span className="font-semibold text-white">Total Paid</span>
              <span className="font-bold text-white text-lg">
                ${order.total_amount.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-400">
            <Shield className="w-4 h-4 inline mr-2" />
            {order.escrow_status === 'held'
              ? 'Payment held securely in escrow'
              : order.escrow_status === 'released'
              ? 'Payment released to seller'
              : 'Payment being processed'}
          </div>
        </div>

        {/* SafeDrop Protection Details */}
        <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Your Protection</h2>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-white">Secure Escrow</div>
                <div className="text-text-secondary">Funds held until delivery confirmed</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-white">48-Hour Window</div>
                <div className="text-text-secondary">Time to verify your order</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-white">Full Refund Guarantee</div>
                <div className="text-text-secondary">If order not as described</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-white">24/7 Support</div>
                <div className="text-text-secondary">Help when you need it</div>
              </div>
            </div>
          </div>

          <Link
            href="/safedrop"
            className="mt-3 block text-center text-xs text-lime-text hover:text-lime-text transition-colors"
          >
            Learn more about SafeDrop →
          </Link>
        </div>

        {/* Order Info */}
        <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Order Information</h2>

          <div className="space-y-3 text-sm">
            <div>
              <div className="text-text-secondary mb-1 text-xs">Order ID</div>
              <div className="text-white font-mono text-xs">
                {order.order_number || order.id.slice(0, 8).toUpperCase()}
              </div>
            </div>

            <div>
              <div className="text-text-secondary mb-1 text-xs">Created</div>
              <div className="text-white text-xs">
                {new Date(order.created_at).toLocaleString()}
              </div>
            </div>

            {order.delivered_at && (
              <div>
                <div className="text-text-secondary mb-1 text-xs">Delivered</div>
                <div className="text-white text-xs">
                  {new Date(order.delivered_at).toLocaleString()}
                </div>
              </div>
            )}

            {order.completed_at && (
              <div>
                <div className="text-text-secondary mb-1 text-xs">Completed</div>
                <div className="text-white text-xs">
                  {new Date(order.completed_at).toLocaleString()}
                </div>
              </div>
            )}

            {order.protection_until && (
              <div>
                <div className="text-text-secondary mb-1 text-xs">Protection Until</div>
                <div className="text-white text-xs">
                  {new Date(order.protection_until).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Actions</h2>

          <div className="space-y-2">
            <button className="w-full py-2.5 bg-bg-overlay hover:bg-bg-raised-hover text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" />
              Download Receipt
            </button>
            {order.status === 'completed' && (
              <button className="w-full py-2.5 bg-bg-overlay hover:bg-bg-raised-hover text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                <Star className="w-4 h-4" />
                Leave Review
              </button>
            )}
            <button className="w-full py-2.5 bg-bg-overlay hover:bg-bg-raised-hover text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Need Help?
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
