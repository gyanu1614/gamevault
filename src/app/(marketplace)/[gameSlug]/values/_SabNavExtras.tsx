import { SwooshLink } from './_SwooshLink'

/**
 * Extra sub-nav tabs for the Steal a Brainrot section: Values + Calculator,
 * rendered after the marketplace category tabs (Accounts / Items) in the shared
 * `GameSubNav` pill. Text-only to match the category tabs (no icons). Each
 * enters the forest Values hub, so it plays the DropMarket brand-switch swoosh.
 *
 * Passed as `GameSubNav`'s `extraTabs` slot ONLY when the game is Steal a
 * Brainrot — every SAB marketplace surface (landing + category pages) then
 * surfaces the Values/Calculator tools alongside the categories.
 */
export function SabNavExtras() {
  const cls =
    'relative flex flex-shrink-0 items-center whitespace-nowrap rounded-md px-3 py-2.5 text-[13px] font-semibold text-text-secondary transition-colors hover:text-gray-100 sm:px-3.5 sm:py-2 sm:text-[13.5px]'
  return (
    <>
      <SwooshLink
        href="/steal-a-brainrot/values"
        to="values"
        ariaLabel="Steal a Brainrot Values"
        className={cls}
      >
        Values
      </SwooshLink>
      <SwooshLink
        href="/steal-a-brainrot/calculator"
        to="values"
        ariaLabel="Steal a Brainrot Calculator"
        className={cls}
      >
        Calculator
      </SwooshLink>
    </>
  )
}
