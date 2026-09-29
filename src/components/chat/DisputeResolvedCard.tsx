import { ShieldCheck } from 'lucide-react'
import ChatNotice from './ChatNotice'

interface DisputeResolvedCardProps {
  resolution: 'buyer_favor' | 'seller_favor' | 'partial'
  notes: string
  refundAmount?: number
  /** 'buyer' when the buyer closed it by confirming receipt. */
  resolvedBy?: 'buyer' | 'admin'
}

const RESOLUTION_LABEL = {
  buyer_favor: 'Buyer Favor',
  seller_favor: 'Seller Favor',
  partial: 'Partial Refund',
} as const

/** "Dispute Resolved" / "Dispute Closed By The Buyer" notice in the order chat. */
export default function DisputeResolvedCard({ resolution, notes, refundAmount, resolvedBy }: DisputeResolvedCardProps) {
  const title =
    resolvedBy === 'buyer' ? 'Dispute Closed By The Buyer' : `Dispute Resolved: ${RESOLUTION_LABEL[resolution]}`
  return (
    <ChatNotice icon={ShieldCheck} tone="lime" title={title}>
      {notes && <p className="line-clamp-2">{notes}</p>}
      {refundAmount !== undefined && refundAmount > 0 && (
        <p>
          Refunded to the buyer&apos;s wallet:{' '}
          <span className="font-semibold tabular-nums text-text-primary">${refundAmount.toFixed(2)}</span>
        </p>
      )}
    </ChatNotice>
  )
}
