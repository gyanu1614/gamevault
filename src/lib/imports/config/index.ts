/**
 * The importable-games registry.
 *
 * Adding a game is exactly two things: a config module next to this one, and
 * one line in CONFIGS. No new tables, no new matching, no pricing maths, no
 * route edits — the admin UI lists whatever is registered here.
 */
import type { GameImportConfig } from '../types'
import { adoptMeImportConfig } from './adopt-me'
import { stealABrainrotImportConfig } from './steal-a-brainrot'
import { stealAnEggImportConfig } from './steal-an-egg'

const CONFIGS: Record<string, GameImportConfig> = {
  [adoptMeImportConfig.gameSlug]: adoptMeImportConfig,
  [stealABrainrotImportConfig.gameSlug]: stealABrainrotImportConfig,
  [stealAnEggImportConfig.gameSlug]: stealAnEggImportConfig,
}

/** The config for a game, or null when that game is not importable yet. */
export function importConfigFor(gameSlug: string): GameImportConfig | null {
  return CONFIGS[gameSlug] ?? null
}

/** Every importable game slug, for the admin picker. */
export function importableGameSlugs(): string[] {
  return Object.keys(CONFIGS).sort()
}

export function isImportableGame(gameSlug: string): boolean {
  return gameSlug in CONFIGS
}
