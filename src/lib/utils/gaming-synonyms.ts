/**
 * Gaming Synonyms Utility
 * Maps common gaming terms to their synonyms for enhanced search
 */

type SynonymMap = Record<string, string[]>

/**
 * Gaming terminology synonyms
 * Each key is a canonical term, values are common synonyms
 */
export const GAMING_SYNONYMS: SynonymMap = {
  // Account related
  'account': ['acc', 'profile', 'character', 'char'],
  'accounts': ['accs', 'profiles', 'characters', 'chars'],

  // Currency related
  'robux': ['roblox currency', 'rbx', 'r$'],
  'vbucks': ['v-bucks', 'vbuck', 'fortnite currency', 'fn currency'],
  'coins': ['gold', 'currency', 'credits'],

  // Rarity/Quality
  'rare': ['legendary', 'epic', 'uncommon'],
  'og': ['original', 'rare', 'vintage', 'legacy'],
  'exclusive': ['limited', 'rare', 'unique', 'special'],

  // Item types
  'skin': ['outfit', 'cosmetic', 'skins'],
  'skins': ['outfits', 'cosmetics', 'skin'],
  'emote': ['dance', 'taunt', 'gesture', 'emotes'],
  'emotes': ['dances', 'taunts', 'gestures', 'emote'],
  'weapon': ['gun', 'item', 'weapons'],
  'weapons': ['guns', 'items', 'weapon'],

  // Game specific - Roblox
  'roblox': ['rbx', 'rblx'],
  'adopt me': ['adoptme', 'adopt-me'],
  'bloxburg': ['blox burg', 'welcome to bloxburg'],
  'brookhaven': ['brook haven', 'brook-haven'],

  // Game specific - Fortnite
  'fortnite': ['fn', 'fort nite'],
  'stw': ['save the world', 'savetheworld'],
  'br': ['battle royale'],

  // Level/Rank related
  'level': ['lvl', 'lv', 'rank'],
  'leveled': ['lvled', 'ranked', 'high level'],
  'max': ['maxed', 'maximum', 'fully upgraded'],

  // Status
  'full access': ['fa', 'fullaccess', 'full-access'],
  'instant': ['fast', 'quick', 'immediate'],
  'verified': ['trusted', 'legit', 'authentic'],

  // General gaming
  'pro': ['professional', 'elite', 'expert'],
  'starter': ['beginner', 'new', 'fresh'],
  'loaded': ['stacked', 'rich', 'full'],
}

/**
 * Expand a search query with synonyms
 * @param query - The original search query
 * @returns Array of search terms including synonyms
 */
export function expandSearchWithSynonyms(query: string): string[] {
  const terms = query.toLowerCase().trim().split(/\s+/)
  const expandedTerms = new Set<string>()

  // Add original terms
  terms.forEach(term => expandedTerms.add(term))

  // Add synonyms for each term
  terms.forEach(term => {
    // Check if term is a key in synonyms
    if (GAMING_SYNONYMS[term]) {
      GAMING_SYNONYMS[term].forEach(synonym => {
        expandedTerms.add(synonym)
      })
    }

    // Check if term is a synonym of any key
    Object.entries(GAMING_SYNONYMS).forEach(([canonical, synonyms]) => {
      if (synonyms.includes(term)) {
        expandedTerms.add(canonical)
        synonyms.forEach(s => expandedTerms.add(s))
      }
    })
  })

  return Array.from(expandedTerms)
}

/**
 * Build a Supabase-compatible search query with synonyms
 * @param searchText - The user's search input
 * @returns Formatted search string for Supabase .or() query
 */
export function buildSynonymSearchQuery(searchText: string): string {
  const expandedTerms = expandSearchWithSynonyms(searchText)

  // Build OR conditions for title and description
  const conditions = expandedTerms.flatMap(term => [
    `title.ilike.%${term}%`,
    `description.ilike.%${term}%`
  ])

  return conditions.join(',')
}

/**
 * Get all synonyms for a specific term
 * @param term - The term to find synonyms for
 * @returns Array of synonyms including the original term
 */
export function getSynonymsForTerm(term: string): string[] {
  const normalized = term.toLowerCase().trim()
  const synonyms = new Set<string>([normalized])

  // Check if it's a canonical term
  if (GAMING_SYNONYMS[normalized]) {
    GAMING_SYNONYMS[normalized].forEach(s => synonyms.add(s))
  }

  // Check if it's a synonym of any canonical term
  Object.entries(GAMING_SYNONYMS).forEach(([canonical, syns]) => {
    if (syns.includes(normalized)) {
      synonyms.add(canonical)
      syns.forEach(s => synonyms.add(s))
    }
  })

  return Array.from(synonyms)
}
