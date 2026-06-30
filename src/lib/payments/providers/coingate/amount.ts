/**
 * Amount conversion at the CoinGate adapter boundary.
 *
 * The core uses integer minor units (Money); CoinGate's API uses decimal
 * strings ("49.99"). Convert ONLY here, at the edge — never do float math on
 * money. These delegate to money.ts's exact bigint<->decimal helpers.
 */

import type { Money } from '@/lib/money'
import { toDecimal, fromDecimal } from '@/lib/money'

/** Money (bigint minor units) -> CoinGate decimal string, e.g. 4999n EUR -> "49.99". */
export function minorToDecimal(m: Money): string {
  return toDecimal(m)
}

/** CoinGate decimal string -> Money. */
export function decimalToMinor(value: string, currency: string): Money {
  return fromDecimal(value, currency)
}
