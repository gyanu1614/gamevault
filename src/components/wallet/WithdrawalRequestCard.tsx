'use client'

import React, { useState } from 'react'
import { Clock, CheckCircle2, XCircle, Loader2, DollarSign, Calendar, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { cancelWithdrawalRequest, type WithdrawalRequest } from '@/lib/actions/withdrawals'
import { format } from 'date-fns'

interface WithdrawalRequestCardProps {
  request: WithdrawalRequest
  onUpdate?: () => void
}

export default function WithdrawalRequestCard({ request, onUpdate }: WithdrawalRequestCardProps) {
  const [isCancelling, setIsCancelling] = useState(false)

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this withdrawal request?')) {
      return
    }

    setIsCancelling(true)

    try {
      const result = await cancelWithdrawalRequest(request.id)

      if (result.success) {
        toast.success('Withdrawal request cancelled')
        if (onUpdate) onUpdate()
      } else {
        throw new Error(result.error || 'Failed to cancel request')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel request')
    } finally {
      setIsCancelling(false)
    }
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="w-4 h-4" />,
          label: 'Pending',
          color: 'text-amber-400',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20'
        }
      case 'approved':
        return {
          icon: <CheckCircle2 className="w-4 h-4" />,
          label: 'Approved',
          color: 'text-blue-400',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20'
        }
      case 'processing':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          label: 'Processing',
          color: 'text-lime-text',
          bg: 'bg-lime/10',
          border: 'border-lime-tint-border'
        }
      case 'completed':
        return {
          icon: <CheckCircle2 className="w-4 h-4" />,
          label: 'Completed',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20'
        }
      case 'rejected':
        return {
          icon: <XCircle className="w-4 h-4" />,
          label: 'Rejected',
          color: 'text-error',
          bg: 'bg-error-bg',
          border: 'border-error/40'
        }
      case 'cancelled':
        return {
          icon: <X className="w-4 h-4" />,
          label: 'Cancelled',
          color: 'text-text-secondary',
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/20'
        }
      case 'failed':
        return {
          icon: <XCircle className="w-4 h-4" />,
          label: 'Failed',
          color: 'text-error',
          bg: 'bg-error-bg',
          border: 'border-error/40'
        }
      default:
        return {
          icon: <Clock className="w-4 h-4" />,
          label: status,
          color: 'text-text-secondary',
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/20'
        }
    }
  }

  const statusConfig = getStatusConfig(request.status)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-bg-overlay border border-border-subtle hover:border-white/[0.12] transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-lime/10 border border-lime-tint-border">
            <DollarSign className="w-4 h-4 text-lime-text" />
          </div>
          <div>
            <p className="font-semibold text-white">{request.method_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Calendar className="w-3 h-3 text-text-tertiary" />
              <span className="text-xs text-text-tertiary">
                {format(new Date(request.created_at), 'MMM d, yyyy • h:mm a')}
              </span>
            </div>
          </div>
        </div>

        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
          statusConfig.color,
          statusConfig.bg,
          statusConfig.border
        )}>
          {statusConfig.icon}
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {/* Amount details */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="p-2 rounded-lg bg-bg-overlay">
          <p className="text-xs text-text-tertiary mb-0.5">Amount</p>
          <p className="text-sm font-semibold text-white font-mono">${request.amount.toFixed(2)}</p>
        </div>
        <div className="p-2 rounded-lg bg-bg-overlay">
          <p className="text-xs text-text-tertiary mb-0.5">Fee</p>
          <p className="text-sm font-semibold text-amber-400 font-mono">-${request.fee_amount.toFixed(2)}</p>
        </div>
        <div className="p-2 rounded-lg bg-bg-overlay">
          <p className="text-xs text-text-tertiary mb-0.5">You receive</p>
          <p className="text-sm font-semibold text-emerald-400 font-mono">${request.net_amount.toFixed(2)}</p>
        </div>
      </div>

      {/* Admin notes */}
      {request.admin_notes && (
        <div className="p-3 rounded-lg bg-bg-overlay border border-border-subtle mb-3">
          <p className="text-xs text-text-tertiary mb-1">Admin note:</p>
          <p className="text-sm text-text-secondary">{request.admin_notes}</p>
        </div>
      )}

      {/* Cancel button */}
      {request.status === 'pending' && (
        <button
          onClick={handleCancel}
          disabled={isCancelling}
          className={cn(
            "w-full py-2 rounded-lg text-sm font-medium transition-all",
            "bg-error-bg hover:bg-error-bg text-error border border-error/40",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center justify-center gap-2"
          )}
        >
          {isCancelling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Cancelling...
            </>
          ) : (
            <>
              <X className="w-4 h-4" />
              Cancel Request
            </>
          )}
        </button>
      )}
    </motion.div>
  )
}
