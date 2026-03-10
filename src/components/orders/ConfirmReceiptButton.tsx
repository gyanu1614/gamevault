/**
 * Confirm Receipt Button Component
 *
 * Allows buyer to confirm order receipt (early release)
 * Shows review modal immediately after confirmation
 */

'use client'

import React, { useState } from 'react'
import { CheckCircle2, Loader2, MessageSquare } from 'lucide-react'
import { confirmOrderReceipt } from '@/lib/actions/orders'
import { messagesApi } from '@/lib/api/seller-compatible'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import ReviewForm from '@/components/reviews/ReviewForm'

interface ConfirmReceiptButtonProps {
  orderId: string
  conversationId?: string
  orderNumber?: string
  sellerName?: string
}

export default function ConfirmReceiptButton({
  orderId,
  conversationId,
  orderNumber,
  sellerName
}: ConfirmReceiptButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [sendNotification, setSendNotification] = useState(true)
  const [feedback, setFeedback] = useState('')
  const router = useRouter()

  const handleConfirm = async () => {
    setIsLoading(true)

    try {
      // Confirm order receipt
      const result = await confirmOrderReceipt(orderId)

      if (result.success) {
        // Send smart action message if enabled and conversationId is available
        if (sendNotification && conversationId) {
          try {
            const customMessage = feedback.trim()
              ? `Order received! Thank you for the smooth transaction. ${feedback}\n\nI've confirmed receipt and payment has been released.`
              : undefined // Use default template if no feedback

            await messagesApi.sendSmartActionMessage(conversationId, 'received', customMessage)
          } catch (messageError) {
            console.error('Error sending notification message:', messageError)
            // Don't fail the whole operation if message fails
          }
        }

        toast.success('Order confirmed! Payment has been released to the seller.')
        setShowModal(false)

        // Show review modal after brief delay
        setTimeout(() => {
          setShowReviewModal(true)
        }, 500)

        router.refresh()
      } else {
        toast.error(result.error || 'Failed to confirm order')
      }
    } catch (error) {
      console.error('Error confirming order:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReviewSuccess = () => {
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full py-2 border border-green-500/25 bg-green-500/[0.07] hover:bg-green-500/[0.13] hover:border-green-500/40 text-green-400 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="w-4 h-4" />
        Confirm Receipt
      </button>

      {/* Confirmation Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => !isLoading && setShowModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#0a0a0f] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-white mb-2">
              Confirm Order Receipt
            </h3>
            <p className="text-sm text-white/60 mb-6">
              This will release payment to the seller
            </p>

            {/* Escrow Release Info Card */}
            <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-4 mb-6">
              <div className="flex items-center gap-2 text-violet-400 mb-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium text-sm">Escrow Release</span>
              </div>
              <p className="text-xs text-white/60 mb-1">
                Payment will be transferred to seller's account
              </p>
              <ul className="text-xs text-white/50 space-y-1 mt-3">
                <li>• You have received the order</li>
                <li>• Everything is as described</li>
                <li>• You are satisfied with the purchase</li>
              </ul>
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-400 mb-4">
              ⚠️ This action cannot be undone. Make sure you've verified everything before confirming.
            </div>

            <div className="mb-4 space-y-2">
              <label className="text-sm font-medium text-white/80">
                Feedback for Seller (Optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your experience with the seller..."
                className="w-full px-4 py-3 bg-white/5 border-white/10 focus:border-violet-500 rounded-xl resize-none text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 border"
                rows={3}
                maxLength={200}
                disabled={isLoading}
              />
              <div className="text-xs text-white/40 text-right">
                {feedback.length}/200
              </div>
            </div>

            {conversationId && (
              <div className="mb-4">
                <label className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg cursor-pointer hover:bg-green-500/15 transition-colors">
                  <input
                    type="checkbox"
                    checked={sendNotification}
                    onChange={(e) => setSendNotification(e.target.checked)}
                    disabled={isLoading}
                    className="mt-0.5 h-4 w-4 rounded border-green-500/50 bg-white/[0.05] text-green-500 focus:ring-2 focus:ring-green-500 focus:ring-offset-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-400 mb-1">
                      <MessageSquare className="w-4 h-4" />
                      Send thank you message to seller
                    </div>
                    <p className="text-xs text-gray-400">
                      Automatically notify the seller that you've confirmed receipt
                      {feedback && ' with your feedback'}
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-medium transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm Receipt
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      <ReviewForm
        orderId={orderId}
        orderNumber={orderNumber}
        sellerName={sellerName}
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSuccess={handleReviewSuccess}
      />
    </>
  )
}
