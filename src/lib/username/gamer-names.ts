/**
 * Gamer-tag generator — the fallback identity for signups that skip the
 * optional Display Username field (the pattern marketplaces like Eldorado
 * use: assign a readable random handle instead of blocking signup).
 *
 * Format: [Adjective][Noun][2-digit number] → "SilentRaptor42". Stays within
 * the profile username rules (letters/numbers only here, 3-30 chars) and
 * reads like a handle a player would actually pick, not a hash.
 *
 * Plain shared module — client-safe (the signup form previews candidates)
 * AND imported by the server action that checks uniqueness against profiles.
 */

const ADJECTIVES = [
  'Silent', 'Rogue', 'Frost', 'Shadow', 'Turbo', 'Neon', 'Crimson', 'Lucky',
  'Savage', 'Mystic', 'Blaze', 'Phantom', 'Iron', 'Nova', 'Hyper', 'Stealth',
  'Cosmic', 'Rapid', 'Grim', 'Golden', 'Storm', 'Wild', 'Zero', 'Prime',
  'Dark', 'Swift', 'Feral', 'Arcane', 'Static', 'Vivid', 'Rebel', 'Solar',
  'Lunar', 'Onyx', 'Ember', 'Ghost', 'Venom', 'Alpha', 'Retro', 'Pixel',
  'Cyber', 'Astro', 'Mega', 'Ultra', 'Epic', 'Elite', 'Royal', 'Toxic',
  'Chill', 'Sneaky', 'Rusty', 'Slick', 'Snappy', 'Bold', 'Brisk', 'Clever',
] as const

const NOUNS = [
  'Raptor', 'Viper', 'Reaper', 'Ronin', 'Sentinel', 'Falcon', 'Wolf',
  'Phoenix', 'Titan', 'Specter', 'Drifter', 'Hunter', 'Knight', 'Samurai',
  'Wizard', 'Ninja', 'Pilot', 'Ranger', 'Sniper', 'Golem', 'Dragon',
  'Kraken', 'Cobra', 'Panther', 'Jaguar', 'Hawk', 'Raven', 'Lynx',
  'Mamba', 'Bandit', 'Pirate', 'Voyager', 'Nomad', 'Gladiator', 'Warden',
  'Shogun', 'Vandal', 'Rocket', 'Comet', 'Meteor', 'Blade', 'Arrow',
  'Bullet', 'Cipher', 'Vector', 'Glitch', 'Combo', 'Streak', 'Clutch',
  'Loot', 'Quest', 'Spawn', 'Frag', 'Dash', 'Boss', 'Ace',
] as const

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]

/** One random gamer tag, e.g. "FrostKraken07". */
export function generateGamerTag(): string {
  const n = Math.floor(Math.random() * 100)
  return `${pick(ADJECTIVES)}${pick(NOUNS)}${String(n).padStart(2, '0')}`
}

/**
 * A batch of distinct candidates — the server walks these against the
 * profiles table and keeps the first free one. Falls back to a 4-digit
 * suffix so the final candidate is near-guaranteed unique.
 */
export function generateGamerTagCandidates(count = 10): string[] {
  const out = new Set<string>()
  while (out.size < count - 1) out.add(generateGamerTag())
  out.add(`${pick(ADJECTIVES)}${pick(NOUNS)}${Math.floor(1000 + Math.random() * 9000)}`)
  return [...out]
}
