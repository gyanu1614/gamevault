'use client'

/**
 * AccountMenu — the checkout-surface navbar account dropdown (shared by the
 * checkout page and the crypto payment page). Light Radix menu on the dark
 * strip. Sign-out follows the house pattern: navigate FIRST, then signOut,
 * so a protected page never repaints logged-out in place.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Loader2, LogOut, Package, Settings, Wallet } from 'lucide-react'
import { getAvatarUrl } from '@/lib/utils/avatar'

const LINE = '#E4E5DE'
const INK = '#1A1D19'
const INK2 = '#5B6157'

export function AccountMenu({
  user,
  buyerProfile,
}: {
  user: any
  buyerProfile?: { username: string | null; avatar_url: string | null } | null
}) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
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
  const name = buyerProfile?.username || user.email?.split('@')[0] || 'Account'
  const handleSignOut = async () => {
    setSigningOut(true)
    router.push('/')
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().auth.signOut()
  }
  const item =
    'flex w-full cursor-pointer items-center gap-2.5 rounded px-2.5 py-2 text-[13px] font-medium outline-none data-[highlighted]:bg-[#F3F3ED]'
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-white/10"
          aria-label="Account Menu"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getAvatarUrl(buyerProfile?.avatar_url, name)}
            alt=""
            className="h-7 w-7 rounded-full object-cover ring-1 ring-white/20"
          />
          <span className="hidden max-w-[140px] truncate text-[13px] font-semibold text-white sm:block">
            {name}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-white/60" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[220px] rounded-lg border bg-white p-1.5 shadow-[0_14px_40px_-14px_rgba(0,0,0,0.25)]"
          style={{ borderColor: LINE, color: INK }}
        >
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: INK2 }}>
              Signed In As
            </p>
            <p className="truncate text-[13px] font-semibold">{user.email}</p>
          </div>
          <Dropdown.Separator className="mx-1 mb-1 h-px" style={{ background: LINE }} />
          <Dropdown.Item className={item} onSelect={() => router.push('/account/orders')}>
            <Package className="h-4 w-4" style={{ color: INK2 }} /> My Orders
          </Dropdown.Item>
          <Dropdown.Item className={item} onSelect={() => router.push('/account/wallet')}>
            <Wallet className="h-4 w-4" style={{ color: INK2 }} /> Wallet
          </Dropdown.Item>
          <Dropdown.Item className={item} onSelect={() => router.push('/account')}>
            <Settings className="h-4 w-4" style={{ color: INK2 }} /> Account Settings
          </Dropdown.Item>
          <Dropdown.Separator className="mx-1 my-1 h-px" style={{ background: LINE }} />
          <Dropdown.Item
            className={item}
            disabled={signingOut}
            onSelect={(e) => {
              e.preventDefault()
              void handleSignOut()
            }}
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: INK2 }} />
            ) : (
              <LogOut className="h-4 w-4" style={{ color: INK2 }} />
            )}
            Sign Out
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
