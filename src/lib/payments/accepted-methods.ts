/**
 * The one sentence buyer copy uses for "what can I pay with", built from
 * the checkout's own lists (the Payssion registry and the crypto card's
 * coins) so marketing can't promise a method checkout doesn't offer.
 * Client-safe: no DB, no fee numbers.
 */

import { CHECKOUT_COINS } from './method-marks'
import { PAYSSION_METHODS } from './providers/payssion/methods'

/** Well-known local rails named in buyer copy, best known first. */
export const NAMED_LOCAL_METHODS = ['pix_br', 'trustly', 'blik_pl', 'bancomatpay_it'] as const

const and = (items: readonly string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

/** "local payment methods such as Pix, …, and crypto (USDT and Bitcoin)." — reads after "You can pay with". */
export function acceptedMethodsPhrase(): string {
  const local = NAMED_LOCAL_METHODS.map((pm) => PAYSSION_METHODS[pm].label)
  const coins = CHECKOUT_COINS.map((c) => c.label)
  return `local payment methods such as ${and(local)}, ${PAYSSION_METHODS.applepay_sa.label} in some countries, and crypto (${and(coins)}).`
}
