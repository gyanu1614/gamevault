'use client'

import { motion } from 'framer-motion'
import { ShieldAlert, Ban, AlertCircle, X } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { SellerStatus } from '@/lib/utils/seller-status'

interface RestrictionBannerProps {
  status: SellerStatus
  reason?: string | null
  dismissible?: boolean
}

export default function RestrictionBanner({ status, reason, dismissible = true }: RestrictionBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  if (status === 'active' || isDismissed) {
    return null
  }

  const isRestricted = status === 'restricted'
  const isBanned = status === 'banned'

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-xl border-2 p-4 mb-6",
        isRestricted && "bg-yellow-500/10 border-yellow-500/30",
        isBanned && "bg-red-500/10 border-red-500/30"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
          isRestricted && "bg-yellow-500/20",
          isBanned && "bg-red-500/20"
        )}>
          {isRestricted && <ShieldAlert className="h-5 w-5 text-yellow-400" />}
          {isBanned && <Ban className="h-5 w-5 text-red-400" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "text-base font-bold mb-1",
            isRestricted && "text-yellow-400",
            isBanned && "text-red-400"
          )}>
            {isRestricted && "Your Account is Restricted"}
            {isBanned && "Your Account is Banned"}
          </h3>

          <p className="text-sm text-gray-300 mb-3">
            {isRestricted && "You cannot create or publish new listings. "}
            {isBanned && "You no longer have access to seller features. "}
            {reason || "Please contact support for more information."}
          </p>

          <div className="flex items-center gap-3">
            <Link
              href="/account/restrictions"
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                isRestricted && "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400",
                isBanned && "bg-red-500/20 hover:bg-red-500/30 text-red-400"
              )}
            >
              <AlertCircle className="h-4 w-4" />
              View Details
            </Link>

            <a
              href="mailto:test@gmail.com"
              className="text-sm text-gray-400 hover:text-white transition-colors underline"
            >
              Contact Support
            </a>
          </div>
        </div>

        {/* Dismiss Button */}
        {dismissible && (
          <button
            onClick={() => setIsDismissed(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
