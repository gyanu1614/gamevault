/**
 * Template Manager
 *
 * Central manager for all listing templates
 * Provides API to get templates by game/category
 */

import type { TemplateField } from './types'
import {
  robloxAccountTemplate,
  robloxCurrencyTemplate,
  robloxItemsTemplate
} from './roblox-template'
import {
  valorantAccountTemplate,
  valorantBoostingTemplate
} from './valorant-template'
import {
  fortniteAccountTemplate,
  fortniteCurrencyTemplate
} from './fortnite-template'
import {
  lolAccountTemplate,
  lolBoostingTemplate
} from './lol-template'

// Template registry mapping game slug + category slug to template fields
const templateRegistry: Record<string, TemplateField[]> = {
  // Roblox templates
  'roblox:accounts': robloxAccountTemplate,
  'roblox:currency': robloxCurrencyTemplate,
  'roblox:items': robloxItemsTemplate,

  // Valorant templates
  'valorant:accounts': valorantAccountTemplate,
  'valorant:boosting': valorantBoostingTemplate,

  // Fortnite templates
  'fortnite:accounts': fortniteAccountTemplate,
  'fortnite:currency': fortniteCurrencyTemplate,

  // League of Legends templates
  'league-of-legends:accounts': lolAccountTemplate,
  'league-of-legends:boosting': lolBoostingTemplate
}

/**
 * Get template fields for a specific game and category
 */
export function getTemplateFields(
  gameSlug: string,
  categorySlug: string
): TemplateField[] | null {
  const key = `${gameSlug}:${categorySlug}`
  return templateRegistry[key] || null
}

/**
 * Check if a template exists for game/category combination
 */
export function hasTemplate(gameSlug: string, categorySlug: string): boolean {
  const key = `${gameSlug}:${categorySlug}`
  return key in templateRegistry
}

/**
 * Get all available templates
 */
export function getAllTemplateKeys(): string[] {
  return Object.keys(templateRegistry)
}

/**
 * Get templates for a specific game (all categories)
 */
export function getGameTemplates(gameSlug: string): Record<string, TemplateField[]> {
  const templates: Record<string, TemplateField[]> = {}

  for (const key of Object.keys(templateRegistry)) {
    if (key.startsWith(`${gameSlug}:`)) {
      const categorySlug = key.split(':')[1]
      templates[categorySlug] = templateRegistry[key]
    }
  }

  return templates
}

/**
 * Get all games that have templates
 */
export function getGamesWithTemplates(): string[] {
  const games = new Set<string>()

  for (const key of Object.keys(templateRegistry)) {
    const gameSlug = key.split(':')[0]
    games.add(gameSlug)
  }

  return Array.from(games)
}

/**
 * Get categories for a specific game that have templates
 */
export function getGameCategories(gameSlug: string): string[] {
  const categories: string[] = []

  for (const key of Object.keys(templateRegistry)) {
    if (key.startsWith(`${gameSlug}:`)) {
      const categorySlug = key.split(':')[1]
      categories.push(categorySlug)
    }
  }

  return categories
}

/**
 * Get template statistics
 */
export function getTemplateStats() {
  const games = getGamesWithTemplates()
  let totalFields = 0

  for (const template of Object.values(templateRegistry)) {
    totalFields += template.length
  }

  return {
    totalTemplates: Object.keys(templateRegistry).length,
    totalGames: games.length,
    totalFields,
    games,
    averageFieldsPerTemplate: Math.round(totalFields / Object.keys(templateRegistry).length)
  }
}

export default {
  getTemplateFields,
  hasTemplate,
  getAllTemplateKeys,
  getGameTemplates,
  getGamesWithTemplates,
  getGameCategories,
  getTemplateStats
}
