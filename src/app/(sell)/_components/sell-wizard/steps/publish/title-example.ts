/**
 * The example at the end of the Title tip (owner, 2026-10-12): a real item
 * for the games we know, the "Item Name - Game" pattern for the rest, so the
 * example never names another game's item.
 */
const EXAMPLE_ITEM: Record<string, string> = {
  'adopt-me': 'Bat Dragon',
  'murder-mystery-2': 'Chroma Luger',
  'steal-a-brainrot': 'Garama and Madundung',
}

export function titleExample(gameSlug: string | undefined, gameName: string | undefined): string {
  const item = (gameSlug && EXAMPLE_ITEM[gameSlug]) || 'Item Name'
  return `${item} - ${gameName || 'Game Name'}`
}
