/**
 * V51 — Curated Region / Platform / Device presets.
 *
 * One catalog shared by BOTH sides:
 *  - Admin (PlatformFieldsSection): one-click "quick add" chips that
 *    fill an option's value + icon_url from the static asset set, so
 *    admins stop hand-uploading the same PlayStation logo per game.
 *  - Buyer (bundle currency page): legacy region options stored as
 *    plain strings (no icon_url) resolve a flag via `getRegionIcon`,
 *    so existing configs (Valorant EU/NA/…) get flags for free.
 *
 * Assets live in `public/regions/*.png` (flag art, square 256 canvas)
 * and `public/platforms/*.png` (logo art, normalized + white-inverted
 * where the source mark was dark). Adding a preset = drop a PNG there
 * and add a row here.
 */

export interface PresetOption {
  value: string
  icon_url: string
}

/* ── Regions ──────────────────────────────────────────────────────
   Ordered roughly by how often marketplaces need them: the big three
   first (Global / EU / NA), then country-level rows used by top-ups. */
export const REGION_PRESETS: PresetOption[] = [
  { value: 'Global',      icon_url: '/regions/global.png' },
  { value: 'EU',          icon_url: '/regions/eu.png' },
  { value: 'NA',          icon_url: '/regions/na.png' },
  { value: 'US',          icon_url: '/regions/us.png' },
  { value: 'UK',          icon_url: '/regions/uk.png' },
  { value: 'Canada',      icon_url: '/regions/canada.png' },
  { value: 'Brazil',      icon_url: '/regions/brazil.png' },
  { value: 'Turkey',      icon_url: '/regions/turkey.png' },
  { value: 'India',       icon_url: '/regions/india.png' },
  { value: 'Malaysia',    icon_url: '/regions/malaysia.png' },
  { value: 'Singapore',   icon_url: '/regions/singapore.png' },
  { value: 'Indonesia',   icon_url: '/regions/indonesia.png' },
  { value: 'Philippines', icon_url: '/regions/philippines.png' },
  { value: 'Thailand',    icon_url: '/regions/thailand.png' },
  { value: 'Vietnam',     icon_url: '/regions/vietnam.png' },
  { value: 'Japan',       icon_url: '/regions/japan.png' },
  { value: 'South Korea', icon_url: '/regions/south-korea.png' },
  { value: 'Asia',        icon_url: '/regions/asia.png' },
  { value: 'Oceania',     icon_url: '/regions/oceania.png' },
  { value: 'MENA',        icon_url: '/regions/mena.png' },
  { value: 'CIS',         icon_url: '/regions/cis.png' },
]

/* ── Platforms ────────────────────────────────────────────────────
   Launchers/storefronts + consoles that carry game currencies. */
export const PLATFORM_PRESETS: PresetOption[] = [
  { value: 'PC',          icon_url: '/platforms/pc.png' },
  { value: 'Epic Games',  icon_url: '/platforms/epic-games.png' },
  { value: 'Steam',       icon_url: '/platforms/steam.png' },
  { value: 'PlayStation', icon_url: '/platforms/playstation.png' },
  { value: 'Xbox',        icon_url: '/platforms/xbox.png' },
  { value: 'Nintendo',    icon_url: '/platforms/nintendo.png' },
  { value: 'Battle.net',  icon_url: '/platforms/battle-net.png' },
  { value: 'Activision',  icon_url: '/platforms/activision.png' },
  { value: 'EA',          icon_url: '/platforms/ea.png' },
  { value: 'Ubisoft',     icon_url: '/platforms/ubisoft.png' },
  { value: 'Mobile',      icon_url: '/platforms/mobile.png' },
  { value: 'iOS',         icon_url: '/platforms/ios.png' },
  { value: 'Android',     icon_url: '/platforms/android.png' },
]

/* ── Devices ──────────────────────────────────────────────────────
   Smaller set; reuses platform art. */
export const DEVICE_PRESETS: PresetOption[] = [
  { value: 'iOS',     icon_url: '/platforms/ios.png' },
  { value: 'Android', icon_url: '/platforms/android.png' },
  { value: 'PC',      icon_url: '/platforms/pc.png' },
]

/* ── Legacy-name → flag resolution ────────────────────────────────
   Region options saved before presets existed are plain strings.
   Alias table lets common spellings land on the right flag. */
const REGION_ALIASES: Record<string, string> = {
  'global': '/regions/global.png',
  'worldwide': '/regions/global.png',
  'world': '/regions/global.png',
  'international': '/regions/global.png',
  'eu': '/regions/eu.png',
  'europe': '/regions/eu.png',
  'na': '/regions/na.png',
  'north america': '/regions/na.png',
  'us': '/regions/us.png',
  'usa': '/regions/us.png',
  'united states': '/regions/us.png',
  'uk': '/regions/uk.png',
  'united kingdom': '/regions/uk.png',
  'canada': '/regions/canada.png',
  'brazil': '/regions/brazil.png',
  'br': '/regions/brazil.png',
  'latam': '/regions/brazil.png',
  'turkey': '/regions/turkey.png',
  'tr': '/regions/turkey.png',
  'india': '/regions/india.png',
  'in': '/regions/india.png',
  'malaysia': '/regions/malaysia.png',
  'my': '/regions/malaysia.png',
  'singapore': '/regions/singapore.png',
  'sg': '/regions/singapore.png',
  'indonesia': '/regions/indonesia.png',
  'id': '/regions/indonesia.png',
  'philippines': '/regions/philippines.png',
  'ph': '/regions/philippines.png',
  'thailand': '/regions/thailand.png',
  'th': '/regions/thailand.png',
  'vietnam': '/regions/vietnam.png',
  'vn': '/regions/vietnam.png',
  'japan': '/regions/japan.png',
  'jp': '/regions/japan.png',
  'south korea': '/regions/south-korea.png',
  'korea': '/regions/south-korea.png',
  'kr': '/regions/south-korea.png',
  'asia': '/regions/asia.png',
  'sea': '/regions/asia.png',
  'oceania': '/regions/oceania.png',
  'oce': '/regions/oceania.png',
  'australia': '/regions/oceania.png',
  'mena': '/regions/mena.png',
  'middle east': '/regions/mena.png',
  'cis': '/regions/cis.png',
  'russia': '/regions/cis.png',
  'ru': '/regions/cis.png',
}

/** Flag icon for a region NAME (any casing / common aliases); null when unknown. */
export function getRegionIcon(name: string | null | undefined): string | null {
  if (!name) return null
  return REGION_ALIASES[name.trim().toLowerCase()] ?? null
}
