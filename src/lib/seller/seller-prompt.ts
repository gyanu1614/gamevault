/**
 * The seller prompt (growth point 5, redesigned 2026-10-08): the one
 * site-wide ask to sell, written into the page instead of a bar above the
 * navbar. Three surfaces share this module and `useSellerPrompt()`:
 *
 *   · homepage hero eyebrow — one line above the headline;
 *   · listings page header card — beside the "{Game} {Category}" title;
 *   · listings empty state — "Be the first to list …" when a category has
 *     nothing in it yet.
 *
 * Plain module (no 'use server'): the copy, the listing cap and the hrefs.
 * Who sees which variant is decided client-side from `useAuth()`, so every
 * page that carries it stays static (Step 7a).
 */
import { foundingHref } from '@/lib/seo/founding-href'

/** Listings at which the seller variant stops showing — they are selling. */
export const SELLER_PROMPT_LISTING_CAP = 3

export type SellerPromptVariant = 'visitor' | 'seller'

export const SELLER_PROMPT_EVENT: Record<SellerPromptVariant, string> = {
  visitor: 'seller_cta_click',
  seller: 'seller_first_listing_cta_click',
}

export function sellerPromptHref(variant: SellerPromptVariant, source: string): string {
  return variant === 'seller' ? '/sell/new' : foundingHref(source)
}

/** Homepage eyebrow. */
export const HERO_EYEBROW = {
  visitor: {
    lead: 'Sell Items, Currency and Accounts',
    tail: '50% off selling fees for a limited time',
    cta: 'Start Selling',
  },
  seller: {
    lead: 'Your store is open',
    tail: 'Buyers are looking for your games right now',
    cta: 'Create your first listing',
  },
} as const

/** Listings page header card; `{game}` and `{category}` are filled in. */
export function listingsCardCopy(variant: SellerPromptVariant, gameName: string, categoryLabel: string) {
  const what = `${gameName} ${categoryLabel}`
  return variant === 'seller'
    ? { lead: 'Your store is open', tail: `List your ${what} and buyers here see them first.`, cta: 'Create a listing' }
    : { lead: `Got ${what} to sell?`, tail: '50% off selling fees for a limited time.', cta: 'Start Selling' }
}

/** Listings empty state: the category has no listings at all. */
export function listingsEmptyCopy(variant: SellerPromptVariant, gameName: string, categoryLabel: string) {
  const what = `${gameName} ${categoryLabel}`
  return {
    title: `Be the first to list ${what}`,
    body:
      variant === 'seller'
        ? 'Buyers searching this page will see your listing first.'
        : '50% off selling fees for a limited time. Buyers searching this page will see your listing first.',
    cta: variant === 'seller' ? 'Create a listing' : 'Start Selling',
  }
}
