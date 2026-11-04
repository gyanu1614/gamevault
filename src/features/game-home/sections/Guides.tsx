import type { GuidesModel } from '../types'
import { GuidesCarousel } from './GuidesCarousel.client'
import { SectionHeading } from './SectionHeading'

/** {Game} Guides: the game's newest posts as a swipe carousel, All Guides to the blog hub. */
export function Guides({ model }: { model: GuidesModel }) {
  return (
    <section aria-labelledby="game-guides" className="mt-20 sm:mt-28">
      <SectionHeading id="game-guides" title={model.title} action={{ href: model.moreHref, label: 'All Guides' }} />
      <GuidesCarousel posts={model.posts} />
    </section>
  )
}
