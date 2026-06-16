'use client'

import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

export default function CopyOrderId({ orderNum }: { orderNum: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(orderNum)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-disabled">Order ID:</span>
      <span className="text-xs font-mono text-text-secondary">#{orderNum}</span>
      <button
        onClick={handleCopy}
        className="p-1 hover:bg-white/5 rounded transition-colors"
        title="Copy order ID"
      >
        {copied ? (
          <Check className="w-3 h-3 text-success" />
        ) : (
          <Copy className="w-3 h-3 text-text-disabled hover:text-text-secondary" />
        )}
      </button>
    </div>
  )
}
