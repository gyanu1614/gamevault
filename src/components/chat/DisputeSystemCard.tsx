import { ShieldAlert } from 'lucide-react'
import ChatNotice from './ChatNotice'

interface DisputeSystemCardProps {
  category: string
  reason: string
}

/** "Dispute Opened" notice in the order chat. */
export default function DisputeSystemCard({ category, reason }: DisputeSystemCardProps) {
  return (
    <ChatNotice icon={ShieldAlert} tone="red" title="Dispute Opened">
      {category && <p>Reason: {category}</p>}
      {reason && <p className="line-clamp-2 text-text-tertiary">{reason}</p>}
      <p className="text-text-tertiary">DropMarket reviews disputes within 24 to 48 hours.</p>
    </ChatNotice>
  )
}
