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
import { redirect } from 'next/navigation'
import { getFoundingProgress } from '@/lib/actions/early-seller'
import { getAllGames } from '@/lib/utils/games'
import { GAME_ICONS } from '@/features/home/lib/game-icons'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
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

/**
 * A logged-in user who's already a founder (their email is on the waitlist, or
 * they carry a founding flag) shouldn't see the apply form again — send them to
 * their Founding HQ. Never throws; on any error we just render the form.
 */
async function loggedInFounderRedirect(): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const svc = createServiceRoleClient() as any
    const { data: profile } = await svc
      .from('profiles')
      .select('email, is_founding_applicant, founding_seller')
      .eq('id', user.id)
      .maybeSingle()

    let isFounder = Boolean(profile?.is_founding_applicant || profile?.founding_seller)
    // Belt-and-suspenders: also match the waitlist directly, in case the flag
    // hasn't been set yet (e.g. an account created before the backfill).
    if (!isFounder) {
      const email = (profile?.email as string) || user.email || ''
      if (email) {
        const { data: wl } = await svc
          .from('early_seller_signups')
          .select('id')
          .ilike('email', email.trim())
          .maybeSingle()
        isFounder = Boolean(wl)
      }
    }
    if (isFounder) redirect('/founding')
  } catch (err) {
    // `redirect()` throws a control-flow signal — re-throw it so Next handles it.
    if (err && typeof err === 'object' && 'digest' in err && String((err as any).digest).startsWith('NEXT_REDIRECT')) {
      throw err
    }
    // Any real error → fall through and render the form.
  }
}

export default async function EarlySellerPage() {
  await loggedInFounderRedirect()

  const [progress, games] = await Promise.all([getFoundingProgress(), signupGames()])

  return (
    <Suspense fallback={null}>
      <FoundingSignupClient progress={progress} games={games} />
    </Suspense>
  )
}
