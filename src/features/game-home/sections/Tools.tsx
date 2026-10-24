import { cn } from '@/lib/utils'
import type { ToolsModel } from '../types'
import { SectionHeading } from './SectionHeading'
import { Tile, ToolsRail } from './ToolsRail.client'

/** Up to this many tools fill one row as a grid; more scroll as a rail. */
const GRID_MAX = 4

/**
 * Free {Game} Trading Tools: the game's tool pages from the registry
 * (model/tools.ts), so a new calculator shows up here on its own. A few tools
 * fill the row as a grid (the featured one twice as wide); more become the
 * homepage-style drag rail, so the row never ends in empty space.
 */
export function Tools({ model }: { model: ToolsModel }) {
  const { tiles, art } = model
  return (
    <section aria-labelledby="game-tools">
      <SectionHeading id="game-tools" title={model.title} sub="Free to use, no sign-up." />
      {tiles.length <= GRID_MAX ? (
        // Cells = tiles + 1 (the featured tile is two wide): 1 tool → full row,
        // 2 → 3 columns, 3 → 4 columns, 4 → 4 columns with the featured one single.
        <ul className={cn('mt-8 grid gap-3 sm:gap-4', tiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2', tiles.length === 2 ? 'lg:grid-cols-3' : tiles.length > 2 && 'lg:grid-cols-4')}>
          {tiles.map((tile) => (
            <li key={tile.key} className={cn(tile.featured && tiles.length > 1 && 'col-span-2', tile.featured && tiles.length === GRID_MAX && 'lg:col-span-1')}>
              <Tile tile={tile} art={tile.featured ? art : []} />
            </li>
          ))}
        </ul>
      ) : (
        <ToolsRail tiles={tiles} art={art} />
      )}
    </section>
  )
}
