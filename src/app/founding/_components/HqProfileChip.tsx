'use client'

/**
 * HqProfileChip — the signed-in viewer's avatar + name, top-right of the Founding
 * HQ, as a dropdown menu (there's no global navbar on this chrome-less page).
 *
 * Role-aware: an APPROVED seller (isSeller) gets their full account menu
 * (Dashboard, Offers, Wallet, Support, Sign out); anyone not yet a seller only
 * gets Support + Sign out — they have no dashboard/offers/wallet to reach yet.
 * Sign out clears the session and lands on the homepage.
 */

import Link from 'next/link'
import { useTransition } from 'react'
import { LayoutDashboard, Package, Wallet, LifeBuoy, LogOut, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { logout } from '@/lib/actions/auth'
import { PALETTE } from '@/app/account/become-seller/_redesign/theme'
import type { HqUser } from '@/lib/founding/hq-data'

const SELLER_LINKS = [
  { label: 'Dashboard', href: '/account/dashboard', Icon: LayoutDashboard },
  { label: 'Offers', href: '/account/listings', Icon: Package },
  { label: 'Wallet', href: '/account/wallet', Icon: Wallet },
  { label: 'Support', href: '/support', Icon: LifeBuoy },
] as const

const NON_SELLER_LINKS = [{ label: 'Support', href: '/support', Icon: LifeBuoy }] as const

export default function HqProfileChip({ user }: { user: HqUser }) {
  const [pending, startTransition] = useTransition()
  const links = user.isSeller ? SELLER_LINKS : NON_SELLER_LINKS

  function signOut() {
    startTransition(() => {
      void logout() // server action clears the session and redirects to /
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 rounded-full border bg-white/80 py-1 pl-1 pr-2.5 backdrop-blur transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
        style={{ borderColor: PALETTE.line }}
        aria-label="Your account menu"
      >
        <span className="flex h-7 w-7 overflow-hidden rounded-full">
          <AvatarImage
            src={user.avatarUrl}
            alt={user.username}
            username={user.username}
            width={28}
            height={28}
            className="h-7 w-7 object-cover"
          />
        </span>
        <span className="max-w-[120px] truncate text-[12.5px] font-semibold" style={{ color: PALETTE.ink }}>
          {user.username}
        </span>
        <ChevronDown className="h-3.5 w-3.5" style={{ color: PALETTE.ink2 }} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-52">
        {links.map(({ label, href, Icon }) => (
          <DropdownMenuItem key={href} asChild className="cursor-pointer gap-2.5">
            <Link href={href}>
              <Icon className="h-4 w-4" style={{ color: PALETTE.ink2 }} />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            signOut()
          }}
          className="cursor-pointer gap-2.5 text-red-600 focus:text-red-600"
          disabled={pending}
        >
          <LogOut className="h-4 w-4" />
          {pending ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
