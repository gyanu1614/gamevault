'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Eye, EyeOff, Sparkles, Lock, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DeliveryType } from '@/lib/actions/instant-delivery'

interface InstantDeliveryCodeDisplayProps {
  code: string
  deliveryType?: DeliveryType
  orderNumber?: string
  className?: string
}

export default function InstantDeliveryCodeDisplay({
  code,
  deliveryType = 'code',
  orderNumber,
  className
}: InstantDeliveryCodeDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const getDeliveryTypeLabel = () => {
    switch (deliveryType) {
      case 'credentials':
        return 'Account Credentials'
      case 'gift_card':
        return 'Gift Card Code'
      case 'key':
        return 'License Key'
      default:
        return 'Redemption Code'
    }
  }

  const formatCodeForDisplay = () => {
    if (deliveryType === 'credentials') {
      const [username, password] = code.split(':')
      return (
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-1.5 font-medium">Username / Email:</div>
            <div className="font-mono text-base sm:text-lg font-bold text-white break-all">
              {username}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1.5 font-medium">Password:</div>
            <div className="font-mono text-base sm:text-lg font-bold text-white break-all">
              {isVisible ? password : '•'.repeat(password.length)}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="font-mono text-lg sm:text-xl font-bold text-white break-all text-center">
        {isVisible ? code : '•'.repeat(Math.min(code.length, 20))}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn('w-full', className)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
          <Sparkles className="w-6 h-6 text-green-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Instant Delivery
            <ShieldCheck className="w-5 h-5 text-green-400" />
          </h3>
          <p className="text-sm text-gray-400">
            Your {getDeliveryTypeLabel().toLowerCase()} is ready!
          </p>
        </div>
      </div>

      {/* Code Display Card */}
      <div className="rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-emerald-500/5 p-6 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-green-300">
              {getDeliveryTypeLabel()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsVisible(!isVisible)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              title={isVisible ? 'Hide' : 'Show'}
            >
              {isVisible ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={handleCopy}
              className={cn(
                'px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2',
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-white/5 hover:bg-white/10 text-white'
              )}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="rounded-xl bg-black/40 border border-white/10 p-4 sm:p-6">
          {formatCodeForDisplay()}
        </div>

        {/* Instructions */}
        <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-200 leading-relaxed">
            {deliveryType === 'credentials' ? (
              <>
                <span className="font-semibold">Login Instructions:</span> Use the username and password above to access your account.
                Keep these credentials secure and do not share them with anyone.
              </>
            ) : deliveryType === 'gift_card' ? (
              <>
                <span className="font-semibold">Redemption Instructions:</span> Copy the code above and redeem it on the platform.
                The code can only be used once.
              </>
            ) : (
              <>
                <span className="font-semibold">Activation Instructions:</span> Copy the code above and follow the seller's instructions to activate your purchase.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Security Notice */}
      <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs text-gray-400 leading-relaxed">
            <span className="text-green-400 font-medium">Security:</span> This code was delivered instantly and securely encrypted.
            Save it somewhere safe - you can always find it here in your order details{orderNumber ? ` (#${orderNumber})` : ''}.
          </p>
        </div>
      </div>
    </motion.div>
  )
}
