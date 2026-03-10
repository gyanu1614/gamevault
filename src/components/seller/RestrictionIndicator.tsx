'use client'

import { ShieldAlert, Ban } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { SellerStatus } from '@/lib/utils/seller-status'

interface RestrictionIndicatorProps {
  status: SellerStatus
  className?: string
}

export default function RestrictionIndicator({ status, className }: RestrictionIndicatorProps) {
  if (status === 'active') {
    return null
  }

  const isRestricted = status === 'restricted'
  const isBanned = status === 'banned'

  return (
    <Link
      href="/account/restrictions"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-full shadow-2xl border-2 transition-all hover:scale-105",
        isRestricted && "bg-yellow-500/90 hover:bg-yellow-500 border-yellow-400 text-black",
        isBanned && "bg-red-500/90 hover:bg-red-500 border-red-400 text-white",
        className
      )}
    >
      {isRestricted && <ShieldAlert className="h-5 w-5" />}
      {isBanned && <Ban className="h-5 w-5" />}
      <span className="font-bold text-sm">
        {isRestricted && "Account Restricted"}
        {isBanned && "Account Banned"}
      </span>
    </Link>
  )
}
