'use client'

/**
 * The profile menu's live data, shared by the site navbar and the checkout
 * bar (owner 2026-10-27: "the exact same one we have on our site") so both
 * menus show the same Offline Mode switch and wallet balance from one cache.
 */

import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getMyWalletBalance } from '@/lib/actions/wallet-ledger'
import { setStorePaused, getMyStorePaused } from '@/lib/actions/seller-presence'
import { safeBackground } from '@/lib/utils/safe-background'

type MenuUser = { id?: string; isApprovedSeller?: boolean } | null | undefined

/**
 * V21/P7.ae — Offline Mode (store pause). When on, the seller's offers are
 * taken down for buyers until toggled back. `pendingOffline` blocks
 * double-clicks while the server action is in flight.
 */
export function useStoreOfflineMode(user: MenuUser) {
  const [offlineMode, setOfflineMode] = useState(false)
  const [pendingOffline, setPendingOffline] = useState(false)

  // Hydrate for approved sellers.
  useEffect(() => {
    if (!user?.isApprovedSeller) { setOfflineMode(false); return }
    let active = true
    // A `.then()` with no `.catch()` here was JAVASCRIPT-NEXTJS-5: on a flaky
    // mobile connection the server-action POST rejects with WebKit's opaque
    // "TypeError: Load failed" and, with nothing handling it, reaches Sentry as
    // an unhandled rejection. Offline Mode is an enrichment — degrade to the
    // safe default (store online) rather than break the navbar.
    void safeBackground(() => getMyStorePaused(), false, 'navbar:storePaused').then((v) => {
      if (active) setOfflineMode(v)
    })
    return () => { active = false }
  }, [user?.id, user?.isApprovedSeller])

  // Optimistic flip with rollback on failure.
  const toggleOfflineMode = useCallback(async () => {
    if (pendingOffline) return
    const next = !offlineMode
    setOfflineMode(next)
    setPendingOffline(true)
    // A rejected POST here (same "Load failed" transport failure) would skip
    // setPendingOffline(false) and leave the toggle permanently stuck, so the
    // network failure degrades into the existing rollback path.
    const res = await safeBackground(
      () => setStorePaused(next),
      { success: false as const },
      'navbar:setStorePaused',
    )
    setPendingOffline(false)
    if (!res.success) {
      setOfflineMode(!next) // rollback
      toast.error('Could not update store status')
      return
    }
    toast.success(next ? 'Store is now offline — your offers are hidden' : 'Store is back online')
  }, [offlineMode, pendingOffline])

  return { offlineMode, pendingOffline, toggleOfflineMode }
}

/**
 * V63 — Wallet balance for the profile-menu Wallet row (sellers).
 * Ledger-backed store credit (wallet-ledger); the legacy wallet_balances
 * float table is archived and must not be read.
 */
export function useNavWalletBalance(user: MenuUser) {
  const { data } = useQuery({
    queryKey: ['wallet-balance-navbar', user?.id],
    queryFn: async () => {
      const result = await getMyWalletBalance()
      return result.success ? result.balance : null
    },
    enabled: !!user?.isApprovedSeller,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  return data != null ? Number(data.available_balance ?? 0) : null
}
