import { useQuery } from '@tanstack/react-query'

export interface HeroSlide {
  id: string
  /**
   * Optional editorial badge (e.g. "New season"). Left unset on all
   * current slides — must NEVER carry a fabricated live stat (a discount
   * %, a price, a "best rate" claim). Only set this to real, verifiable
   * copy.
   */
  badge?: string
  badgeTone?: 'error' | 'success' | 'info'
  eyebrow: string
  title: string
  ctaLabel: string
  ctaHref: string
  imageSrc: string
  imageAlt: string
}

/**
 * Hero carousel slides — CURATED EDITORIAL CONTENT, not live marketplace
 * data.
 *
 * These are hand-authored marketing placements (which games we feature,
 * the headline copy, the CTA). They are intentionally hardcoded, the same
 * way a homepage banner is curated by marketing — NOT leftover mock data.
 *
 * IMPORTANT: no live stats live here. Earlier revisions carried fabricated
 * price/discount fields (fromPrice / comparePrice / "−24% this week"
 * badges) that were never sourced from real listings. Those have been
 * removed — a hero slide must never assert a price or discount that isn't
 * backed by real data. If we later want a live "from $X" on a slide, it
 * has to come from the same aggregation the Shop-by-category tabs use.
 *
 * Images live permanently in /public/hero/ — drop files in with these exact
 * names and they'll show up immediately, no rebuild/reupload step needed.
 * Recommended size: 1120x400 (ship @2x = 2240x800) per asset-inventory.md.
 * Keep the focal point on the right/upper area — a dark gradient overlay
 * (from-bg-base/92) covers the bottom-left ~40% where the text sits.
 *
 * To change which games are featured, swap the image filenames below (or
 * add new slide objects) — everything is just curated data.
 */
const CURATED_HERO_SLIDES: HeroSlide[] = [
  {
    id: 'valorant',
    eyebrow: 'VALORANT · ACCOUNTS',
    title: 'Radiant-ranked accounts',
    ctaLabel: 'Shop Valorant',
    ctaHref: '/game/valorant/accounts',
    imageSrc: '/hero/valorant.jpg',
    imageAlt: 'Valorant accounts promotion',
  },
  {
    id: 'fortnite',
    eyebrow: 'FORTNITE · ITEMS',
    title: 'OG skin bundles',
    ctaLabel: 'Shop Fortnite',
    ctaHref: '/game/fortnite/items',
    imageSrc: '/hero/fortnite.jpg',
    imageAlt: 'Fortnite OG skins promotion',
  },
  {
    id: 'roblox',
    eyebrow: 'ROBLOX · CURRENCY',
    title: 'Robux at the best rate',
    ctaLabel: 'Shop Roblox',
    ctaHref: '/currency/robux',
    imageSrc: '/hero/roblox.jpg',
    imageAlt: 'Roblox Robux promotion',
  },
]

export function useHeroSlides() {
  // Curated editorial slides — served through react-query for a uniform
  // hook API with the rest of the homepage. initialData seeds the cache
  // synchronously so the carousel is populated on first paint (no
  // headline-then-carousel pop-in). This is intentional curated content,
  // so there is no async fetch to migrate to.
  return useQuery({
    queryKey: ['hero-slides'],
    queryFn: async (): Promise<HeroSlide[]> => CURATED_HERO_SLIDES,
    initialData: CURATED_HERO_SLIDES,
    staleTime: 5 * 60 * 1000,
  })
}
