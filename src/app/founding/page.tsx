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
import { isAdmin } from '@/lib/actions/admin-permissions'
import { getAllGames } from '@/lib/utils/games'
import { GAME_ICONS } from '@/features/home/lib/game-icons'
import { DISCORD_INVITE_URL } from '@/lib/config/founding-seller'
import FoundingRail from './_components/FoundingRail'
import FoundingContent from './_components/FoundingContent'
import FoundingNavbar from './_components/FoundingNavbar'
import type { MarqueeGame } from './_components/GameMarquee'

export const metadata: Metadata = {
  title: 'Founding Seller HQ',
  description: 'Your founding-seller status, the latest updates, and the door to start selling on DropMarket.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Games shown in the marquee — the full catalogue, not just Roblox: every
 * active game with a real logo in GAME_ICONS, Roblox titles first (they lead
 * the founding story), then the rest in catalog order. De-duped by logo file so
 * slug variants sharing art (grow-a-garden + grow-a-garden-2) render once.
 */
const ROBLOX_SLUGS = ['steal-a-brainrot', 'grow-a-garden', 'grow-a-garden-2', 'adopt-me', 'roblox']

async function marqueeGames(): Promise<MarqueeGame[]> {
  const all = await getAllGames()
  const bySlug = new Map(all.map((g) => [g.slug, g]))

  // Roblox first, then every other catalog game — only ones with real art.
  const orderedSlugs = [
    ...ROBLOX_SLUGS,
    ...all.map((g) => g.slug).filter((s) => !ROBLOX_SLUGS.includes(s)),
  ].filter((slug) => GAME_ICONS[slug])

  const seenIcon = new Set<string>()
  const deduped: MarqueeGame[] = []
  for (const slug of orderedSlugs) {
    const icon = GAME_ICONS[slug]
    if (seenIcon.has(icon)) continue
    seenIcon.add(icon)
    deduped.push({
      slug,
      // Prefer a clean canonical name over messy DB variants like "Grow a Garden 2".
      name: defaultRobloxName(slug) || bySlug.get(slug)?.name || slug,
    })
  }
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

  const [data, games] = await Promise.all([
    getFoundingHqData({ id, token, isAdmin: admin }),
    marqueeGames(),
  ])

  const { founder, cap, progress, journey, user } = data
  const claimed = progress?.count ?? 0

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden lg:grid lg:h-screen lg:grid-cols-[38%_62%] lg:overflow-hidden"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      {/* Full-width seamless top bar over both panels. */}
      <FoundingNavbar user={user} />
      <FoundingRail
        name={founder?.name ?? null}
        joinNumber={founder?.joinNumber ?? null}
        cap={cap}
        claimed={claimed}
      />
      <FoundingContent
        discordUrl={DISCORD_INVITE_URL}
        hasDiscord={Boolean(founder?.hasDiscord)}
        games={games}
        journey={journey}
        user={user}
      />
    </div>
  )
}
