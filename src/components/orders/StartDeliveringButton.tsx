/**
 * Start Delivering Button Component
 *
 * Allows seller to mark order as "delivering/processing"
 */

'use client'

import React, { useState } from 'react'
import { Truck, Loader2, MessageSquare } from 'lucide-react'
import { startDelivering } from '@/lib/actions/orders'
import { messagesApi } from '@/lib/api/seller-compatible'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface StartDeliveringButtonProps {
  orderId: string
  conversationId?: string
}

export default function StartDeliveringButton({
  orderId,
  conversationId
}: StartDeliveringButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [sendNotification, setSendNotification] = useState(true)
  const router = useRouter()

  const handleStartDelivering = async () => {
    setIsLoading(true)

    try {
      // Start delivering
      const result = await startDelivering(orderId)

      if (result.success) {
        // Send notification message if enabled and conversationId is available
        if (sendNotification && conversationId) {
          try {
            await messagesApi.sendMessage(
              conversationId,
              "I'm now processing your order! I'll mark it as delivered once it's ready for you."
            )
          } catch (messageError) {
            console.error('Error sending notification message:', messageError)
            // Don't fail the whole operation if message fails
            toast.warning('Order status updated but notification message failed to send')
          }
        }

        toast.success('Order marked as delivering!')
        setShowModal(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to start delivery')
      }
    } catch (error) {
      console.error('Error starting delivery:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
      >
        <Truck className="w-5 h-5" />
        Start Delivering
      </button>

      {/* Confirmation Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md bg-black border border-white/[0.1] rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4">
              Start Delivering Order
            </h3>

            <p className="text-text-secondary text-sm mb-4">
              This will mark the order as "Delivering/Processing". You can then upload delivery evidence and mark it as delivered when ready.
            </p>

            {conversationId && (
              <div className="mb-4">
                <label className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg cursor-pointer hover:bg-blue-500/15 transition-colors">
                  <input
                    type="checkbox"
                    checked={sendNotification}
                    onChange={(e) => setSendNotification(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-blue-500/50 bg-bg-overlay text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-400 mb-1">
                      <MessageSquare className="w-4 h-4" />
                      Send notification to buyer
                    </div>
                    <p className="text-xs text-text-secondary">
                      Automatically send a message informing the buyer that you're processing their order
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 bg-bg-overlay hover:bg-bg-raised-hover text-white font-medium rounded-lg transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleStartDelivering}
                disabled={isLoading}
                className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Start Delivering'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
