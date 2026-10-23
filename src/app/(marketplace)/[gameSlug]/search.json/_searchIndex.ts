import 'server-only'
import { getGameContentTheme, hasHubPage } from '@/lib/content/theme'
import { getGamePosts } from '@/lib/blog/db'
import { getValueItems } from '@/lib/values/data'
import { valueListHub } from '@/lib/values/hub-config'
import { rarityMeta } from '@/lib/values/rarity'
import { VALUES_PIPELINE_GAMES } from '@/lib/value-listings/catalogs'
import type { GameSearchIndex, SearchItem } from '@/lib/search/game-search'
import { getAdoptMePets } from '../values/_adoptMeData'
import { getSabBrainrots } from '../values/_sabBrainrots'
import { asNumber } from '../values/_sabListModel'
import { getValueListRows } from '../values/_generic/valueListRows'
import { valueListKind } from '../values/_listRows'

/**
 * One game's search index for the hub navbar: its items (name, page,
 * picture, market price, what it is) and its guides. Built from the SAME
 * cached, tagged reads as the value list and the blog hub, so a price publish
 * refreshes it with them. Items are ordered most popular / most valuable first
 * (search ties keep this order).
 */
type Ranked = SearchItem & { rank: number | null }

/** Most popular first (rank 1 = top), then most valuable; the rank is not shipped. */
function ordered(rows: Ranked[]): SearchItem[] {
  return rows
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (b.p ?? -1) - (a.p ?? -1))
    .map(({ rank: _rank, ...item }) => item)
}

async function searchItems(gameSlug: string): Promise<SearchItem[]> {
  const label = (rarity: string | null | undefined, noun: string) => [rarityMeta(gameSlug, rarity).label, noun].filter(Boolean).join(' ')
  switch (valueListKind(gameSlug)) {
    case 'steal-a-brainrot':
      return ordered(
        (await getSabBrainrots()).map((b) => ({
          n: b.name,
          h: `/steal-a-brainrot/values/${b.slug}`,
          i: b.image_url,
          p: asNumber(b.average_usd) ?? asNumber(b.display_price_usd),
          k: label(b.rarity, 'Brainrot'),
          rank: b.popularity_rank ?? null,
        })),
      )
    case 'adopt-me':
      return ordered(
        (await getAdoptMePets()).map((p) => ({
          n: p.name,
          h: `/adopt-me/values/${p.slug}`,
          i: p.imageUrl,
          p: p.values.FR?.cashUsd ?? p.values.N?.cashUsd ?? null,
          k: label(p.rarity, 'Pet'),
          rank: p.demandRank,
        })),
      )
    case 'generic': {
      const types = valueListHub(gameSlug)?.itemTypeLabels ?? {}
      const { rows } = await getValueListRows(gameSlug)
      return ordered(
        rows.map((r) => ({
          n: r.name,
          h: r.href ?? `/${gameSlug}/values/${r.slug}`,
          i: r.imageUrl,
          p: r.marketUsd ?? r.cheapestUsd,
          k: label(r.rarity, r.itemType ? (types[r.itemType] ?? '') : ''),
          rank: null,
        })),
      )
    }
    default: {
      if (!VALUES_PIPELINE_GAMES.has(gameSlug)) return []
      return ordered(
        (await getValueItems(gameSlug)).map((i) => ({
          n: i.name,
          h: `/${gameSlug}/values/${i.slug}`,
          i: i.imageUrl,
          p: i.price?.averageUsd ?? i.price?.cheapestUsd ?? null,
          k: label(i.rarity, i.kind === 'pet' ? 'Pet' : i.kind === 'egg' ? 'Egg' : ''),
          rank: null,
        })),
      )
    }
  }
}

export async function loadSearchIndex(gameSlug: string): Promise<GameSearchIndex | null> {
  const values = hasHubPage(gameSlug, 'values')
  const blog = hasHubPage(gameSlug, 'blog')
  if (!values && !blog) return null
  const [items, posts] = await Promise.all([values ? searchItems(gameSlug) : Promise.resolve([]), blog ? getGamePosts(gameSlug) : Promise.resolve([])])
  return {
    game: gameSlug,
    name: getGameContentTheme(gameSlug).name,
    items,
    guides: posts.map((p) => ({ t: p.title, h: `/${gameSlug}/blog/${p.slug}` })),
  }
}
