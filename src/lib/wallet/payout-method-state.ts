/**
 * What a seller actually sees for a withdrawal_methods row — the state
 * /admin/fees labels each method with.
 *
 * Visibility is decided by RLS ("Anyone can view active withdrawal methods":
 * is_active = true), not by the withdraw page's `is_active OR coming_soon`
 * filter: an inactive row never reaches a seller, whatever coming_soon says.
 * coming_soon only greys out a row the seller can already see, and
 * withdrawal_quote refuses it.
 */
export type PayoutMethodState = 'live' | 'coming soon' | 'hidden'

export function payoutMethodState(m: { is_active: boolean; coming_soon: boolean }): PayoutMethodState {
  if (!m.is_active) return 'hidden'
  return m.coming_soon ? 'coming soon' : 'live'
}
