/**
 * Game slug for a discovered universe. Same normalisation as the icon
 * matcher, then the seeder's identity rules (pattern + reserved routes).
 * A collision never blocks creation — it suffixes and flags for review.
 */
import { normalizeTitle } from '@/lib/games/icons'
import { validateGameIdentity } from '@/lib/games/validate-game'

export function slugFromTitle(title: string): string | null {
  const slug = normalizeTitle(title)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || null
}

export interface ResolvedSlug {
  slug: string
  collided: boolean
  collidedWith?: string
}

/** The category templates a trend-radar game is created with. */
export const RADAR_CATEGORY_SLUGS = ['items', 'accounts'] as const

function isFree(slug: string, existing: Set<string>): boolean {
  if (existing.has(slug)) return false
  return validateGameIdentity({
    name: slug,
    slug,
    ecosystem: 'roblox',
    content_tier: 'listed',
    categories: [...RADAR_CATEGORY_SLUGS],
  }).ok
}

export function resolveSlug(title: string, existing: Set<string>): ResolvedSlug | null {
  const base = slugFromTitle(title)
  if (!base) return null
  if (isFree(base, existing)) return { slug: base, collided: false }

  const suffixed = `${base}-roblox`
  if (isFree(suffixed, existing)) return { slug: suffixed, collided: true, collidedWith: base }
  for (let n = 2; n < 50; n += 1) {
    const s = `${suffixed}-${n}`
    if (isFree(s, existing)) return { slug: s, collided: true, collidedWith: base }
  }
  return null
}

/**
 * Display name for a discovered game: the Roblox title without the emoji,
 * bracketed update tags and trailing decoration, casing preserved.
 */
export function cleanTitle(title: string): string {
  const out = title
    .split(/\s+\|\s+/)[0] // "Game | tagline"
    .replace(/[[(【].*?[\])】]/g, ' ')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}️‍]/gu, ' ')
    .replace(/[|•·~*!]+$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-–—:|]+|[-–—:|]+$/g, '')
    .trim()
  return out || title.trim()
}
