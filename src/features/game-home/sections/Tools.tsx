import type { ToolsModel } from '../types'
import { SectionHeading } from './SectionHeading'
import { ToolsRail } from './ToolsRail.client'

/**
 * Free {Game} Trading Tools: the game's tool pages from the registry
 * (model/tools.ts), so a new calculator shows up here on its own.
 */
export function Tools({ model }: { model: ToolsModel }) {
  return (
    <section aria-labelledby="game-tools" className="mt-20 sm:mt-28">
      <SectionHeading id="game-tools" title={model.title} sub="Free to use, no sign-up." />
      <ToolsRail tiles={model.tiles} art={model.art} />
    </section>
  )
}
