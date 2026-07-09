'use client'

import React, { useState } from 'react'
import { AlertCircle, Loader2, ShieldAlert, X } from 'lucide-react'
import { openDispute } from '@/lib/actions/orders'
import { messagesApi } from '@/lib/api/seller-compatible'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface OpenDisputeButtonProps {
  orderId: string
  conversationId?: string
}

const DISPUTE_CATEGORIES = [
  { value: 'Item not as described',      label: 'Item not as described' },
  { value: 'Did not receive order',      label: 'Did not receive order' },
  { value: 'Wrong item received',        label: 'Wrong item received' },
  { value: 'Account credentials invalid', label: 'Account credentials invalid' },
  { value: 'Other',                      label: 'Other' },
]

export default function OpenDisputeButton({ orderId, conversationId }: OpenDisputeButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const router = useRouter()

  const handleClose = () => {
    if (isLoading) return
    setShowModal(false)
    setDisputeReason('')
    setSelectedCategory('')
  }

  const handleOpenDispute = async () => {
    if (!selectedCategory) {
      toast.error('Please select an issue type')
      return
    }
    if (!disputeReason.trim()) {
      toast.error('Please describe what went wrong')
      return
    }

    setIsLoading(true)
    try {
      const result = await openDispute(orderId, selectedCategory, disputeReason)

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
        setShowModal(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to open dispute')
      }
    } catch (error) {
      console.error('Error opening dispute:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = !!selectedCategory && disputeReason.trim().length > 0

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full py-2 border border-error/40 bg-red-500/[0.05] hover:bg-red-500/[0.10] hover:border-red-500/35 text-error/80 hover:text-error text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
      >
        <AlertCircle className="w-4 h-4" />
        Open Dispute
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-sm bg-[#0f0f0f] border border-border-subtle rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl border border-red-500/25 bg-red-500/[0.08] flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="h-4 w-4 text-error" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Open a Dispute</h3>
                  <p className="text-[11px] text-text-disabled mt-0.5">Support responds within 24h</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="h-6 w-6 rounded-lg border border-border-subtle bg-bg-overlay hover:bg-white/[0.07] flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="h-3.5 w-3.5 text-text-tertiary" />
              </button>
            </div>

            {/* Category pills */}
            <div className="mb-4">
              <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 block">
                What went wrong?
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DISPUTE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                      selectedCategory === cat.value
                        ? 'border-red-500/40 bg-red-500/[0.12] text-error'
                        : 'border-border-subtle bg-bg-overlay text-text-tertiary hover:border-white/[0.12] hover:text-text-secondary'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mb-5">
              <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 block">
                Details
              </span>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Briefly describe what happened..."
                className="w-full px-3 py-2.5 bg-bg-overlay border border-border-subtle rounded-xl text-sm text-white placeholder:text-text-disabled focus:outline-none focus:border-error/40 resize-none transition-colors"
                rows={3}
                disabled={isLoading}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2.5">
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 py-2 rounded-xl bg-bg-raised hover:bg-white/[0.07] text-sm text-text-secondary font-medium transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleOpenDispute}
                disabled={isLoading || !canSubmit}
                className="flex-1 py-2 rounded-xl border border-red-500/25 bg-red-500/[0.08] hover:bg-red-500/[0.15] text-sm text-error font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
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
        </div>
      )}
    </>
  )
}
