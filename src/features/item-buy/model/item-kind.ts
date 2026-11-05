/**
 * What a game's catalogue items are and how they change hands, for the pet
 * page's spec card and delivery card. Kept apart from about.ts so the client
 * picks up these few strings without the help-centre copy.
 */

const ITEM_NOUN: Record<string, { one: string; many: string }> = {
  'adopt-me': { one: 'pet', many: 'Pets' },
  'steal-a-brainrot': { one: 'brainrot', many: 'Brainrots' },
}

export function itemNoun(gameSlug: string): { one: string; many: string } {
  return ITEM_NOUN[gameSlug] ?? { one: 'item', many: 'Items' }
}

/** "Pet", "Brainrot", "Item": the spec card's Item Type. */
export function itemTypeLabel(gameSlug: string): string {
  const { one } = itemNoun(gameSlug)
  return one.charAt(0).toUpperCase() + one.slice(1)
}

/** Games whose items only move between players by an in-game trade. */
const TRADE_GAMES: ReadonlySet<string> = new Set(['adopt-me', 'murder-mystery-2'])

export function deliveryMethodLabel(gameSlug: string): string {
  return TRADE_GAMES.has(gameSlug) ? 'In-Game Trade' : 'In-Game Delivery'
}

/** The delivery card when the seller wrote nothing: how every order is handed over (the FAQ's answer). */
export function defaultDeliveryNote(gameSlug: string, gameName: string, kind?: 'egg' | 'potion'): string {
  return `After you pay, the seller messages you in the order chat and hands the ${kind ?? itemNoun(gameSlug).one} over to you in ${gameName}.`
}
