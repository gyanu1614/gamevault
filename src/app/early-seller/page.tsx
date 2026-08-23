/**
 * /early-seller — Founding-seller signup (Screen 2a).
 *
 * Full-screen forest split: left forest panel (Claim Your Spot + N/100 progress
 * + perks), right ivory form card (email, discord, what-you-sell, monthly-volume
 * pills, games multi-select, submit → "Submitted Successfully"). Matches the
 * design in design-refs/founding-seller. Chrome-less (see layout-wrapper).
 *
 * Server component: fetches founding progress + the real game list, hands them
 * to the client form island.
 */

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getFoundingProgress } from '@/lib/actions/early-seller'
import { getAllGames } from '@/lib/utils/games'
import { GAME_ICONS } from '@/features/home/lib/game-icons'
import FoundingSignupClient from './_FoundingSignupClient'
import type { SignupGame } from './_FoundingSignupClient'

export const metadata: Metadata = {
  title: 'Become a Founding Seller — First 100 Get Lower Fees',
  description:
    'Join DropMarket as one of the first 100 sellers and lock in lower fees, early access, and a founding-seller badge. Reserve your spot.',
  alternates: { canonical: '/early-seller' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Become a Founding Seller on DropMarket',
    description:
      'The first 100 sellers get lower fees, early access, and a founding-seller badge. Reserve your spot.',
    url: '/early-seller',
    type: 'website',
  },
}

export const dynamic = 'force-dynamic'

/** Real games for the multi-select — those with a logo first, in a sensible order. */
async function signupGames(): Promise<SignupGame[]> {
  const all = await getAllGames()
  const withLogo = all.filter((g) => GAME_ICONS[g.slug])
  const priority = ['steal-a-brainrot', 'grow-a-garden', 'adopt-me', 'roblox']
  const ordered = [
    ...priority.map((s) => withLogo.find((g) => g.slug === s)).filter(Boolean),
    ...withLogo.filter((g) => !priority.includes(g.slug)),
  ] as typeof withLogo
  const list: SignupGame[] = ordered.map((g) => ({
    slug: g.slug,
    name: g.name,
    logo: GAME_ICONS[g.slug],
  }))
  return list.length
    ? list
    : [
        { slug: 'steal-a-brainrot', name: 'Steal a Brainrot', logo: GAME_ICONS['steal-a-brainrot'] },
        { slug: 'grow-a-garden', name: 'Grow a Garden', logo: GAME_ICONS['grow-a-garden'] },
        { slug: 'roblox', name: 'Roblox', logo: GAME_ICONS['roblox'] },
      ]
}

export default async function EarlySellerPage() {
  const [progress, games] = await Promise.all([getFoundingProgress(), signupGames()])

  return (
    <Suspense fallback={null}>
      <FoundingSignupClient progress={progress} games={games} />
    </Suspense>
  )
}
