/**
 * Seller Response Form Component
 *
 * Allows sellers to respond to customer reviews
 * - 500 character limit
 * - Simple inline form
 * - Validation
 */

'use client'

import React, { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { addSellerResponse } from '@/lib/api/reviews'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SellerResponseFormProps {
  reviewId: string
  onSuccess?: () => void
  onCancel?: () => void
}

export default function SellerResponseForm({
  reviewId,
  onSuccess,
  onCancel
}: SellerResponseFormProps) {
  const [response, setResponse] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (response.trim().length < 10) {
      toast.error('Response must be at least 10 characters')
      return
    }

    if (response.trim().length > 500) {
      toast.error('Response must be less than 500 characters')
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await addSellerResponse(reviewId, response.trim())

      if (error || !data) {
        throw new Error(error?.message || 'Failed to submit response')
      }

      toast.success('Response posted successfully!')

      // Reset form
      setResponse('')

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Error submitting seller response:', error)
      toast.error(error.message || 'Failed to submit response')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Response Textarea */}
      <div className="space-y-2">
        <label htmlFor="seller-response" className="block text-sm font-medium text-violet-400">
          Your Response
        </label>
        <textarea
          id="seller-response"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={4}
          minLength={10}
          maxLength={500}
          placeholder="Thank the customer or address their concerns professionally..."
          className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all resize-none"
          disabled={isSubmitting}
          required
        />
        <div className="flex items-center justify-between text-xs">
          <span className={cn(
            response.length < 10 ? 'text-red-400' : 'text-gray-500'
          )}>
            {response.length < 10 ? `${10 - response.length} more characters required` : 'Minimum met'}
          </span>
          <span className={cn(
            response.length > 450 ? 'text-yellow-400' : 'text-gray-500'
          )}>
            {response.length}/500 characters
          </span>
        </div>
      </div>

      {/* Response Guidelines */}
      <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
        <p className="text-xs text-gray-400">
          <strong className="text-violet-400">Tip:</strong> Thank the customer, address concerns professionally, and offer solutions when appropriate.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm rounded-lg border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.05] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || response.trim().length < 10}
          className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Posting...
            </>
          ) : (
            'Post Response'
          )}
        </button>
      </div>
    </form>
  )
}
