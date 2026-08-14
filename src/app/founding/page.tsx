/*
  THESIS: A founding seller's home base, not a signup wall. It refuses the "list
    of perks + one CTA" landing; status, the latest news, and the door to sell
    live on one continuous surface. OWN-WORLD: the seller application's Forest
    Ledger — ivory ground, white cards, ink text, forest-green feature panel,
    lime as a hairline accent only; the sell.avif forest hero binds the two.
  STORY: an early trader arrives from a personal magic link, sees exactly where
    they stand (#N of 100), reads what's new, and steps into the seller wizard.
  FIRST VIEWPORT: left forest rail with greeting + the spot figure anchored
    between hairlines + perks; right ivory pane leads with the primary action,
    then a live game marquee, then the announcements stream.
  FORM: an application shell extended into a hub — inherits the surface, no new
    world (Impeccable new-work "extend an existing surface"). Seed: n/a (extend).
  FINISH: unreviewed and undocumented is unfinished; this build ends with the
    finish review, the verdict, and DESIGN.md.
*/

import type { Metadata } from 'next'
import { getFoundingHqData } from '@/lib/founding/hq-data'
import { getPublishedFoundingNotices } from '@/lib/actions/founding-notices'
import { isAdmin } from '@/lib/actions/admin-permissions'
import { getAllGames } from '@/lib/utils/games'
import { GAME_ICONS } from '@/features/home/lib/game-icons'
import { DISCORD_INVITE_URL } from '@/lib/config/founding-seller'
import FoundingRail from './_components/FoundingRail'
import FoundingContent from './_components/FoundingContent'
import type { MarqueeGame } from './_components/GameMarquee'

export const metadata: Metadata = {
  title: 'Founding Seller HQ',
  description: 'Your founding-seller status, the latest updates, and the door to start selling on DropMarket.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Games shown in the marquee — Roblox titles only. DropMarket's founding push is
 * a Roblox marketplace, so non-Roblox logos (Apex, CoD…) both clash visually and
 * dilute the story. We show the Roblox games that have a logo, in a fixed order.
 */
const ROBLOX_SLUGS = ['steal-a-brainrot', 'grow-a-garden', 'grow-a-garden-2', 'adopt-me', 'roblox']

async function marqueeGames(): Promise<MarqueeGame[]> {
  const all = await getAllGames()
  const bySlug = new Map(all.map((g) => [g.slug, g]))
  const ordered = ROBLOX_SLUGS
    .filter((slug) => GAME_ICONS[slug]) // only ones with a real logo
    .map((slug) => ({
      slug,
      // Prefer a clean canonical name over messy DB variants like "Grow a Garden 2".
      name: defaultRobloxName(slug) || bySlug.get(slug)?.name || slug,
    }))
  // De-dupe by LOGO FILE so slug variants that share art (grow-a-garden +
  // grow-a-garden-2 → gag.png) render only once.
  const seenIcon = new Set<string>()
  const deduped = ordered.filter((g) => {
    const icon = GAME_ICONS[g.slug]
    if (seenIcon.has(icon)) return false
    seenIcon.add(icon)
    return true
  })
  return deduped.length
    ? deduped
    : [
        { slug: 'steal-a-brainrot', name: 'Steal a Brainrot' },
        { slug: 'grow-a-garden', name: 'Grow a Garden' },
        { slug: 'roblox', name: 'Roblox' },
      ]
}

function defaultRobloxName(slug: string): string {
  const names: Record<string, string> = {
    'steal-a-brainrot': 'Steal a Brainrot',
    'grow-a-garden': 'Grow a Garden',
    'grow-a-garden-2': 'Grow a Garden',
    'adopt-me': 'Adopt Me',
    roblox: 'Roblox',
  }
  return names[slug] ?? ''
}

export default async function FoundingHqPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>
}) {
  const { id, token } = await searchParams
  const admin = await isAdmin()

  const [data, notices, games] = await Promise.all([
    getFoundingHqData({ id, token, isAdmin: admin }),
    getPublishedFoundingNotices(8),
    marqueeGames(),
  ])

  const { founder, cap, progress, journey, user } = data
  const claimed = progress?.count ?? 0

  // The apply CTA carries founding attribution + the applicant's email prefill
  // when we know it (magic-link path), handing off to the existing signup flow.
  const applyHref = '/signup-become-seller?src=founding-hq'

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden lg:grid lg:h-screen lg:grid-cols-[38%_62%] lg:overflow-hidden"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      <FoundingRail
        name={founder?.name ?? null}
        joinNumber={founder?.joinNumber ?? null}
        cap={cap}
        claimed={claimed}
      />
      <FoundingContent
        applyHref={applyHref}
        discordUrl={DISCORD_INVITE_URL}
        hasDiscord={Boolean(founder?.hasDiscord)}
        games={games}
        notices={notices}
        journey={journey}
        user={user}
      />
    </div>
  )
}
