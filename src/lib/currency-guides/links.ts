import type { CurrencyGuide } from './schema'

export interface GuideLink {
  href: string
  label: string
  imageUrl?: string | null
}

export interface GuideLinks {
  /** This game's other pages: the hub, enabled categories, value tools. */
  game: GuideLink[]
  /** Currency pages of related games. */
  related: GuideLink[]
}

interface DirGame {
  id: string
  slug: string
  name: string
  image_url: string | null
  sort_order: number | null
}
interface DirCategory {
  game_id: string
  slug: string
  name: string | null
  type: string | null
}

const RELATED_MAX = 4

/** "Fortnite" + "V-Bucks" → "Fortnite V-Bucks"; "Blade Ball Tokens" and "COD Points" stand alone. */
export function currencyLinkLabel(gameName: string, currency: string): string {
  if (currency.toLowerCase().includes(gameName.toLowerCase())) return currency
  if (/^[A-Z0-9]{2,}\b|\$/.test(currency)) return currency
  return `${gameName} ${currency}`
}

/**
 * "More <Game> on DropMarket": the game's hub, its other enabled categories
 * and value tools, then 3–4 related games' currency pages (games with a guide
 * first, same family first: Roblox experiences link to each other).
 */
export function buildGuideLinks(input: {
  gameSlug: string
  gameName: string
  family: 'roblox' | 'other'
  directory: { games: DirGame[]; categories: DirCategory[] }
  hasValues: boolean
  hasCalculator: boolean
  guideFor: (slug: string) => CurrencyGuide | null
  familyOf: (g: CurrencyGuide) => 'roblox' | 'other'
}): GuideLinks {
  const { gameSlug, gameName, directory } = input
  const self = directory.games.find((g) => g.slug === gameSlug)

  const game: GuideLink[] = [{ href: `/${gameSlug}`, label: `${gameName} Marketplace` }]
  if (self) {
    const seen = new Set<string>()
    for (const c of directory.categories) {
      if (c.game_id !== self.id || c.type === 'currency' || !c.slug || seen.has(c.slug)) continue
      seen.add(c.slug)
      const name = (c.name ?? '').trim()
      if (!name) continue
      const label = name.toLowerCase().startsWith(gameName.toLowerCase()) ? name : `${gameName} ${name}`
      game.push({ href: `/${gameSlug}/${c.slug}`, label })
    }
  }
  if (input.hasValues) game.push({ href: `/${gameSlug}/values`, label: `${gameName} Value List` })
  if (input.hasCalculator) game.push({ href: `/${gameSlug}/calculator`, label: `${gameName} Trade Calculator` })

  const currencyBySlug = new Map<string, DirCategory>()
  const idToGame = new Map(directory.games.map((g) => [g.id, g]))
  for (const c of directory.categories) {
    if (c.type !== 'currency') continue
    const g = idToGame.get(c.game_id)
    if (g && !currencyBySlug.has(g.slug)) currencyBySlug.set(g.slug, c)
  }

  const candidates = directory.games
    .filter((g) => g.slug !== gameSlug && currencyBySlug.has(g.slug))
    .map((g) => {
      const guide = input.guideFor(g.slug)
      const score = (guide ? 2 : 0) + (guide && input.familyOf(guide) === input.family ? 1 : 0)
      return { g, guide, score }
    })
    .sort((a, b) => b.score - a.score || (a.g.sort_order ?? 9999) - (b.g.sort_order ?? 9999) || a.g.name.localeCompare(b.g.name))
    .slice(0, RELATED_MAX)

  const related = candidates.map(({ g, guide }) => {
    const cat = currencyBySlug.get(g.slug)!
    const currency = guide?.currency ?? (cat.name ?? 'Currency')
    return { href: `/${g.slug}/${cat.slug}`, label: currencyLinkLabel(g.name, currency), imageUrl: g.image_url }
  })

  return { game, related }
}
