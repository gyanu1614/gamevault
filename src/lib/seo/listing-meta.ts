/**
 * Search title + description for a listing page, built from seller text.
 *
 * Seller titles and descriptions are written for buyers on the page, not for
 * a results snippet: emoji, ALL-CAPS hype, "Check out my other offers :)",
 * the same shop blurb on every listing. The 2026-10-06 crawl found 31 listing
 * descriptions under 70 characters and two pairs of identical titles across
 * games ("Kitsune Fruit" in Blox Fruits and in Grow a Garden).
 *
 *   title       — the seller title, cleaned; the game is added when the title
 *                 is short enough to take it, so same-named items in two games
 *                 stop colliding. ≤ 47 chars (the root template adds
 *                 " | DropMarket").
 *   description — always opens with what it is, the game and the price; the
 *                 seller's own words follow only when they say something
 *                 (≥ 40 chars after cleaning). ≤ 155 chars.
 */

const TITLE_MAX = 47
const DESC_MAX = 155

/** Emoji, pictographs, variation selectors and zero-width joiners out; whitespace collapsed. */
export function cleanSellerText(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—|:*•·]+|[\s\-–—|:*•·]+$/g, '')
    .trim()
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const atWord = cut.slice(0, cut.lastIndexOf(' '))
  return `${(atWord.length > max * 0.6 ? atWord : cut).replace(/[\s,.;:–—-]+$/, '')}…`
}

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0 })

export function listingMeta(input: {
  title: string
  description: string | null
  price: number | string | null
  gameName: string
  categoryName: string
}): { title: string; description: string } {
  const name = cleanSellerText(input.title) || input.title.trim()
  const game = input.gameName.trim()

  const withGame = `${name} – ${game}`
  const title = !name.toLowerCase().includes(game.toLowerCase()) && withGame.length <= TITLE_MAX
    ? withGame
    : clip(name, TITLE_MAX)

  // "FR Frost Dragon | Adopt Me" → "FR Frost Dragon" for the sentence, so it
  // never reads "… | Adopt Me for Adopt Me"; a title naming the game anywhere
  // else keeps its words and drops the " for {game}".
  const escaped = game.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const bare = name.replace(new RegExp(`\\s*[|\\-–—:]\\s*${escaped}$`, 'i'), '').trim() || name
  const forGame = bare.toLowerCase().includes(game.toLowerCase()) ? '' : ` for ${game}`
  const price = Number(input.price)
  const lead = `Buy ${bare}${forGame}${Number.isFinite(price) && price > 0 ? ` for ${usd(price)}` : ''}.`
  const own = cleanSellerText(input.description)
  const tail = 'Covered by SafeDrop Protection.'
  const body = own.length >= 40 ? `${lead} ${own}` : `${lead} ${input.categoryName.trim()} from an ID-verified seller. ${tail}`

  return { title, description: clip(body, DESC_MAX) }
}
