'use client'

import { CHAIN_LABELS } from '@/lib/crypto/address-validation'
import React, { useState } from 'react'
import { Clock, CheckCircle2, XCircle, Loader2, X } from 'lucide-react'
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
          icon: <Clock className="h-3 w-3" />,
          label: 'Pending',
          color: 'text-amber-400',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20'
        }
      case 'approved':
        return {
          icon: <CheckCircle2 className="h-3 w-3" />,
          label: 'Approved',
          color: 'text-blue-400',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20'
        }
      case 'processing':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          label: 'Processing',
          color: 'text-lime-text',
          bg: 'bg-lime-tint-bg',
          border: 'border-lime-tint-border'
        }
      case 'completed':
        return {
          icon: <CheckCircle2 className="h-3 w-3" />,
          label: 'Completed',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20'
        }
      case 'rejected':
        return {
          icon: <XCircle className="h-3 w-3" />,
          label: 'Rejected',
          color: 'text-error',
          bg: 'bg-error-bg',
          border: 'border-error/40'
        }
      case 'cancelled':
        return {
          icon: <X className="h-3 w-3" />,
          label: 'Cancelled',
          color: 'text-text-secondary',
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/20'
        }
      case 'failed':
        return {
          icon: <XCircle className="h-3 w-3" />,
          label: 'Failed',
          color: 'text-error',
          bg: 'bg-error-bg',
          border: 'border-error/40'
        }
      default:
        return {
          icon: <Clock className="h-3 w-3" />,
          label: status,
          color: 'text-text-secondary',
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/20'
        }
    }
  }

  const statusConfig = getStatusConfig(request.status)

  // One straight row per request (owner, 2026-09-28: the old cards were
  // too tall). The destination, transaction hash and admin note ride on a
  // quiet second line; the hash stays visible because it is the seller's
  // proof of payment.
  const shortAddr = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)
  const wallet = request.payment_details?.wallet_address
  const network = request.payment_details?.network
  const networkLabel = network ? CHAIN_LABELS[network as keyof typeof CHAIN_LABELS] ?? network : null
  const hasDetails = !!(wallet || request.transaction_hash || request.admin_notes)

  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.8fr))_auto_auto]">
        {/* Method + date */}
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-text-primary">{request.method_name}</p>
          <p className="text-[11.5px] text-text-tertiary">{format(new Date(request.created_at), 'MMM d, yyyy · h:mm a')}</p>
        </div>

        {/* Amounts: three columns on sm+, one line on phones */}
        <p className="hidden text-right text-[13px] tabular-nums text-text-primary sm:block">${request.amount.toFixed(2)}</p>
        <p className="hidden text-right text-[13px] tabular-nums text-text-tertiary sm:block">−${request.fee_amount.toFixed(2)}</p>
        <p className="hidden text-right text-[13px] font-semibold tabular-nums text-success sm:block">${request.net_amount.toFixed(2)}</p>

        {/* Status */}
        <span
          className={cn(
            'inline-flex items-center gap-1 justify-self-end whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-semibold',
            statusConfig.color,
            statusConfig.bg,
            statusConfig.border,
          )}
        >
          {statusConfig.icon}
          {statusConfig.label}
        </span>

        {/* Cancel (pending only) */}
        <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
          <p className="text-[12.5px] tabular-nums text-text-secondary sm:hidden">
            ${request.amount.toFixed(2)} <span className="text-text-tertiary">− ${request.fee_amount.toFixed(2)} fee</span> →{' '}
            <span className="font-semibold text-success">${request.net_amount.toFixed(2)}</span>
          </p>
          {request.status === 'pending' ? (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-semibold text-error transition-colors hover:bg-error-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Cancel
            </button>
          ) : (
            <span className="hidden w-[62px] sm:block" aria-hidden />
          )}
        </div>
      </div>

      {hasDetails && (
        <p className="mt-1 truncate text-[11.5px] text-text-tertiary">
          {wallet && (
            <span title={wallet}>
              To <span className="font-mono text-text-secondary">{shortAddr(wallet)}</span>
              {networkLabel ? ` · ${networkLabel}` : ''}
            </span>
          )}
          {request.transaction_hash && (
            <span title={request.transaction_hash}>
              {wallet ? ' · ' : ''}Tx <span className="font-mono text-lime-text">{shortAddr(request.transaction_hash)}</span>
            </span>
          )}
          {request.admin_notes && (
            <span>
              {wallet || request.transaction_hash ? ' · ' : ''}Note: <span className="text-text-secondary">{request.admin_notes}</span>
            </span>
          )}
        </p>
      )}
    </div>
  )
}
