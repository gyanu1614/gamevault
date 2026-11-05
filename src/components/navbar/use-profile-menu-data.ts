'use client'

/**
 * The profile menu's live data, shared by the site navbar and the checkout
 * bar (owner 2026-10-27: "the exact same one we have on our site") so both
 * menus show the same Offline Mode switch and wallet balance from one cache.
 */

import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { setStorePaused } from '@/lib/actions/seller-presence'
import { safeBackground } from '@/lib/utils/safe-background'

type MenuUser = { id?: string; isApprovedSeller?: boolean } | null | undefined

interface AccountMenu {
  walletBalance: number
  storePaused: boolean
}

const menuKey = (id: string | undefined) => ['account-menu', id] as const

/**
 * One plain request, not server actions. Next runs actions one at a time, so two
 * reads here made every seller's page wait in line before its own data loaded.
 */
async function fetchAccountMenu(): Promise<AccountMenu> {
  const res = await fetch('/api/account/menu', { cache: 'no-store' })
  if (!res.ok) throw new Error(`account menu ${res.status}`)
  return res.json()
}

function useAccountMenu(user: MenuUser) {
  return useQuery({
    queryKey: menuKey(user?.id),
    queryFn: fetchAccountMenu,
    enabled: !!user?.isApprovedSeller,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

/**
 * V21/P7.ae — Offline Mode (store pause). When on, the seller's offers are
 * taken down for buyers until toggled back. `pendingOffline` blocks
 * double-clicks while the server action is in flight.
 */
export function useStoreOfflineMode(user: MenuUser) {
  const [offlineMode, setOfflineMode] = useState(false)
  const [pendingOffline, setPendingOffline] = useState(false)

  const queryClient = useQueryClient()
  const { data: menu } = useAccountMenu(user)

  // Follow the server's answer; a failed read degrades to the safe default (online).
  useEffect(() => {
    setOfflineMode(user?.isApprovedSeller ? !!menu?.storePaused : false)
  }, [user?.isApprovedSeller, menu?.storePaused])

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
    queryClient.setQueryData<AccountMenu>(menuKey(user?.id), (old) => (old ? { ...old, storePaused: next } : old))
    toast.success(next ? 'Store is now offline. Your offers are hidden.' : 'Store is back online')
  }, [offlineMode, pendingOffline, queryClient, user?.id])

  return { offlineMode, pendingOffline, toggleOfflineMode }
}

/**
 * V63 — Wallet balance for the profile-menu Wallet row (sellers).
 * Ledger-backed store credit (wallet-ledger); the legacy wallet_balances
 * float table is archived and must not be read.
 */
export function useNavWalletBalance(user: MenuUser) {
  const { data } = useAccountMenu(user)
  return data != null ? data.walletBalance : null
}
