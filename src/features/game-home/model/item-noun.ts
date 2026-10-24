/**
 * The word a game's items go by in section titles ("Top Selling Adopt Me
 * Pets", "Hot New Steal a Brainrot Brainrots"). A game not listed here reads
 * "Items"; adding a values game with its own word is one line.
 */
const ITEM_NOUNS: Readonly<Record<string, { plural: string; singular: string }>> = {
  'adopt-me': { plural: 'Pets', singular: 'Pet' },
  'steal-a-brainrot': { plural: 'Brainrots', singular: 'Brainrot' },
  'steal-an-egg': { plural: 'Pets', singular: 'Pet' },
}

const DEFAULT = { plural: 'Items', singular: 'Item' }

export function itemNoun(gameSlug: string): string {
  return (ITEM_NOUNS[gameSlug] ?? DEFAULT).plural
}

export function itemNounSingular(gameSlug: string): string {
  return (ITEM_NOUNS[gameSlug] ?? DEFAULT).singular
}
