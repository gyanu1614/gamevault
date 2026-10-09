/**
 * /founding — Become a seller in four steps (open seller signup, 2026-10-08).
 *
 * Sign up or log in → details → store → agreement. No identity check here:
 * the seller lists straight away as unverified and verifies at their first
 * withdrawal (payout gate). Progress is saved server-side between steps.
 * Dark site theme; the route is chrome-less (layout-wrapper) and carries its
 * own slim header. Legacy Founding-HQ links (?id=&token=) land here cleanly —
 * the query is simply ignored.
 */
import type { Metadata } from 'next'
import { getFoundingFlowState } from '@/lib/actions/founding-onboarding'
import { getAllGames } from '@/lib/utils/games'
import { getGameCategories } from '@/app/account/become-seller/_redesign/game-categories'
import { GAME_ICONS } from '@/features/home/lib/game-icons'
import { getLegalDoc } from '@/lib/legal/documents'
import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import { seoMeta } from '@/lib/seo/fit'
import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'
import FoundingFlow from './_flow/FoundingFlow'

export const metadata: Metadata = seoMeta({
  title: 'Sell Game Items for Real Money — Start Listing Today',
  description:
    'Become a DropMarket seller in four short steps. List Roblox items, currency and accounts today, get paid in your wallet, and verify your identity when you cash out.',
  alternates: { canonical: '/founding' },
  robots: { index: true, follow: true },
  openGraph: {
    images: DEFAULT_OG_IMAGES,
    title: 'Sell Game Items for Real Money on DropMarket',
    description: 'Four short steps. List today, verify when you cash out. Founding sellers lock in half-price commission.',
    url: '/founding',
    type: 'website',
  },
})

export const dynamic = 'force-dynamic'

/** Games for the picker: the ones with real art first, then the rest A→Z. */
async function pickerGames() {
  const all = await getAllGames()
  const withArt = all.filter((g) => GAME_ICONS[g.slug])
  const rest = all.filter((g) => !GAME_ICONS[g.slug])
  return [...withArt, ...rest].map((g) => ({ ...g, image_url: GAME_ICONS[g.slug] ?? g.image_url }))
}

export default async function FoundingPage() {
  const [state, games] = await Promise.all([getFoundingFlowState(), pickerGames()])
  const categories = await getGameCategories(games.map((g) => ({ id: g.id, slug: g.slug, name: g.name })))
  const doc = getLegalDoc('seller-agreement')
  if (!doc) throw new Error('seller-agreement document missing')

  // Hero background: the shared backdrop contract (public/assets/heroes/{name}.avif).
  // founding.avif (owner-supplied, 2026-10-08).
  return (
    <>
      <HeroBackdropPreload name="founding" />
      <HeroBackdrop name="founding" className="hero-dim">
        <FoundingFlow
          initialState={state}
          games={games}
          categories={categories}
          agreement={{ title: doc.title, sections: doc.sections }}
        />
      </HeroBackdrop>
    </>
  )
}
