import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { resolveItemRoute } from '../../_valueItemOffers'

/**
 * Every pet page. The 404 check lives here, ABOVE the loading.tsx skeleton: a
 * notFound() inside that boundary would answer 200 (the soft 404 the category
 * page's note in ../../page.tsx describes). A layout runs before anything
 * streams, so an unknown pet is a real 404. The (pet) group keeps its loading.tsx
 * from wrapping [variant], which has its own check. The hero ships with the
 * skeleton. Cheap, cached reads only; no listing is read here.
 */
export default async function ItemLayout({
  params,
  children,
}: {
  params: Promise<{ gameSlug: string; categorySlug: string; itemSlug: string }>
  children: ReactNode
}) {
  const { gameSlug, categorySlug, itemSlug } = await params
  if (!(await resolveItemRoute(gameSlug, categorySlug, itemSlug, null))) notFound()
  return (
    <GameHeroBackdrop gameSlug={gameSlug} size="market">
      {children}
    </GameHeroBackdrop>
  )
}
