import { rarityMeta } from './rarity'

/**
 * Value LIST hubs: games on the generic values_* pipeline whose hub is one
 * filterable value list (Adopt Me's layout) rather than Steal an Egg's
 * sectioned eggs/accounts page. Murder Mystery 2 is the first; Blox Fruits is
 * meant to be a config entry here, not a new page.
 *
 * Plain module, safe for server and client: the routes, the sitemap and the
 * client list all read it, so the "which items have a page" rule cannot drift
 * between them.
 */

export interface ValueListTab {
  key: string
  label: string
  color: string
  /** Match on values_items.rarity … */
  rarity?: string
  /** … or on values_items.item_type. */
  itemType?: string
}

export interface ValueListHubConfig {
  /** Short game name for tight copy ("MM2"). */
  shortName: string
  /**
   * Rarities whose PRICED items get their own value page. Every other item is
   * a list row with no link: a page per $0.05 common is thin content and a
   * crawl sink (the plan's ~213 high-tier pages, not ~830).
   */
  pageRarities: readonly string[]
  /** Filter tiles after "All", in display order (a tile with no items hides). */
  tabs: readonly ValueListTab[]
  /** Placeholder of the list's search box. */
  searchPlaceholder: string
  /** values_items.item_type → label. */
  itemTypeLabels: Readonly<Record<string, string>>
  /** Where the catalogue art comes from (page-level CC-BY-SA credit). */
  imageSource: { label: string; license: string; href: string } | null
  /**
   * How fast the free currency is earned, for the How To Get "free way"
   * totals (rounds of play). Only set from a verified source.
   */
  earnRate: { unit: string; perRound: number; source: string } | null
}

const MM2_TAB_RARITIES = ['Godly', 'Ancient', 'Vintage', 'Chroma', 'Unique'] as const

const MM2: ValueListHubConfig = {
  shortName: 'MM2',
  pageRarities: ['Godly', 'Ancient', 'Vintage', 'Unique', 'Chroma'],
  tabs: [
    ...MM2_TAB_RARITIES.map((r) => ({
      key: r.toLowerCase(),
      label: r,
      color: rarityMeta('murder-mystery-2', r).color,
      rarity: r,
    })),
    { key: 'pets', label: 'Pets', color: '#D7A57A', itemType: 'pet' },
  ],
  searchPlaceholder: 'Search a knife, gun or pet…',
  itemTypeLabels: { knife: 'Knife', gun: 'Gun', pet: 'Pet', misc: 'Misc', set: 'Set' },
  imageSource: {
    label: 'Murder Mystery 2 Wiki (Fandom)',
    license: 'CC BY-SA 3.0',
    href: 'https://murder-mystery-2.fandom.com/',
  },
  // The coin bag caps at 40 Coins a round (50 with the Elite gamepass) —
  // MM2 wiki, Coins (checked 2026-10-05). Round length is not documented, so
  // totals are given in rounds, never hours.
  earnRate: { unit: 'Coins', perRound: 40, source: 'https://murder-mystery-2.fandom.com/wiki/Coins' },
}

const VALUE_LIST_HUBS: Record<string, ValueListHubConfig> = {
  'murder-mystery-2': MM2,
}

/** The list-hub config for a game, or null when its hub is not a value list. */
export function valueListHub(gameSlug: string): ValueListHubConfig | null {
  return VALUE_LIST_HUBS[gameSlug] ?? null
}

/** Every game whose values hub is a value list. */
export const VALUE_LIST_HUB_GAMES: readonly string[] = Object.keys(VALUE_LIST_HUBS)

/**
 * Does this item have a value page? THE rule for the item route's gate, its
 * prerender set, the sitemap and the list cards' links.
 *
 * List hubs: priced AND in a page rarity. Any other pipeline game (Steal an
 * Egg): every item has a page — its unpriced pets are first-class pages.
 */
export function valueItemHasPage(
  gameSlug: string,
  item: { rarity: string | null | undefined; priced: boolean },
): boolean {
  const hub = valueListHub(gameSlug)
  if (!hub) return true
  return item.priced && item.rarity != null && hub.pageRarities.includes(item.rarity)
}

/** Does an item belong in a list tab? `all` matches everything. */
export function matchesValueListTab(
  tab: Pick<ValueListTab, 'rarity' | 'itemType'> | null,
  item: { rarity: string | null; itemType: string | null },
): boolean {
  if (!tab) return true
  if (tab.rarity && item.rarity !== tab.rarity) return false
  if (tab.itemType && item.itemType !== tab.itemType) return false
  return true
}

/**
 * The CC-BY-SA credit stored per image ("Image: <source>, <license> — <url>")
 * split into display text and the file page link. Null when absent/unparsable.
 */
export function parseImageAttribution(
  raw: string | null | undefined,
): { text: string; href: string | null } | null {
  const s = raw?.trim()
  if (!s) return null
  const [text, url] = s.split(/\s+—\s+/)
  const href = url && /^https:\/\//.test(url) ? url : null
  return { text: text.replace(/^Image:\s*/, ''), href }
}
