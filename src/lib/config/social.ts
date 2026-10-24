/**
 * Public social links — the single source for DropMarket's community URLs.
 * Safe to import from client and server components (no dependencies).
 *
 * Used by the site footers, the Organization JSON-LD `sameAs`, the founding
 * page and the welcome email. Never hard-code a Discord invite elsewhere: the
 * old vanity URL and the earlier z5gh… invite are dead.
 */

/** Invite to the DropMarket Discord community. */
export const DISCORD_INVITE_URL = 'https://discord.gg/mrdYygvkWU'

/**
 * DropMarket's own profiles (owner, 2026-10-23). The Organization JSON-LD
 * `sameAs` and both site footers read this list, so Google sees the same set
 * of profiles the visitor sees. Add a profile only once we own AND use it —
 * never a handle someone else holds (crawl audit 2026-10-23: a GitHub account
 * of another "DropMarket" sat here). YouTube is linked by channel id: it stays
 * valid when the handle changes.
 */
export const BRAND_PROFILES = [
  { key: 'x', name: 'X', url: 'https://x.com/DropMarketGG' },
  { key: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/channel/UC6LfJK7uWhLosH61K14KdVw' },
  { key: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com/@dropmarket.gg' },
  { key: 'reddit', name: 'Reddit', url: 'https://www.reddit.com/user/dropmarketgg' },
  { key: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/company/dropmarketgg' },
] as const

export type BrandProfileKey = (typeof BRAND_PROFILES)[number]['key']
