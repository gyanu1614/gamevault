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
      <span className="text-xs text-gray-600">Order ID:</span>
      <span className="text-xs font-mono text-gray-400">#{orderNum}</span>
      <button
        onClick={handleCopy}
        className="p-1 hover:bg-white/5 rounded transition-colors"
        title="Copy order ID"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-400" />
        ) : (
          <Copy className="w-3 h-3 text-gray-600 hover:text-gray-400" />
        )}
      </button>
    </div>
  )
}
