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
        isRestricted && "bg-warning-bg border-warning/40",
        isBanned && "bg-error-bg border-error/40"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
          isRestricted && "bg-warning-bg",
          isBanned && "bg-error-bg"
        )}>
          {isRestricted && <ShieldAlert className="h-5 w-5 text-warning" />}
          {isBanned && <Ban className="h-5 w-5 text-error" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "text-base font-bold mb-1",
            isRestricted && "text-warning",
            isBanned && "text-error"
          )}>
            {isRestricted && "Your Account is Restricted"}
            {isBanned && "Your Account is Banned"}
          </h3>

          <p className="text-sm text-text-secondary mb-3">
            {isRestricted && "You cannot create or publish new listings. "}
            {isBanned && "You no longer have access to seller features. "}
            {reason || "Please contact support for more information."}
          </p>

          <div className="flex items-center gap-3">
            <Link
              href="/account/restrictions"
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                isRestricted && "bg-warning-bg hover:bg-yellow-500/30 text-warning",
                isBanned && "bg-error-bg hover:bg-red-500/30 text-error"
              )}
            >
              <AlertCircle className="h-4 w-4" />
              View Details
            </Link>

            <a
              href="mailto:test@gmail.com"
              className="text-sm text-text-secondary hover:text-white transition-colors underline"
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
            <X className="h-4 w-4 text-text-secondary" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
