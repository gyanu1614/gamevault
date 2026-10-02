/**
 * Quantity entry for the phone purchase sheet: quick-pick amounts and the
 * in-sheet keypad's editing rules. Pure, so the sheet stays a thin view.
 *
 * The phone sheet never opens the OS keyboard: on iOS Safari a focused input
 * in a bottom sheet makes Safari pan the page while the sheet is lifted over
 * the keyboard, and the sheet ends up off screen. The keypad sidesteps that.
 */

export const MAX_QTY_DIGITS = 9

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | 'back'

/** Smallest 1 / 2 / 5 × 10^k that is ≥ n. */
function roundUpNice(n: number): number {
  let magnitude = 1
  while (magnitude * 10 <= n) magnitude *= 10
  for (const m of [1, 2, 5, 10]) {
    if (m * magnitude >= n) return m * magnitude
  }
  return 10 * magnitude
}

/**
 * Quick-pick amounts: the minimum, then up to three round steps above it
 * (about ×5, ×10, ×50). Steps that reach the stock are dropped; the sheet
 * adds its own Max chip for the whole stock.
 */
export function quickAmounts(minQty: number, stock: number): number[] {
  const min = Math.max(1, Math.floor(minQty))
  const out = [min]
  for (const multiple of [5, 10, 50]) {
    const step = roundUpNice(min * multiple)
    if (step < stock && !out.includes(step)) out.push(step)
  }
  return out
}

/**
 * The amount being typed after one key press. `draft` is null while the sheet
 * still shows the committed quantity (`current`): a digit then starts a new
 * amount, while 00 and backspace edit the shown one (25 → 00 → 2500). An empty
 * string means "nothing typed" (zero). Leading zeros are dropped and the
 * amount stops at MAX_QTY_DIGITS digits.
 */
export function typeKey(draft: string | null, current: number, key: KeypadKey): string {
  if (key === 'back') return (draft ?? String(current)).slice(0, -1)

  const base = key === '00' ? (draft ?? String(current)) : (draft ?? '')
  const next = (base + key).replace(/^0+/, '')
  return next.length > MAX_QTY_DIGITS ? base : next
}
