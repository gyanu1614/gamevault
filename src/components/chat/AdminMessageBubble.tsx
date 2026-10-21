'use client'

import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
import { clockTime, renderMarkdown } from './message-text'

/** A DropMarket support member's message: centred, like a system message. */
export default function AdminMessageBubble({
  message,
  adminInfo,
}: {
  message: { id: string; content: string; created_at: string }
  adminInfo?: { username: string; avatar_url?: string }
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mb-4 flex justify-center"
      data-message-id={message.id}
    >
      <div className="flex max-w-md flex-col items-center">
        <div className="mb-2 flex items-center gap-2">
          <div className="relative">
            {adminInfo?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar URL (storage)
              <img src={adminInfo.avatar_url} alt="Support" className="h-6 w-6 rounded-full ring-1 ring-blue-400/40" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600">
                <Shield className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full border border-black bg-blue-500">
              <Shield className="h-1.5 w-1.5 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-blue-400">{adminInfo?.username || 'Support'}</span>
            <div className="flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/15 px-2 py-0.5">
              <Shield className="h-2.5 w-2.5 text-blue-400" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400">Support</span>
            </div>
          </div>
        </div>
        <div className="w-full rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 backdrop-blur-sm">
          <p className="whitespace-pre-wrap text-center text-xs leading-relaxed text-gray-200">{renderMarkdown(message.content)}</p>
        </div>
        <div className="mt-1.5">
          <span className="text-[10px] text-text-tertiary">{clockTime(message.created_at)}</span>
        </div>
      </div>
    </motion.div>
  )
}
