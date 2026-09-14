/**
 * Static game icon registry for the homepage.
 *
 * Mirrors the slug -> /games/[file].png mapping used by the navbar
 * (see supabase/migrations/update-game-logos.sql). Icons live permanently
 * in /public/games/ — no re-upload needed at deploy time, just drop new
 * files in that folder and add an entry here.
 *
 * TODO(supabase): once `games.image_url` is populated for every game,
 * replace this registry with the DB value (see src/lib/utils/games.ts).
 * Until then this keeps homepage icons in sync with the navbar.
 */
export const GAME_ICONS: Record<string, string> = {
  roblox: '/games/roblox.png',
  fortnite: '/games/fortnite.png',
  valorant: '/games/valorant.png',
  'league-of-legends': '/games/lol.png',
  cs2: '/games/cs2.png',
  'genshin-impact': '/games/genshin.png',
  'call-of-duty': '/games/cod.png',
  'gta-v': '/games/gta-v.png',
  'gta-vi': '/games/gtavi.png',
  minecraft: '/games/minecraft.png',
  'apex-legends': '/games/apexlegends.png',
  pubg: '/games/pubg.png',
  'free-fire': '/games/freefire.png',
  'escape-from-tarkov': '/games/escapefromtarkov.png',
  'rainbow-six-siege': '/games/r6.png',
  'r6-siege': '/games/r6.png',
  'steal-a-brainrot': '/games/sab.png',
  'grow-a-garden': '/games/gag.png',
  'grow-a-garden-2': '/games/gag.png',
  fc25: '/games/fc25.png',
  // FC 26 reuses the FC icon until its own is supplied.
  fc26: '/games/fc25.png',
}

const FALLBACK_ICON = '/placeholder/game-fallback.svg'

/**
 * Resolve a game's icon path by slug. Falls back to a neutral placeholder
 * if no real icon has been uploaded yet for that game.
 */
export function getGameIcon(slug: string): string {
  return GAME_ICONS[slug] ?? FALLBACK_ICON
}

/**
 * Per-game accent used for the soft glow along the bottom edge of a listing
 * card — the only colour on an otherwise neutral card.
 *
 * A code-side map rather than a `games` column: these are brand colours that
 * change roughly never, they're easier to tune when you can see all of them
 * at once, and adding one needs no migration.
 */
const GAME_GLOW: Record<string, string> = {
  roblox: '#E8342A',
  'adopt-me': '#F5B8D0',
  'steal-a-brainrot': '#8B5CF6',
  'blade-ball': '#22D3EE',
  'grow-a-garden-2': '#4ADE80',
  fortnite: '#8B5CF6',
  valorant: '#FF4655',
  cs2: '#F0A500',
  'apex-legends': '#DA292A',
  'r6-siege': '#5B9BD5',
  'gta-vi': '#E85D9E',
  fc26: '#00D46A',
}

/**
 * Neutral fallback so a game with no mapped colour still gets a soft edge.
 * A warm grey on purpose: white reads as a blown highlight, and a cool grey
 * picks up the page's blue cast and looks pink-grey against it.
 */
const FALLBACK_GLOW = '#7A736B'

/** Resolve a game's glow colour by slug. */
export function getGameGlow(slug: string): string {
  return GAME_GLOW[slug] ?? FALLBACK_GLOW
}
