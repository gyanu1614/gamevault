'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Package, DollarSign, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrderMessageCardProps {
  order: {
    id: string
    order_number?: string
    listing: {
      title: string
      images?: string[]
      game_id?: string
    }
    total_amount: number
    status: string
    created_at: string
  }
  onViewOrder?: () => void
  disputeResolution?: {
    favored_party: 'buyer' | 'seller' | 'neutral'
  } | null
}

const getStatusColor = (status: string) => {
  const colors = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    processing: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    delivered: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    completed: 'bg-green-500/10 text-green-400 border-green-500/30',
    disputed: 'bg-red-500/10 text-red-400 border-red-500/30',
    resolved: 'bg-green-500/10 text-green-400 border-green-500/30',
    refunded: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  }
  return colors[status as keyof typeof colors] || colors.pending
}

export default function OrderMessageCard({ order, onViewOrder, disputeResolution }: OrderMessageCardProps) {
  const imageUrl = order.listing?.images?.[0] || '/placeholder-game.png'

  // Show "Resolved" instead of "Disputed" if dispute is resolved
  const displayStatus = (order.status === 'disputed' && disputeResolution) ? 'resolved' : order.status
  const displayLabel = displayStatus === 'resolved' ? 'Resolved' : displayStatus

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto my-4 max-w-md"
    >
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent p-4 backdrop-blur-sm">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Package className="h-3.5 w-3.5" />
            <span>Order {order.order_number || order.id.slice(0, 8)}</span>
          </div>
          <div className={cn('rounded-full border px-2 py-0.5 text-xs font-medium capitalize', getStatusColor(displayStatus))}>
            {displayLabel}
          </div>
        </div>

        {/* Order Content */}
        <div className="flex gap-3">
          {/* Image */}
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-white/10">
            <Image
              src={imageUrl}
              alt={order.listing?.title || 'Order item'}
              fill
              className="object-cover"
            />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h4 className="mb-1 text-sm font-semibold text-white line-clamp-2">
              {order.listing?.title || 'Unknown Listing'}
            </h4>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span className="font-semibold text-white">${order.total_amount}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* View Order Button */}
        {onViewOrder && (
          <button
            onClick={onViewOrder}
            className="mt-3 w-full rounded-lg border border-violet-500/30 bg-violet-500/10 py-2 text-xs font-semibold text-violet-400 transition-all hover:border-violet-500/50 hover:bg-violet-500/20"
          >
            View Full Order Details
          </button>
        )}
      </div>
    </motion.div>
  )
}
