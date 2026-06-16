/**
 * Order Timeline Component
 *
 * Shows chronological order status timeline
 */

'use client'

import React from 'react'
import { CheckCircle2, Clock, Package, AlertCircle, DollarSign, Shield } from 'lucide-react'

interface OrderTimelineProps {
  order: any
}

export default function OrderTimeline({ order }: OrderTimelineProps) {
  const events = []

  // Order Created
  if (order.created_at) {
    events.push({
      icon: <DollarSign className="w-5 h-5" />,
      title: 'Order Placed',
      description: 'Payment secured in escrow',
      timestamp: order.created_at,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30'
    })
  }

  // Order Delivered
  if (order.delivered_at) {
    events.push({
      icon: <Package className="w-5 h-5" />,
      title: 'Order Delivered',
      description: order.delivery_notes || 'Seller marked order as delivered',
      timestamp: order.delivered_at,
      color: 'text-lime-text',
      bgColor: 'bg-lime/10',
      borderColor: 'border-lime-tint-border'
    })
  }

  // Buyer Confirmed
  if (order.buyer_confirmed_at) {
    events.push({
      icon: <CheckCircle2 className="w-5 h-5" />,
      title: 'Receipt Confirmed',
      description: 'Buyer confirmed receipt of order',
      timestamp: order.buyer_confirmed_at,
      color: 'text-success',
      bgColor: 'bg-success-bg',
      borderColor: 'border-success/30'
    })
  }

  // Order Completed
  if (order.completed_at) {
    events.push({
      icon: <Shield className="w-5 h-5" />,
      title: 'Order Completed',
      description: `Payment released to seller${order.release_method ? ` (${order.release_method})` : ''}`,
      timestamp: order.completed_at,
      color: 'text-success',
      bgColor: 'bg-success-bg',
      borderColor: 'border-success/30'
    })
  }

  // Disputed
  if (order.disputed_at) {
    events.push({
      icon: <AlertCircle className="w-5 h-5" />,
      title: 'Dispute Opened',
      description: order.dispute_reason || 'Order disputed',
      timestamp: order.disputed_at,
      color: 'text-error',
      bgColor: 'bg-error-bg',
      borderColor: 'border-error/40'
    })
  }

  // Sort by timestamp (newest first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={index} className="relative">
          {/* Timeline connector */}
          {index < events.length - 1 && (
            <div className="absolute left-[1.875rem] top-12 bottom-0 w-px bg-white/[0.1]" />
          )}

          {/* Event */}
          <div className="flex gap-4">
            {/* Icon */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-full border ${event.borderColor} ${event.bgColor} flex items-center justify-center ${event.color}`}>
              {event.icon}
            </div>

            {/* Content */}
            <div className="flex-1 pb-8">
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-base font-semibold text-white">{event.title}</h3>
                <span className="text-xs text-text-secondary whitespace-nowrap ml-4">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
              <p className="text-sm text-text-secondary">{event.description}</p>
            </div>
          </div>
        </div>
      ))}

      {/* No events */}
      {events.length === 0 && (
        <div className="text-center py-8 text-text-secondary">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No timeline events yet</p>
        </div>
      )}
    </div>
  )
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
