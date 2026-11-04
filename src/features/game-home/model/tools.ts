import { getGameContentTheme, hasGameContentTheme, type HubPageSet } from '@/lib/content/theme'

export interface ToolTile {
  key: string
  href: string
  /** Small coloured label: the tool's name ("Trade Calculator"). */
  tag: string
  /** The question the tool answers, as the tile's title. */
  question: string
  cta: string
  /** House silver-set icon (SilverIcon). */
  icon: string
  /** Tag colour. */
  accent: string
  /** The one big tile (the trade calculator when the game has one, else the first tool). */
  featured: boolean
}

interface ToolDef {
  key: string
  /** A HubPageSet page flag, or the games a route outside the set serves. */
  page?: keyof HubPageSet
  games?: readonly string[]
  path: string
  tag: (game: string, items: string) => string
  question: (game: string, items: string) => string
  cta: string
  icon: string
  accent: string
}

/**
 * Every free tool a game page can show, in display order. A game's tiles are
 * the entries whose page its theme publishes (lib/content/theme HubPageSet),
 * so adding a calculator to a game's theme makes its tile appear here with no
 * other change. The Neon calculator is Adopt Me's own route (neon-calculator).
 */
const TOOL_DEFS: readonly ToolDef[] = [
  { key: 'calculator', page: 'calculator', path: 'calculator', tag: () => 'Trade Calculator', question: () => 'Is Your Trade Fair?', cta: 'Check a Trade', icon: '/icons/set/analytics.svg', accent: '#7DB4FF' },
  { key: 'values', page: 'values', path: 'values', tag: () => 'Value List', question: (_g, items) => `What Are My ${items} Worth?`, cta: 'Check Values', icon: '/icons/set/tag.svg', accent: '#B6E36A' },
  { key: 'neon', games: ['adopt-me'], path: 'neon-calculator', tag: () => 'Neon Calculator', question: () => 'Build a Neon or Buy It?', cta: 'Work It Out', icon: '/icons/set/crown.svg', accent: '#C18CFF' },
  { key: 'inventory', page: 'inventory', path: 'inventory', tag: () => 'Inventory Calculator', question: () => 'What Is My Inventory Worth?', cta: 'Add Your Items', icon: '/icons/set/package.svg', accent: '#4ADE80' },
  { key: 'chromas', page: 'chromas', path: 'chromas', tag: () => 'Chromas', question: () => 'Is a Chroma Worth It?', cta: 'See Chromas', icon: '/icons/set/star.svg', accent: '#F5C451' },
  { key: 'boxes', page: 'boxes', path: 'boxes', tag: () => 'Box Odds', question: () => 'Which Box Pays Off?', cta: 'See the Odds', icon: '/icons/set/gift.svg', accent: '#F49AC2' },
  { key: 'events', page: 'events', path: 'events', tag: () => 'Events', question: () => 'What Did Each Event Add?', cta: 'See Events', icon: '/icons/set/clock.svg', accent: '#7DB4FF' },
  { key: 'freeItems', page: 'freeItems', path: 'free-items', tag: (_g, items) => `Free ${items}`, question: () => 'Can You Get It for Free?', cta: 'See How', icon: '/icons/set/discount.svg', accent: '#4ADE80' },
  { key: 'codes', page: 'codes', path: 'codes', tag: (game) => `${game} Codes`, question: () => 'Any Working Codes Today?', cta: 'See Codes', icon: '/icons/set/key.svg', accent: '#F5C451' },
  { key: 'priceIndex', page: 'priceIndex', path: 'price-index', tag: () => 'Price Index', question: () => 'Is the Market Up or Down?', cta: 'See the Index', icon: '/icons/set/stock.svg', accent: '#C18CFF' },
]

export function gameTools(gameSlug: string, gameName: string, itemNoun: string): ToolTile[] {
  if (!hasGameContentTheme(gameSlug)) return []
  const { pages } = getGameContentTheme(gameSlug)
  const tiles = TOOL_DEFS.filter((d) => (d.page ? pages[d.page] === true : d.games?.includes(gameSlug) === true)).map((d) => ({
    key: d.key,
    href: `/${gameSlug}/${d.path}`,
    tag: d.tag(gameName, itemNoun),
    question: d.question(gameName, itemNoun),
    cta: d.cta,
    icon: d.icon,
    accent: d.accent,
    featured: false,
  }))
  if (tiles.length > 0) tiles[0].featured = true
  return tiles
}
