'use client'

import { PackageCheck, XCircle } from 'lucide-react'
import { parseSystemNotice } from '@/lib/chat/system-notice'
import DisputeSystemCard from './DisputeSystemCard'
import DisputeResolvedCard from './DisputeResolvedCard'
import ChatNotice from './ChatNotice'

/** A DropMarket notice in the thread (no sender): dispute and order cards.
 *  Anything unrecognised from the system sender is not shown. */
export default function SystemNoticeRow({ content }: { content: string }) {
  const notice = parseSystemNotice(content)
  if (notice?.type === 'dispute_opened') {
    return <DisputeSystemCard category={notice.category ?? ''} reason={notice.reason ?? ''} />
  }
  if (notice?.type === 'order_delivered') {
    return (
      <ChatNotice icon={PackageCheck} tone="lime" title="Order Delivered">
        {notice.seller ? `${notice.seller} marked the order delivered.` : 'The seller marked the order delivered.'}{' '}
        Buyer, please check you received your items, then confirm delivery.
      </ChatNotice>
    )
  }
  if (notice?.type === 'order_cancelled') {
    return (
      <ChatNotice
        icon={XCircle}
        tone="neutral"
        title={notice.by === 'system' ? 'Order Cancelled — Not Delivered' : 'Order Cancelled By The Seller'}
      >
        {notice.reason && <p>Reason: {notice.reason}</p>}
        {notice.note && <p className="line-clamp-2 text-text-tertiary">{notice.note}</p>}
        <p>The buyer was refunded to their Store Balance.</p>
      </ChatNotice>
    )
  }
  if (notice?.type === 'dispute_resolved') {
    return (
      <DisputeResolvedCard
        resolution={notice.resolution}
        notes={notice.notes ?? ''}
        refundAmount={notice.refundAmount}
        resolvedBy={notice.resolvedBy}
      />
    )
  }
  return null
}
