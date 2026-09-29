/**
 * Phone inbox row: what the order is for.
 *
 *  - Currency  → "Order For Robux" / "Order For V-Bucks" (the game's own
 *                currency name).
 *  - Items     → "Order For Items".
 *  - Accounts  → "Order For Accounts".
 *  - Anything else (top-ups, services, gift cards) → "Order For <category>".
 */

export function inboxOrderLabel(opts: {
  /** game_categories.type: currency | items | account | top_up | service | gift_card */
  categoryType: string | null | undefined
  categoryName: string | null | undefined
  /** Currency config unit_label ("Robux", "Credits"). */
  currencyName?: string | null
}): string | null {
  const type = opts.categoryType ?? null
  if (type === 'currency') {
    const name = opts.currencyName?.trim() || opts.categoryName?.trim()
    return name ? `Order For ${name}` : 'Order For Currency'
  }
  if (type === 'items') return 'Order For Items'
  if (type === 'account') return 'Order For Accounts'
  const name = opts.categoryName?.trim()
  return name ? `Order For ${name}` : null
}
