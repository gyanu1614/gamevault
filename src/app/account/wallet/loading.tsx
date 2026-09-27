'use client'

/**
 * Wallet route fallback. Same skeleton the client shows while the balances
 * load, so the two loading phases are one continuous picture. The seller
 * shape is chosen from the (cached) auth state; before that resolves it
 * falls back to the buyer shape.
 */

import { useAuth } from '@/hooks/use-auth'
import { WalletSkeleton } from './_WalletSkeleton'

export default function WalletLoading() {
  const { user } = useAuth()
  return <WalletSkeleton isSeller={!!user?.isApprovedSeller} />
}
