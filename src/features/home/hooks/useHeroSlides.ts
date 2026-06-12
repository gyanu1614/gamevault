import { useQuery } from '@tanstack/react-query'

export interface HeroSlide {
  id: string
  badge?: string
  badgeTone?: 'error' | 'success' | 'info'
  eyebrow: string
  title: string
  fromPrice: number
  comparePrice?: number
  ctaLabel: string
  ctaHref: string
  imageSrc: string
  imageAlt: string
}

/**
 * Hero carousel slides.
 *
 * Images live permanently in /public/hero/ — drop files in with these exact
 * names and they'll show up immediately, no rebuild/reupload step needed.
 * Recommended size: 1120x400 (ship @2x = 2240x800) per asset-inventory.md.
 * Keep the focal point on the right/upper area — a dark gradient overlay
 * (from-bg-base/92) covers the bottom-left ~40% where the text sits.
 *
 *   /public/hero/valorant.jpg
 *   /public/hero/fortnite.jpg
 *   /public/hero/roblox.jpg
 *
 * To change which games are featured, swap the image filenames below (or add
 * new slide objects) — everything else (rotation, copy, CTA) is just data.
 */
const MOCK_HERO_SLIDES: HeroSlide[] = [
  {
    id: 'valorant',
    badge: '−24% this week',
    badgeTone: 'error',
    eyebrow: 'VALORANT · ACCOUNTS',
    title: 'Radiant-ranked accounts',
    fromPrice: 189,
    comparePrice: 249,
    ctaLabel: 'Shop Valorant',
    ctaHref: '/game/valorant/accounts',
    imageSrc: '/hero/valorant.jpg',
    imageAlt: 'Valorant accounts promotion',
  },
  {
    id: 'fortnite',
    badge: 'OG skins back in stock',
    badgeTone: 'success',
    eyebrow: 'FORTNITE · ITEMS',
    title: 'OG skin bundles',
    fromPrice: 49,
    comparePrice: 79,
    ctaLabel: 'Shop Fortnite',
    ctaHref: '/game/fortnite/items',
    imageSrc: '/hero/fortnite.jpg',
    imageAlt: 'Fortnite OG skins promotion',
  },
  {
    id: 'roblox',
    badge: 'Best rate today',
    badgeTone: 'info',
    eyebrow: 'ROBLOX · CURRENCY',
    title: 'Robux at the best rate',
    fromPrice: 4.5,
    ctaLabel: 'Shop Roblox',
    ctaHref: '/currency/robux',
    imageSrc: '/hero/roblox.jpg',
    imageAlt: 'Roblox Robux promotion',
  },
]

export function useHeroSlides() {
  // TODO(supabase): replace mock with real query
  // select * from hero_slides where is_active = true order by sort_order limit 3
  // imageSrc would then come from Supabase Storage (public bucket) instead of /public/hero/
  return useQuery({
    queryKey: ['hero-slides'],
    queryFn: async (): Promise<HeroSlide[]> => MOCK_HERO_SLIDES,
    staleTime: 5 * 60 * 1000,
  })
}
