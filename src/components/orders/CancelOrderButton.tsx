'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelOrder } from '@/lib/actions/orders'
import { toast } from 'sonner'
import { X, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

interface CancelOrderButtonProps {
  orderId: string
  orderNumber?: string
  role?: 'buyer' | 'seller'
}

export default function CancelOrderButton({ orderId, orderNumber, role = 'seller' }: CancelOrderButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleCancel = async () => {
    setIsLoading(true)
    try {
      const result = await cancelOrder(orderId)
      if (result.success) {
        toast.success(role === 'seller' ? 'Order cancelled — buyer will be refunded' : 'Order cancelled — full refund issued to your payment method')
        setShowConfirm(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to cancel order')
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3 space-y-2.5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-error flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[11px] font-semibold text-error">Cancel order {orderNumber ? `#${orderNumber}` : ''}?</div>
            <div className="text-[10px] text-error/70 mt-0.5 leading-relaxed">
              {role === 'seller'
                ? 'The buyer will receive a full refund within 5–10 business days.'
                : 'A full refund will be returned to your original payment method within 5–10 business days.'}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfirm(false)}
            disabled={isLoading}
            className="flex-1 py-1.5 text-[11px] font-medium text-text-secondary bg-bg-overlay hover:bg-bg-raised-hover rounded-lg transition-colors disabled:opacity-50"
          >
            Keep Order
          </button>
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="flex-1 py-1.5 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <><Loader2 className="h-3 w-3 animate-spin" />Cancelling…</>
            ) : (
              <><RefreshCw className="h-3 w-3" />Confirm Cancel</>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-error/80 border border-red-500/15 bg-transparent hover:bg-red-500/[0.06] hover:border-red-500/25 hover:text-error rounded-lg transition-all"
    >
      <X className="h-3.5 w-3.5" />
      Cancel Order
    </button>
  )
}
