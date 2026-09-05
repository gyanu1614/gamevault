'use client'

/**
 * FoundingNavbar — the slim, seamless top bar shared by the founding surfaces
 * (/early-seller + /founding). GameBoost-style: it sits OVER the split hero with
 * no divider line, spanning full width — the real DropMarket mark far left
 * (clickable → home), and on the right the profile chip when signed in, or a
 * "Log in" button when signed out.
 *
 * Transparent background so it flows into whatever is behind it (the forest
 * panel on the left, the ivory content on the right). No border, no shadow.
 */

import Link from 'next/link'
import Image from 'next/image'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import { useAuth } from '@/hooks/use-auth'
import HqProfileChip from './HqProfileChip'
import type { HqUser } from '@/lib/founding/hq-data'

export default function FoundingNavbar({
  /** When known server-side (on /founding), pass the resolved HqUser so the chip
   *  renders without waiting on the client auth fetch. On /early-seller it's
   *  omitted and we fall back to the client useAuth() session. */
  user = null,
}: {
  user?: HqUser | null
}) {
  const { open: openAuth } = useAuthDialog()
  const { user: authUser, loading } = useAuth()

  // Prefer the server-provided HqUser; otherwise synthesize a minimal one from
  // the client session so the chip can render on /early-seller too.
  const chipUser: HqUser | null =
    user ??
    (authUser
      ? {
          username:
            (authUser.profile?.full_name as string) ||
            (authUser.profile?.username as string) ||
            'Account',
          avatarUrl: (authUser.profile?.avatar_url as string) || null,
          isSeller: (authUser.profile?.role as string) === 'seller',
        }
      : null)

  const isLoggedIn = Boolean(user || authUser)

  return (
    <div className="absolute inset-x-0 top-0 z-30">
      <div className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5 lg:px-10">
        {/* Logo — real DropMarket mark, white so it reads over the forest panel. */}
        <Link href="/" aria-label="DropMarket home" className="flex items-center gap-2.5">
          <Image
            src="/brand/logo-mark-white.png"
            alt="DropMarket"
            width={30}
            height={30}
            className="h-[28px] w-[28px] object-contain"
            priority
          />
          <span className="text-[19px] tracking-tight text-white">
            <span className="font-extrabold">Drop</span>
            <span className="font-medium">Market</span>
          </span>
        </Link>

        {/* Right: profile chip when signed in, else a Log in button. */}
        <div>
          {isLoggedIn && chipUser ? (
            <HqProfileChip user={chipUser} />
          ) : (
            !loading && (
              // Sits over the ivory content side → forest styling reads on light.
              // "Check Status" — the returning applicant's way back in (it's a
              // login under the hood; founders land on their HQ).
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="rounded-lg border px-4 py-2 text-[13.5px] font-semibold transition-colors"
                style={{ borderColor: '#DDE0D3', backgroundColor: '#F2F4EC', color: '#14432A' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E8ECE0')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F2F4EC')}
              >
                Check Status
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
