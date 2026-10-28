'use client'

/**
 * AccountMenu — the checkout bar's account menu (owner 2026-10-27: "the exact
 * same one we have on our site, and clicking it opens the same stuff"): the
 * site's avatar trigger, NavPanel and ProfileMenu, fed by the same hooks and
 * caches as the site navbar. Sign-out follows the house pattern: raise the
 * logout signal and navigate home FIRST, then signOut, so a protected page
 * never repaints logged-out in place.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from '@/components/navigation/AppLink'
import { useAuth } from '@/hooks/use-auth'
import { useIsAdmin } from '@/hooks/use-is-admin'
import { useUnreadMessagesCount } from '@/hooks/use-unread-messages'
import { beginLogout } from '@/lib/auth/logout-signal'
import { NavAccountButton, NavPanel } from '@/components/navbar/NavChrome'
import { ProfileMenu } from '@/components/navbar/ProfileMenu'
import { useNavWalletBalance, useStoreOfflineMode } from '@/components/navbar/use-profile-menu-data'

export function AccountMenu() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isAdmin = useIsAdmin(user?.id)
  const unreadMessages = useUnreadMessagesCount(user?.id)
  const walletBalance = useNavWalletBalance(user)
  const { offlineMode, pendingOffline, toggleOfflineMode } = useStoreOfflineMode(user)

  // A tap or click outside, or Escape, closes it (the site bar's rule).
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (loading && !user) {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-white/10 max-lg:h-9 max-lg:w-9 lg:w-[62px] lg:rounded-[8px]" />
  }
  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-md border border-white/25 px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:border-white/50"
      >
        Log In
      </Link>
    )
  }

  const logout = async () => {
    setOpen(false)
    beginLogout()
    router.replace('/')
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().auth.signOut()
    queryClient.clear()
  }

  return (
    <div ref={ref} className="relative">
      <NavAccountButton user={user} open={open} onClick={() => setOpen((v) => !v)} />
      {open && (
        <NavPanel onClose={() => setOpen(false)} width="sm:w-[340px]" position="sm:-right-2 sm:mt-[20px]">
          <ProfileMenu
            user={user}
            isAdmin={isAdmin}
            walletBalance={walletBalance}
            unreadMessages={unreadMessages}
            offlineMode={offlineMode}
            pendingOffline={pendingOffline}
            onToggleOffline={toggleOfflineMode}
            onNavigate={() => setOpen(false)}
            onLogout={() => void logout()}
          />
        </NavPanel>
      )}
    </div>
  )
}
