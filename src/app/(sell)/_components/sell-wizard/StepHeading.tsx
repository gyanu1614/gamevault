import type { GlobalCategory } from '@/lib/actions/new-schema'
import type { SellGameOption } from '@/lib/actions/sell-wizard'

import type { WizardStep } from './hooks/use-wizard-steps'

/**
 * The page title above each step. Steps 1–2 name the task ("Create An
 * Offer", "Sell Items"); step 3 names what is being listed, with the game's
 * logo: "{Game} {Category}", or "{Game} {unit}" for currency ("Roblox
 * Robux"), held as a width-stable skeleton until the unit label loads so it
 * never flashes "Currency" first.
 */
export function StepHeading({
  step,
  category,
  game,
  unitLabel,
  unitLabelLoading,
}: {
  step: WizardStep
  category: GlobalCategory | null
  game: SellGameOption | null
  unitLabel: string | null
  unitLabelLoading: boolean
}) {
  const titleCls = 'text-[24px] font-extrabold leading-tight tracking-tight text-text-primary sm:text-[30px]'

  if (step === 3 && game) {
    const isCurrency = category?.slug === 'currency'
    const showTitle = !isCurrency || !unitLabelLoading
    const title = isCurrency ? `${game.game_name} ${unitLabel ?? ''}`.trim() : `${game.game_name} ${category?.name ?? 'Listing'}`
    return (
      <div className="mb-4 sm:mb-5">
        <div className="flex items-center justify-center gap-3 text-left">
          {game.game_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.game_logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-border-default" />
          ) : (
            <span className="text-3xl">{game.game_emoji ?? '🎮'}</span>
          )}
          <div className="min-w-0">
            <h1 className={titleCls}>
              {showTitle ? title : <span className="inline-block h-[1em] w-48 animate-pulse rounded-md bg-bg-overlay align-middle" />}
            </h1>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4 text-center sm:mb-5">
      <h1 className={titleCls}>{step === 1 ? 'Create An Offer' : `Sell ${category?.name ?? 'Items'}`}</h1>
    </div>
  )
}
