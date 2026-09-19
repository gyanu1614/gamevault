export type CalculatorTab = 'cash' | 'trade'

export interface CalculatorDeepLink {
  tab: CalculatorTab
  brainrot?: string
  mutation?: string
}

/**
 * The calculator's URL contract, read on the CLIENT (Step 7a): `?tab=cash`
 * opens the cash tab, `?brainrot=`/`?mutation=` preselect a row. Reading these
 * through the page's `searchParams` had made the whole ISR route dynamic.
 *
 * `get` is `URLSearchParams.get`-shaped so the rule is testable without Next.
 */
export function parseCalculatorDeepLink(
  get: (key: string) => string | null,
): CalculatorDeepLink {
  const link: CalculatorDeepLink = { tab: get('tab') === 'cash' ? 'cash' : 'trade' }
  const brainrot = get('brainrot')
  const mutation = get('mutation')
  if (brainrot) link.brainrot = brainrot
  if (mutation) link.mutation = mutation
  return link
}
