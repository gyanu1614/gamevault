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
  minecraft: '/games/minecraft.png',
  'apex-legends': '/games/apexlegends.png',
  pubg: '/games/pubg.png',
  'free-fire': '/games/freefire.png',
  'escape-from-tarkov': '/games/escapefromtarkov.png',
  'rainbow-six-siege': '/games/r6.png',
  fc25: '/games/fc25.png',
}

const FALLBACK_ICON = '/placeholder/game-fallback.svg'

/**
 * Resolve a game's icon path by slug. Falls back to a neutral placeholder
 * if no real icon has been uploaded yet for that game.
 */
export function getGameIcon(slug: string): string {
  return GAME_ICONS[slug] ?? FALLBACK_ICON
}
