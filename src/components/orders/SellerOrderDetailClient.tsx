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
  Upload,
  Loader2
} from 'lucide-react'
import Image from 'next/image'
import SafeDropBadge from '@/components/safedrop/SafeDropBadge'
import MarkAsDeliveredButton from '@/components/orders/MarkAsDeliveredButton'
import DeliveryEvidenceUpload from '@/components/orders/DeliveryEvidenceUpload'
import OrderTimeline from '@/components/orders/OrderTimeline'
import OrderProgressBar from '@/components/orders/OrderProgressBar'

interface SellerOrderDetailClientProps {
  order: any
  sellerPayout: number
  timeRemaining: number
  hoursRemaining: number
  minutesRemaining: number
}

export default function SellerOrderDetailClient({
  order,
  sellerPayout,
  timeRemaining,
  hoursRemaining,
  minutesRemaining
}: SellerOrderDetailClientProps) {
  const { user } = useAuth()
  const { conversation, conversationId, isLoading: conversationLoading } = useOrderConversation({
    orderId: order.id,
    autoCreate: true
  })

  // Determine other user (buyer in this case)
  const otherUser = (conversation as any)?.buyer || {
    id: order.buyer.id,
    username: order.buyer.username,
    avatar_url: getAvatarUrl(order.buyer.avatar_url, order.buyer.username)
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
    <div className="space-y-6">
        {/* Progress Bar */}
        <OrderProgressBar status={order.status} />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <p className="text-xs text-text-secondary">Buyer</p>
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

        {/* COMPACT SIDEBAR - 1/3 */}
        <div className="lg:col-span-1 space-y-4">

        {/* Auto-release Timer */}
        {order.status === 'delivered' && order.auto_release_at && timeRemaining > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-blue-400">
                  Payout available in {hoursRemaining}h {minutesRemaining}m
                </div>
                <div className="text-xs text-text-secondary">
                  You're paid out automatically unless the buyer opens a dispute
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payout complete */}
        {order.escrow_status === 'released' && (
          <div className="bg-success-bg border border-success/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-success">
                  Paid Out
                </div>
                <div className="text-xs text-text-secondary">
                  ${sellerPayout.toFixed(2)} has been added to your Seller Balance
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Listing Info */}
        <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Listing Details</h2>
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

        {/* Delivery Evidence */}
        {order.delivery_evidence_required && (
          <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Delivery Evidence</h2>
            <div className="mb-3 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-400">
              <Shield className="w-3.5 h-3.5 inline mr-1.5" />
              Required for orders over $100
            </div>
            <DeliveryEvidenceUpload
              orderId={order.id}
              existingEvidence={order.delivery_evidence_urls || []}
              disabled={order.status === 'completed' || order.status === 'refunded'}
            />
          </div>
        )}

        {/* Delivery Action */}
        {order.status === 'paid' && (
          <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Mark as Delivered</h2>
            <p className="text-sm text-text-secondary mb-4">
              Once you've delivered the order, mark it as delivered to start the buyer's protection window — you're paid out when they confirm or the window closes.
            </p>
            <MarkAsDeliveredButton
              orderId={order.id}
              requiresEvidence={order.delivery_evidence_required}
              hasEvidence={(order.delivery_evidence_urls?.length || 0) > 0}
              conversationId={conversationId}
            />
          </div>
        )}

        {/* Delivery Notes */}
        {order.delivery_notes && (
          <div className="bg-bg-overlay border border-border-subtle rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Delivery Notes</h2>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{order.delivery_notes}</p>
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
              <span className="text-text-secondary">Platform Fee ({order.platform_fee_rate}%)</span>
              <span className="text-error">-${order.platform_fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Payment Processing ({order.payment_processing_fee_rate}%)</span>
              <span className="text-error">-${order.payment_processing_fee.toFixed(2)}</span>
            </div>
            <div className="pt-3 border-t border-border-subtle flex justify-between">
              <span className="font-semibold text-white">Your Payout</span>
              <span className="font-bold text-success text-lg">
                ${sellerPayout.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-success-bg border border-success/30 rounded-lg text-xs text-success">
            <DollarSign className="w-4 h-4 inline mr-2" />
            {order.escrow_status === 'released'
              ? 'Added to your Seller Balance'
              : 'Paid out after the buyer confirms delivery'}
          </div>
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
              Download Invoice
            </button>
            <button className="w-full py-2.5 bg-bg-overlay hover:bg-bg-raised-hover text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Report Issue
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}
