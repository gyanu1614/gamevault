import * as ReactDOM from 'react-dom'
import type { ReactNode } from 'react'
import { getGameHero } from '@/lib/games/hero.server'
import type { GameHero } from '@/lib/games/hero'
import { GameHeroArt, type GameHeroSize } from './GameHeroArt'

/**
 * GameHeroBackdrop — the game's ONE hero background, behind the top of every
 * page of that game: marketplace category pages (items, currency, bundles,
 * accounts, boosting), the game landing, listing / item pages, and the
 * values, calculator, price index, methodology, blog and sell hubs.
 *
 *   <GameHeroBackdrop gameSlug={gameSlug} size="hub">
 *     …page content…
 *   </GameHeroBackdrop>
 *
 * Data: `getGameHero(slug)` — cookie-free, cached per game, tagged
 * `game-hero:<slug>` (admin upload → revalidateTag). Upload → static art →
 * neutral gradient (src/lib/games/hero.ts). A new game needs nothing here:
 * upload its hero in /admin/games/<id>/edit (Branding) or drop a file in
 * design/game-heroes/ and run `pnpm game-hero:import`.
 *
 * Loading (no Next image optimizer, no layout shift):
 *   • the LQIP is a data: URL painted inline, so the band is never empty;
 *   • the image is a plain <img srcset sizes="100vw" fetchpriority="high">
 *     of pre-sized WebPs (960 / 1600 / 2400) — a phone fetches ~960 w;
 *   • ReactDOM.preload puts <link rel=preload as=image imagesrcset> in the
 *     <head>, so the download starts with the HTML, not after JS;
 *   • it renders OUTSIDE the page's Suspense boundary, so it ships in the
 *     first flush with the skeleton.
 *
 * Children render in a `relative z-20` layer above the band (the band is
 * z-0), the same contract the retired SabHeroBackdrop had.
 */
export async function GameHeroBackdrop({
  gameSlug,
  size = 'hub',
  children,
}: {
  gameSlug: string
  /** market = category / listing pages, landing = /<game>, hub = values & co, tall = sell / value item. */
  size?: GameHeroSize
  children?: ReactNode
}) {
  const hero = await getGameHero(gameSlug)
  preloadGameHero(hero)
  return (
    <div className="game-hero-scope">
      <GameHeroArt hero={hero} size={size} />
      <div className="relative z-20">{children}</div>
    </div>
  )
}

/**
 * Head preload for the hero. Same srcset + sizes as the <img>, so the browser
 * picks the same file once. (`preload` is the React canary API Next ships;
 * optional-called so a plain react-dom in tests is a no-op.)
 */
export function preloadGameHero(hero: GameHero): void {
  const preload = (ReactDOM as { preload?: typeof ReactDOM.preload }).preload
  if (!preload) return
  if (hero.kind === 'upload') {
    preload(hero.src, { as: 'image', imageSrcSet: hero.srcSet, imageSizes: '100vw', fetchPriority: 'high' })
  } else if (hero.kind === 'static') {
    preload(hero.src, { as: 'image', fetchPriority: 'high' })
  }
}
